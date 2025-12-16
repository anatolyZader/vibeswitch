/**
 * VibeSwitch Extension - Main Entry Point
 * Orchestrates extension functionality: initialization, mode switching, awareness monitoring
 */

// Logger will be initialized in activate()

const vscode = require('vscode');
const { window, workspace, commands, StatusBarAlignment } = vscode;
const UsageStatsManager = require('./usage-stats');
const AwarenessMonitor = require('./awareness-monitor');
const modeManager = require('./mode-manager');
const statusBar = require('./status-bar');
const statistics = require('./statistics');
const ui = require('./ui');
const path = require('path');
const fs = require('fs');
const { createLogger, getLogger } = require('./logger');

let UnreviewedFileDecorationProvider;
try {
    UnreviewedFileDecorationProvider = require('./file-decorations');
    console.log('VibeSwitch: ✅ file-decorations module loaded successfully');
} catch (error) {
    console.error('VibeSwitch: ❌ ERROR loading file-decorations module:', error.message);
}

// Global state
let statusBarItem, awarenessBarItem, currentMode = null;
let usageStats = null, awarenessMonitor = null, extensionContext = null;
let meterUpdateTimer = null, outputChannel = null, fileDecorationProvider = null;

// Helper: Log using throttled logger
let log = (msg, show = false) => {
    // Fallback if logger not initialized
    console.log(msg);
    outputChannel?.appendLine(msg);
    if (show) outputChannel?.show(true);
};

// Helper: Update awareness meter and refresh decorations
const updateAwarenessMeter = () => {
    statusBar.updateAwarenessMeter(awarenessBarItem, awarenessMonitor, currentMode, outputChannel);
    if (fileDecorationProvider && currentMode === 'dev') fileDecorationProvider.refresh();
};

// Helper: Update status bar (NEVER auto-detects mode)
const updateStatusBar = (forceMode = null) => {
    // Only update if mode is explicitly provided or already set
    if (forceMode !== null) {
        currentMode = forceMode;
    }
    // If no mode set at all, show neutral state (don't detect)
    if (!currentMode) {
        statusBar.updateStatusBar(statusBarItem, null, outputChannel);
        updateAwarenessMeter();
        return;
    }
    statusBar.updateStatusBar(statusBarItem, currentMode, outputChannel);
    updateAwarenessMeter();
};

// Helper: Initialize file decoration provider
const initFileDecorations = () => {
    if (!UnreviewedFileDecorationProvider || fileDecorationProvider || !extensionContext) return;
    
    try {
        log('Creating file decoration provider...');
        fileDecorationProvider = new UnreviewedFileDecorationProvider(
            awarenessMonitor,
            () => currentMode,
            outputChannel
        );
        
        const provider = fileDecorationProvider.register(extensionContext);
        if (provider) {
            log('✅ File decoration provider registered successfully');
        } else {
            log('❌ ERROR: File decoration provider registration failed');
        }
    } catch (error) {
        log(`❌ ERROR creating file decoration provider: ${error.message}`);
        console.error('VibeSwitch: Error creating file decoration provider:', error);
    }
};

// Helper: Start awareness monitor
const startAwarenessMonitor = () => {
    if (!awarenessMonitor || !extensionContext) return;
    
    awarenessMonitor.start(extensionContext);
    log('VibeSwitch: Started real-time awareness monitoring');
    initFileDecorations();
    
    if (meterUpdateTimer) clearInterval(meterUpdateTimer);
    meterUpdateTimer = setInterval(() => {
        if (currentMode === 'dev') updateAwarenessMeter();
    }, 10000);
    
    updateAwarenessMeter();
};

// Helper: Stop awareness monitor
const stopAwarenessMonitor = () => {
    if (!awarenessMonitor) return;
    
    awarenessMonitor.stop();
    log('VibeSwitch: Stopped awareness monitoring (VIBE mode)');
    
    if (fileDecorationProvider) {
        fileDecorationProvider.dispose();
        fileDecorationProvider = null;
    }
    
    if (meterUpdateTimer) {
        clearInterval(meterUpdateTimer);
        meterUpdateTimer = null;
    }
};

