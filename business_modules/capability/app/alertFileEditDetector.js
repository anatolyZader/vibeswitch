/**
 * AlertFileEditDetector - Monitors for unapproved file edits in DEV mode
 * 
 * Watches $HOME/.vibeswitch/state/alert.json for changes written by detect-edit.sh
 * When an alert is detected in DEV mode:
 * - If autoRevert is enabled: automatically reverts the file using git
 * - Shows a modal warning to the user
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Import change criticality analyzer
let analyzeChangeCriticality;
try {
    const changeCriticalityAnalyzer = require('./changeCriticalityAnalyzer');
    analyzeChangeCriticality = changeCriticalityAnalyzer.analyzeChangeCriticality;
} catch (e) {
    // Fallback if module not available
    analyzeChangeCriticality = () => ({
        criticality: 1.0,
        criticalityLabel: 'Unknown',
        factors: {},
        impact: 'Analysis unavailable'
    });
}

const VIBESWITCH_DIR = path.join(os.homedir(), '.vibeswitch');
const STATE_DIR = path.join(VIBESWITCH_DIR, 'state');
const ALERT_FILE = path.join(STATE_DIR, 'alert.json');

class AlertFileEditDetector {
    /**
     * @param {ModeManager} modeManager - ModeManager instance
     * @param {Object} options - Configuration options
     * @param {boolean} options.autoRevert - Auto-revert unapproved edits (default: true)
     */
    constructor(modeManager, options = {}) {
        this._modeManager = modeManager;
        this._autoRevert = options.autoRevert !== false; // Default: true
        this._watcher = null;
        this._lastAlertTs = null;
        this._statusBarItem = null;
        this._alertCount = 0;
        this._revertedCount = 0;
    }

    /**
     * Create status bar badge for unapproved edits
     * @param {vscode.ExtensionContext} context
     */
    createBadge(context) {
        this._statusBarItem = vscode.window.createStatusBarItem(
            'vibeswitch.unapprovedEdits',
            vscode.StatusBarAlignment.Right,
            998  // Just after awareness meter
        );
        this._statusBarItem.name = 'VibeSwitch Unapproved Edits';
        this._statusBarItem.command = 'vibeswitch.showAlertLog';
        this._updateBadge();
        context.subscriptions.push(this._statusBarItem);
    }

    _updateBadge() {
        if (!this._statusBarItem) return;
        
        if (this._alertCount > 0 && this._modeManager.getMode() === 'dev') {
            this._statusBarItem.text = `$(alert) ${this._alertCount}`;
            this._statusBarItem.tooltip = `${this._alertCount} unapproved edit(s) detected`;
            this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this._statusBarItem.show();
        } else {
            this._statusBarItem.hide();
        }
    }

    /**
     * Check if file can be reverted (is tracked by git and workspace is a git repo)
     * @param {string} filePath - Absolute path to file
     * @param {string} workspaceRoot - Workspace root path
     * @returns {{canRevert: boolean, reason?: string}}
     */
    _checkCanRevert(filePath, workspaceRoot) {
        try {
            // Check if workspace is a git repo
            execSync('git rev-parse --git-dir', { cwd: workspaceRoot, stdio: 'pipe' });
            
            // Check if file is tracked by git
            const relativePath = path.relative(workspaceRoot, filePath);
            try {
                execSync(`git ls-files --error-unmatch "${relativePath}"`, { cwd: workspaceRoot, stdio: 'pipe' });
                return { canRevert: true };
            } catch {
                return { canRevert: false, reason: 'File is not tracked by git (new file)' };
            }
        } catch {
            return { canRevert: false, reason: 'Not a git repository' };
        }
    }

    /**
     * Get change significance information (enhanced with dependency analysis)
     * @param {string} filePath - Absolute path to file
     * @param {string} workspaceRoot - Workspace root path
     * @returns {Promise<{criticality: number, criticalityLabel: string, changeSize: string, linesAdded: number, linesRemoved: number, impact: string, factors: Object}>}
     */
    async _getChangeSignificance(filePath, workspaceRoot) {
        let criticality = 1.0;
        let criticalityLabel = 'Regular';
        let changeSize = 'Unknown';
        let linesAdded = 0;
        let linesRemoved = 0;
        let impact = 'Standard code change';
        let factors = {};

        try {
            // Get VS Code document if available (for in-memory analysis)
            // Pass document text content, not VS Code API object (analyzer is pure)
            let document = null;
            try {
                const fileUri = vscode.Uri.file(filePath);
                const vscodeDoc = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === filePath);
                if (vscodeDoc) {
                    document = { text: vscodeDoc.getText() }; // Extract text, don't pass VS Code API
                }
            } catch (e) {
                // Document not available
            }
            
            // Use enhanced criticality analyzer (async, includes dependency analysis, change type, etc.)
            const analysis = await analyzeChangeCriticality(filePath, workspaceRoot, document);
            criticality = analysis.criticality;
            criticalityLabel = analysis.criticalityLabel;
            impact = analysis.impact;
            factors = analysis.factors;

            // Get git diff stats if file is tracked
            try {
                const relativePath = path.relative(workspaceRoot, filePath);
                execSync(`git ls-files --error-unmatch "${relativePath}"`, { cwd: workspaceRoot, stdio: 'pipe' });
                
                // File is tracked - get diff stats
                const diffOutput = execSync(`git diff --numstat "${relativePath}"`, { cwd: workspaceRoot, stdio: 'pipe', encoding: 'utf8' });
                const match = diffOutput.trim().match(/^(\d+)\s+(\d+)/);
                if (match) {
                    linesAdded = parseInt(match[1], 10);
                    linesRemoved = parseInt(match[2], 10);
                    
                    const totalLines = linesAdded + linesRemoved;
                    if (totalLines === 0) {
                        changeSize = 'No changes detected';
                    } else if (totalLines < 10) {
                        changeSize = 'Small';
                    } else if (totalLines < 50) {
                        changeSize = 'Medium';
                    } else if (totalLines < 200) {
                        changeSize = 'Large';
                    } else {
                        changeSize = 'Very Large';
                    }
                }
            } catch {
                // File not tracked or not a git repo - can't get diff stats
                changeSize = 'New file (not tracked)';
            }
        } catch (e) {
            console.error('AlertFileEditDetector: Error calculating significance:', e.message);
        }

        return { criticality, criticalityLabel, changeSize, linesAdded, linesRemoved, impact, factors };
    }

    /**
     * Auto-revert a file to its last committed state
     * @param {string} filePath - Absolute path to file
     * @param {string} workspaceRoot - Workspace root path
     * @returns {{success: boolean, error?: string}}
     */
    _autoRevertFile(filePath, workspaceRoot) {
        try {
            const relativePath = path.relative(workspaceRoot, filePath);
            execSync(`git checkout -- "${relativePath}"`, { cwd: workspaceRoot, stdio: 'pipe' });
            this._revertedCount++;
            console.log(`AlertFileEditDetector: Auto-reverted "${relativePath}"`);
            return { success: true };
        } catch (err) {
            console.error(`AlertFileEditDetector: Auto-revert failed for "${filePath}":`, err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Handle alert file change
     */
    async _onAlertChange() {
        try {
            if (!fs.existsSync(ALERT_FILE)) return;

            const content = fs.readFileSync(ALERT_FILE, 'utf8');
            const alert = JSON.parse(content);

            // Skip if we've already processed this alert
            if (alert.ts === this._lastAlertTs) return;
            this._lastAlertTs = alert.ts;

            // Only alert in DEV mode
            if (this._modeManager.getMode() !== 'dev') return;

            const file = alert.file || 'unknown file';
            const fileName = path.basename(file);
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            // Try auto-revert if enabled
            let autoReverted = false;
            let autoRevertError = null;
            
            if (this._autoRevert && workspaceRoot && file !== 'UNKNOWN') {
                const canRevert = this._checkCanRevert(file, workspaceRoot);
                if (canRevert.canRevert) {
                    const result = this._autoRevertFile(file, workspaceRoot);
                    autoReverted = result.success;
                    autoRevertError = result.error;
                } else {
                    autoRevertError = canRevert.reason;
                }
            }

            this._alertCount++;
            this._updateBadge();

            // Show notification based on auto-revert result
            if (autoReverted) {
                // === MAKE IT OBVIOUS: Multi-channel feedback ===
                
                // 1. PROMINENT STATUS BAR FLASH (temporary red background)
                if (this._statusBarItem) {
                    const originalBg = this._statusBarItem.backgroundColor;
                    const originalText = this._statusBarItem.text;
                    this._statusBarItem.text = `$(shield) BLOCKED`;
                    this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                    this._statusBarItem.show();
                    // Reset after 3 seconds
                    setTimeout(() => {
                        this._statusBarItem.backgroundColor = originalBg;
                        this._statusBarItem.text = originalText;
                        this._updateBadge();
                    }, 3000);
                }
                
                // 2. PROGRESS NOTIFICATION (prominent, shows in notification center) with significance
                // Calculate significance asynchronously (non-blocking)
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `⛔ BLOCKED`,
                    cancellable: false
                }, async (progress) => {
                    // Start with basic message, then enhance with significance
                    progress.report({ 
                        message: `Unauthorized edit to "${fileName}" was auto-reverted`
                    });
                    
                    // Calculate significance in background (non-blocking)
                    const significance = workspaceRoot && file !== 'UNKNOWN'
                        ? await this._getChangeSignificance(file, workspaceRoot).catch(() => ({ 
                            criticalityLabel: 'Unknown', 
                            changeSize: 'Unknown', 
                            impact: 'Cannot analyze' 
                        }))
                        : { criticalityLabel: 'Unknown', changeSize: 'Unknown', impact: 'Cannot analyze' };
                    
                    const impactText = significance.impact ? ` • ${significance.impact}` : '';
                    progress.report({ 
                        message: `Unauthorized edit to "${fileName}" was auto-reverted\n` +
                                `${significance.criticalityLabel}${impactText} • ${significance.changeSize} change`
                    });
                    // Keep visible for 4 seconds
                    await new Promise(resolve => setTimeout(resolve, 4000));
                });
                
                // 3. OPEN THE FILE to show user which file was affected
                if (file !== 'UNKNOWN') {
                    try {
                        const doc = await vscode.workspace.openTextDocument(file);
                        const editor = await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true });
                        
                        // 4. FLASH DECORATION at top of file (yellow banner)
                        const decorationType = vscode.window.createTextEditorDecorationType({
                            isWholeLine: true,
                            backgroundColor: new vscode.ThemeColor('editorWarning.background'),
                            border: '2px solid',
                            borderColor: new vscode.ThemeColor('editorWarning.foreground')
                        });
                        const firstLine = new vscode.Range(0, 0, 0, 0);
                        editor.setDecorations(decorationType, [firstLine]);
                        
                        // Remove decoration after 3 seconds
                        setTimeout(() => {
                            decorationType.dispose();
                        }, 3000);
                    } catch (e) {
                        // File might have been deleted, ignore
                    }
                }
                
                // 5. LOG to output channel
                console.log(`VibeSwitch: ⛔ BLOCKED unauthorized edit to "${fileName}" - auto-reverted`);
                
                // Decrement alert count since we handled it
                this._alertCount = Math.max(0, this._alertCount - 1);
                this._updateBadge();
            } else {
                // Auto-revert disabled or failed - show MODAL warning with significance
                // Calculate significance asynchronously
                const significancePromise = workspaceRoot && file !== 'UNKNOWN' 
                    ? this._getChangeSignificance(file, workspaceRoot)
                    : Promise.resolve({ criticalityLabel: 'Unknown', changeSize: 'Unknown', linesAdded: 0, linesRemoved: 0, impact: 'Cannot analyze', factors: {} });
                
                const significance = await significancePromise;
                const revertFailReason = autoRevertError ? `\n\nAuto-revert unavailable: ${autoRevertError}` : '\n\nNote: Auto-revert is disabled. File edit was allowed.';
                
                // Build significance message with enhanced analysis
                let significanceMsg = `\n\n📊 Change Significance:\n`;
                significanceMsg += `   • Criticality: ${significance.criticalityLabel}\n`;
                significanceMsg += `   • Impact: ${significance.impact || 'Standard code change'}\n`;
                significanceMsg += `   • Change Size: ${significance.changeSize}`;
                if (significance.linesAdded > 0 || significance.linesRemoved > 0) {
                    significanceMsg += ` (+${significance.linesAdded} / -${significance.linesRemoved} lines)`;
                }
                
                // Add dependency info if available
                if (significance.factors && significance.factors.dependencyCount !== undefined) {
                    if (significance.factors.dependencyCount > 0) {
                        significanceMsg += `\n   • Dependencies: ${significance.factors.dependencyCount} file${significance.factors.dependencyCount !== 1 ? 's' : ''} depend on this file`;
                    }
                }
                
                // Add change type info if available
                if (significance.factors && significance.factors.structuralChanges && significance.factors.structuralChanges.length > 0) {
                    significanceMsg += `\n   • Structural Changes: ${significance.factors.structuralChanges.join(', ')}`;
                }
                
                // Add activation path info if available
                if (significance.factors && significance.factors.activationPath && significance.factors.activationPath.length > 0) {
                    significanceMsg += `\n   • Activation Path: ${significance.factors.activationPath.join(', ')}`;
                }
                
                const selection = await vscode.window.showWarningMessage(
                    `⚠️ FILE EDIT DETECTED IN DEV MODE ⚠️\n\n` +
                    `The AI agent modified "${fileName}".${revertFailReason}${significanceMsg}\n\n` +
                    `The change has been logged to the audit trail.\n\n` +
                    `File: ${file}`,
                    { modal: true },
                    'View File',
                    'View Git Diff',
                    'Revert with Git',
                    'Dismiss'
                );

                if (selection === 'View File' && file !== 'UNKNOWN') {
                    const doc = await vscode.workspace.openTextDocument(file);
                    await vscode.window.showTextDocument(doc);
                } else if (selection === 'View Git Diff') {
                    // Open git diff view
                    vscode.commands.executeCommand('git.openChange', vscode.Uri.file(file));
                } else if (selection === 'Revert with Git' && file !== 'UNKNOWN' && workspaceRoot) {
                    // Offer to revert the file using git checkout
                    // FIXED: Use relative path instead of absolute path
                    const confirm = await vscode.window.showWarningMessage(
                        `Are you sure you want to revert "${fileName}" to the last committed version? This cannot be undone.`,
                        { modal: true },
                        'Yes, Revert',
                        'Cancel'
                    );
                    if (confirm === 'Yes, Revert') {
                        try {
                            if (workspaceRoot) {
                                // FIXED: Use execFile with relative path for safety (no shell quoting issues)
                                const relativePath = path.relative(workspaceRoot, file);
                                const { execFile } = require('child_process');
                                const { promisify } = require('util');
                                const execFileAsync = promisify(execFile);
                                
                                await execFileAsync('git', ['checkout', '--', relativePath], {
                                    cwd: workspaceRoot
                                });
                                
                                vscode.window.showInformationMessage(`Reverted "${fileName}" to last committed version.`);
                                this._alertCount = Math.max(0, this._alertCount - 1);
                                this._updateBadge();
                            }
                        } catch (err) {
                            vscode.window.showErrorMessage(`Failed to revert: ${err.message}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('AlertFileEditDetector: Error processing alert:', error.message);
        }
    }

    /**
     * Start watching for alerts
     */
    start() {
        // Ensure state directory exists
        if (!fs.existsSync(STATE_DIR)) {
            fs.mkdirSync(STATE_DIR, { recursive: true });
        }

        // Use chokidar if available, fallback to fs.watch
        try {
            const chokidar = require('chokidar');
            this._watcher = chokidar.watch(ALERT_FILE, {
                persistent: true,
                ignoreInitial: true,
                // SPEED OPTIMIZATIONS:
                usePolling: false,        // Use native events (faster than polling)
                awaitWriteFinish: false,  // Don't wait for write to complete
                atomic: false,            // Don't add artificial delay
                interval: 50,             // If polling needed, check every 50ms
                binaryInterval: 50
            });
            this._watcher.on('change', () => this._onAlertChange());
            this._watcher.on('add', () => this._onAlertChange());
            console.log('AlertFileEditDetector: Using chokidar watcher (optimized for speed)');
        } catch {
            // Fallback to fs.watch (less reliable on some platforms)
            console.log('AlertFileEditDetector: Chokidar not available, using fs.watch');
            if (fs.existsSync(ALERT_FILE)) {
                this._watcher = fs.watch(ALERT_FILE, () => this._onAlertChange());
            } else {
                // Watch directory for file creation
                this._watcher = fs.watch(STATE_DIR, (eventType, filename) => {
                    if (filename === 'alert.json') {
                        this._onAlertChange();
                    }
                });
            }
        }

        console.log('AlertFileEditDetector: Started watching', ALERT_FILE);
    }

    /**
     * Clear alert count
     */
    clearAlerts() {
        this._alertCount = 0;
        this._updateBadge();
    }

    /**
     * Cleanup
     */
    dispose() {
        if (this._watcher) {
            if (typeof this._watcher.close === 'function') {
                this._watcher.close();
            } else if (typeof this._watcher.unref === 'function') {
                this._watcher.unref();
            }
            this._watcher = null;
        }
        if (this._statusBarItem) {
            this._statusBarItem.dispose();
            this._statusBarItem = null;
        }
    }
}

module.exports = AlertFileEditDetector;
