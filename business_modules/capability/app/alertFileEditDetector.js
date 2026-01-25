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
                
                // 2. PROGRESS NOTIFICATION (prominent, shows in notification center)
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `⛔ BLOCKED`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ message: `Unauthorized edit to "${fileName}" was auto-reverted` });
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
                // Auto-revert failed or disabled - show MODAL warning
                const revertFailReason = autoRevertError ? `\n\nAuto-revert failed: ${autoRevertError}` : '';
                const selection = await vscode.window.showWarningMessage(
                    `⛔ UNAUTHORIZED FILE EDIT DETECTED ⛔\n\n` +
                    `The AI agent modified "${fileName}" WITHOUT using the approved MCP workflow.\n\n` +
                    `This violates DEV mode rules. The change has been logged to the audit trail.${revertFailReason}\n\n` +
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
                } else if (selection === 'Revert with Git' && file !== 'UNKNOWN') {
                    // Offer to revert the file using git checkout
                    const confirm = await vscode.window.showWarningMessage(
                        `Are you sure you want to revert "${fileName}" to the last committed version? This cannot be undone.`,
                        { modal: true },
                        'Yes, Revert',
                        'Cancel'
                    );
                    if (confirm === 'Yes, Revert') {
                        try {
                            if (workspaceRoot) {
                                execSync(`git checkout -- "${file}"`, { cwd: workspaceRoot });
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