// Helper: Switch to mode
const switchToMode = async (mode) => {
    try {
        log(`VibeSwitch: Switching to ${mode} mode (current: ${currentMode})`);
        
        // Set mode IMMEDIATELY before any file operations
        // This prevents any detection from seeing the wrong mode
        const previousMode = currentMode;
        currentMode = mode;
        
        // Update UI immediately with the new mode
        updateStatusBar(mode);
        
        await modeManager.switchToMode(mode, {
            currentMode: previousMode, // Pass previous mode for stats
            onModeSwitched: (newMode) => {
                // Don't change currentMode here - we already set it
                log(`VibeSwitch: Mode switched callback called with: ${newMode} (already set to ${currentMode})`);
            },
            onMonitorStart: startAwarenessMonitor,
            onMonitorStop: stopAwarenessMonitor,
            usageStats
        });
        
        // Verify file was written correctly, but DON'T detect mode from file
        // We trust what we just set
        log(`VibeSwitch: Successfully switched to ${mode} mode (mode locked, no re-detection)`);
        
        // Final UI update to ensure consistency
        updateStatusBar(mode);
    } catch (error) {
        // On error, try to restore previous mode
        log(`ERROR in switchToMode: ${error.message}`, true, true);
        console.error('VibeSwitch: Error in switchToMode:', error);
        window.showErrorMessage(`Failed to switch mode: ${error.message}`);
    }
};

// Command handlers
const commandHandlers = {
    'vibeswitch.switchMode': async () => {
        try {
            log(`VibeSwitch: switchMode command triggered, currentMode=${currentMode}`);
            ui.showModePicker(
                currentMode,
                usageStats,
                async (mode) => {
                    log(`VibeSwitch: Mode selected in picker: ${mode}`);
                    await switchToMode(mode);
                },
                async () => await statistics.showUsageStatistics(usageStats)
            );
        } catch (error) {
            log(`ERROR in switchMode command: ${error.message}`, true, true);
            console.error('VibeSwitch: Error in switchMode command:', error);
            window.showErrorMessage(`Failed to show mode picker: ${error.message}`);
        }
    },
    'vibeswitch.toVibe': () => switchToMode('vibe'),
    'vibeswitch.toDev': () => switchToMode('dev'),
    'vibeswitch.showStats': () => statistics.showUsageStatistics(usageStats),
    'vibeswitch.resetStats': () => statistics.resetUsageStatistics(usageStats),
    'vibeswitch.exportStats': () => statistics.exportUsageStatistics(usageStats),
    'vibeswitch.showLogs': () => {
        if (outputChannel) {
            outputChannel.show(true);
            window.showInformationMessage('VibeSwitch logs opened in Output panel');
        }
    },
    'vibeswitch.showStatusBar': () => {
        if (!statusBarItem) {
            window.showErrorMessage('Status bar items not initialized. Please reload the window.');
            return;
        }
        statusBarItem.show();
        if (currentMode === 'dev' && awarenessBarItem) awarenessBarItem.show();
        window.showInformationMessage('VibeSwitch status bar items shown');
        log('Status bar items manually shown via command');
    },
    'vibeswitch.diagnoseDecorations': () => {
        if (!fileDecorationProvider) {
            window.showWarningMessage('File Decoration Provider: Not initialized');
            log(`Current mode: ${currentMode}`);
            log(`Awareness monitor exists: ${awarenessMonitor ? 'YES' : 'NO'}`);
            outputChannel?.show(true);
            return;
        }
        
        const scoreData = awarenessMonitor?.getScore();
        let message = '=== File Decoration Provider Diagnostic ===\n\n';
        message += `Provider exists: YES\nCurrent mode: ${currentMode}\n`;
        message += `Awareness monitor exists: ${awarenessMonitor ? 'YES' : 'NO'}\n`;
        message += `Debug call count: ${fileDecorationProvider.debugCallCount || 0}\n\nScore Data:\n`;
        message += `  Debt files: ${scoreData?.debt?.files?.length || 0}\n`;
        
        scoreData?.debt?.files?.forEach((f, i) => {
            message += `    [${i}] ${f.path} (${f.fullPath})\n`;
        });
        
        message += `  Pending files: ${scoreData?.suggestions?.pendingFiles?.length || 0}\n`;
        scoreData?.suggestions?.pendingFiles?.forEach((f, i) => {
            message += `    [${i}] ${f.path} (${f.fullPath})\n`;
        });
        
        message += '\nTriggering manual refresh...\n';
        outputChannel?.appendLine(message);
        outputChannel?.show(true);
        fileDecorationProvider.refresh();
        window.showInformationMessage('File decoration refresh triggered. Check Output panel for details.');
    },
    'vibeswitch.detectTestingFiles': async () => {
        if (!awarenessMonitor) {
            window.showWarningMessage('Awareness Monitor: Not initialized');
            return;
        }
        
        const workspaceFolders = workspace.workspaceFolders;
        if (!workspaceFolders?.length) {
            window.showWarningMessage('No workspace folder found');
            return;
        }
        
        const testingPath = path.join(workspaceFolders[0].uri.fsPath, 'testing');
        if (!fs.existsSync(testingPath)) {
            window.showWarningMessage('Testing folder not found');
            return;
        }
        
        const files = fs.readdirSync(testingPath)
            .filter(f => f.endsWith('.js'))
            .map(f => path.join(testingPath, f))
            .filter(f => fs.existsSync(f) && fs.statSync(f).isFile())
            .filter(f => fs.readFileSync(f, 'utf8').trim().length > 0);
        
        let detected = 0;
        for (const filePath of files) {
            awarenessMonitor.handleExternallyCreatedFile(filePath);
            detected++;
        }
        
        if (detected > 0) {
            window.showInformationMessage(`Detected ${detected} file(s) in testing folder. Check decorations!`);
            if (fileDecorationProvider && currentMode === 'dev') fileDecorationProvider.refresh();
        } else {
            window.showInformationMessage('No files detected in testing folder');
        }
    },
    'vibeswitch.diagnoseMonitor': () => {
        if (!awarenessMonitor) {
            window.showWarningMessage('Awareness Monitor: Not initialized');
            outputChannel?.appendLine('Awareness Monitor: Not initialized');
            outputChannel?.show(true);
            return;
        }
        
        const status = awarenessMonitor.getStatus();
        const scoreData = awarenessMonitor.getScore();
        const mode = currentMode;
        
        let message = '=== Awareness Monitor Diagnostic ===\n\n';
        message += `Current Mode: ${mode || 'null'}\nMonitor Active: ${status.isActive ? 'YES' : 'NO'}\n`;
        message += `Has Context: ${status.hasContext ? 'YES' : 'NO'}\nHas Callback: ${status.hasCallback ? 'YES' : 'NO'}\n`;
        message += `Has Usage Stats: ${status.hasUsageStats ? 'YES' : 'NO'}\nAI Suggestions: ${status.aiSuggestionsCount}\n`;
        message += `Review Debt Files: ${status.reviewDebtCount}\nCurrent Score: ${status.currentScore}\n`;
        message += `Score Components: ${JSON.stringify(status.scores, null, 2)}\n`;
        message += `Watched Directories: ${status.watchedDirectories.length}\n`;
        status.watchedDirectories.forEach(dir => message += `  - ${dir}\n`);
        
        message += '\n=== File Decoration Diagnostic ===\n\n';
        message += `File Decoration Provider: ${fileDecorationProvider ? 'EXISTS' : 'NULL'}\n`;
        if (fileDecorationProvider) {
            message += `Debug Call Count: ${fileDecorationProvider.debugCallCount || 0}\n`;
        }
        
        message += '\nReview Debt Files (from score data):\n';
        if (scoreData?.debt?.files?.length > 0) {
            scoreData.debt.files.forEach((f, i) => {
                message += `  [${i}] ${f.path}\n      Full Path: ${f.fullPath}\n      Modifications: ${f.modifications}\n      Age: ${f.ageMinutes}m\n`;
            });
        } else {
            message += '  (none)\n';
        }
        
        message += '\nPending Files (from score data):\n';
        if (scoreData?.suggestions?.pendingFiles?.length > 0) {
            scoreData.suggestions.pendingFiles.forEach((f, i) => {
                message += `  [${i}] ${f.path}\n      Full Path: ${f.fullPath}\n      Type: ${f.type}\n      Age: ${f.ageMinutes}m\n`;
            });
        } else {
            message += '  (none)\n';
        }
        
        // Testing folder files check
        const workspaceFolders = workspace.workspaceFolders;
        if (workspaceFolders?.length) {
            const testingPath = path.join(workspaceFolders[0].uri.fsPath, 'testing');
            if (fs.existsSync(testingPath)) {
                message += '\n=== Testing Folder Files ===\n';
                const files = fs.readdirSync(testingPath)
                    .filter(f => f.endsWith('.js'))
                    .map(f => path.join(testingPath, f));
                
                files.forEach(filePath => {
                    const relativePath = path.relative(workspaceFolders[0].uri.fsPath, filePath);
                    const inDebt = scoreData?.debt?.files?.some(f => 
                        path.resolve(f.fullPath).toLowerCase() === path.resolve(filePath).toLowerCase()
                    );
                    const inPending = scoreData?.suggestions?.pendingFiles?.some(f => 
                        path.resolve(f.fullPath).toLowerCase() === path.resolve(filePath).toLowerCase()
                    );
                    
                    message += `  ${relativePath}: ${inDebt ? '✅ IN DEBT' : inPending ? '⏳ IN PENDING' : '❌ NOT DETECTED'}\n`;
                    
                    if (!inDebt && !inPending && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                        const content = fs.readFileSync(filePath, 'utf8');
                        if (content.trim().length > 0) {
                            try {
                                awarenessMonitor.handleExternallyCreatedFile(filePath);
                                message += '      → Manually triggered detection\n';
                            } catch (err) {
                                message += `      → Error triggering: ${err.message}\n`;
                            }
                        }
                    }
                });
            }
        }
        
        message += `\nFile System Watcher: ${status.hasFileSystemWatcher ? 'ACTIVE' : 'INACTIVE'}\n`;
        message += `Update Timer: ${status.hasUpdateTimer ? 'ACTIVE' : 'INACTIVE'}\n`;
        message += `Recent Acceptances: ${status.recentAcceptances}\n`;
        message += `Workspace Folders: ${status.workspaceFolders.length}\n`;
        status.workspaceFolders.forEach(folder => message += `  - ${folder}\n`);
        
        outputChannel?.appendLine(message);
        outputChannel?.show(true);
        const summary = `Monitor: ${status.isActive ? 'ACTIVE' : 'INACTIVE'} | Mode: ${mode || 'null'} | Suggestions: ${status.aiSuggestionsCount} | Score: ${status.currentScore}`;
        window.showInformationMessage(summary);
    },
    'vibeswitch.showUnreviewedFiles': async () => {
        if (!awarenessMonitor) {
            window.showWarningMessage('Awareness Monitor: Not initialized');
            return;
        }
        
        if (currentMode !== 'dev') {
            window.showInformationMessage('Unreviewed files are only tracked in DEV mode');
            return;
        }
        
        const scoreData = awarenessMonitor.getScore();
        const allItems = [];
        
        scoreData.debt.files?.forEach(file => {
            const timeStr = file.ageMinutes < 60 ? `${file.ageMinutes}m ago` : `${Math.round(file.ageMinutes / 60)}h ago`;
            allItems.push({
                label: `$(file) ${file.path}`,
                description: `Review debt • ${timeStr} • ${file.modifications} changes`,
                detail: file.fullPath,
                filePath: file.fullPath,
                type: 'debt'
            });
        });
        
        scoreData.suggestions.pendingFiles?.forEach(file => {
            const timeStr = file.ageMinutes < 60 ? `${file.ageMinutes}m ago` : `${Math.round(file.ageMinutes / 60)}h ago`;
            allItems.push({
                label: `$(clock) ${file.path}`,
                description: `Pending ${file.type} • ${timeStr}`,
                detail: file.fullPath,
                filePath: file.fullPath,
                type: 'pending'
            });
        });
        
        if (allItems.length === 0) {
            window.showInformationMessage('✅ No unreviewed files - great job!');
            return;
        }
        
        const selected = await window.showQuickPick(allItems, {
            placeHolder: `Select a file to open and review (${allItems.length} unreviewed items)`,
            matchOnDescription: true,
            matchOnDetail: true
        });
        
        if (selected?.filePath) {
            try {
                const document = await workspace.openTextDocument(selected.filePath);
                await window.showTextDocument(document);
                log(`Opened unreviewed file: ${selected.filePath}`);
            } catch (error) {
                window.showErrorMessage(`Failed to open file: ${error.message}`);
                log(`Error opening file ${selected.filePath}: ${error.message}`);
            }
        }
    }
};

// Register all commands
const registerCommands = (context) => {
    Object.entries(commandHandlers).forEach(([command, handler]) => {
        context.subscriptions.push(commands.registerCommand(command, handler));
    });
};

// Setup usage stats listeners
const setupUsageStatsListeners = (context) => {
    context.subscriptions.push(
        workspace.onDidOpenTextDocument((doc) => usageStats?.trackFileOpen(doc.fileName)),
        workspace.onDidChangeTextDocument((event) => {
            if (usageStats && event.contentChanges.length > 0) usageStats.trackEdit();
        }),
        workspace.onDidSaveTextDocument(() => usageStats?.trackFileSave()),
        { dispose: () => usageStats?.endSession() }
    );
};

// Main activation function
function activate(context) {
    try {
        outputChannel = window.createOutputChannel('VibeSwitch');
        context.subscriptions.push(outputChannel);
        
        // Initialize throttled logger
        const logger = createLogger(outputChannel);
        log = (msg, show = false, force = false) => {
            logger.log(msg, force, show);
        };
        
        const workspaceCount = workspace.workspaceFolders?.length ?? 0;
        log(UnreviewedFileDecorationProvider 
            ? 'VibeSwitch: ✅ file-decorations module loaded successfully'
            : 'VibeSwitch: ❌ ERROR: file-decorations module NOT loaded', false, true);
        log('VibeSwitch extension is now active', false, true);
        log(`Workspace folders: ${workspaceCount}`, false, true);
        outputChannel.show(true);
    } catch (error) {
        console.error('VibeSwitch: Error during activation:', error);
        outputChannel?.appendLine(`ERROR: ${error.message}`);
        outputChannel?.show(true);
    }
    
    extensionContext = context;
    usageStats = new UsageStatsManager(context);
    
    awarenessMonitor = new AwarenessMonitor(usageStats, () => {
        log(`VibeSwitch: Score update callback triggered, currentMode=${currentMode}`);
        if (currentMode === 'dev') {
            updateAwarenessMeter();
            if (fileDecorationProvider) {
                log('VibeSwitch: Refreshing file decorations from score update callback');
                fileDecorationProvider.refresh();
            }
        }
    });
    
    log('VibeSwitch: AwarenessMonitor initialized with callback');
    if (AwarenessMonitor.setLogOutput) {
        AwarenessMonitor.setLogOutput(outputChannel);
        log('VibeSwitch: Log output channel connected to AwarenessMonitor');
    }
    
    // Create status bar items
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    statusBarItem.command = 'vibeswitch.switchMode';
    context.subscriptions.push(statusBarItem);
    
    awarenessBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 99);
    awarenessBarItem.command = 'vibeswitch.showStats';
    context.subscriptions.push(awarenessBarItem);
    
    registerCommands(context);
    
    // Show status bar items immediately
    if (statusBarItem) {
        statusBarItem.text = '$(gear) VibeSwitch';
        statusBarItem.tooltip = 'VibeSwitch: Initializing...';
        statusBarItem.show();
        log('Status bar item created and shown immediately');
    }
    
    if (awarenessBarItem) {
        awarenessBarItem.text = '$(graph)';
        awarenessBarItem.tooltip = 'Awareness meter: Initializing...';
        log('Awareness bar item created');
    }
    
    // Initialize and update status bar - detect mode ONCE on startup, then never again
    setTimeout(() => {
        try {
            // Detect mode ONCE on initialization
            const initialMode = modeManager.detectCurrentMode(true);
            if (initialMode) {
                currentMode = initialMode;
                log(`VibeSwitch: Initial mode detected: ${initialMode}`);
            } else {
                log(`VibeSwitch: No mode detected on initialization`);
            }
            
            // Update status bar with detected mode (don't detect again)
            updateStatusBar(currentMode);
            if (statusBarItem) statusBarItem.show();
            
            log(`VibeSwitch: Initialization complete. Mode: ${currentMode || 'none'}. No file watcher - mode only changes on explicit user action.`);
        } catch (error) {
            console.error('VibeSwitch: Error updating status bar:', error);
            log(`ERROR updating status bar: ${error.message}`, true, true);
            log(`Stack: ${error.stack}`, false, true);
            
            if (statusBarItem) {
                statusBarItem.text = '$(alert) VibeSwitch';
                statusBarItem.tooltip = `VibeSwitch: Error - ${error.message}\nClick to switch modes`;
                statusBarItem.show();
            }
        }
    }, 500);
    
    // Start awareness monitor if in DEV mode
    setTimeout(() => {
        if (currentMode === 'dev' && awarenessMonitor) {
            log('VibeSwitch: Starting awareness monitor (already in DEV mode)...');
            startAwarenessMonitor();
            log('VibeSwitch: ✅ Awareness monitor started successfully');
            updateAwarenessMeter();
        } else {
            log(`VibeSwitch: Monitor not started - currentMode=${currentMode}, awarenessMonitor=${awarenessMonitor ? 'exists' : 'null'}`);
        }
    }, 1000);
    
    // NO FILE WATCHER - mode only changes when user explicitly switches
    // This prevents all flashing and race conditions
    log('VibeSwitch: File watcher disabled - mode only changes on explicit user action');
    
    setupUsageStatsListeners(context);
}

// Deactivation function
const deactivate = () => {
    statusBarItem?.dispose();
    awarenessBarItem?.dispose();
    usageStats?.endSession();
    if (fileDecorationProvider) {
        fileDecorationProvider.dispose();
        fileDecorationProvider = null;
    }
    if (meterUpdateTimer) {
        clearInterval(meterUpdateTimer);
        meterUpdateTimer = null;
    }
};

module.exports = { activate, deactivate };
