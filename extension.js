/**
 * VibeSwitch Extension - Main Entry Point
 * 
 * Orchestrates all extension functionality:
 * - Initializes usage statistics and awareness monitoring
 * - Manages status bar items and UI
 * - Handles mode switching and detection
 * - Registers commands and event listeners
 */

const vscode = require('vscode');
const UsageStatsManager = require('./usage-stats');
const AwarenessMonitor = require('./awareness-monitor');
const AwarenessMonitorModule = require('./awareness-monitor');

// Import modular components
const modeManager = require('./mode-manager');
const statusBar = require('./status-bar');
const statistics = require('./statistics');
const ui = require('./ui');

// Global state
let statusBarItem;
let awarenessBarItem;
let currentMode = null;
let usageStats = null;
let awarenessMonitor = null;
let extensionContext = null; // Stored for use in closures (command handlers)
let meterUpdateTimer = null;
let outputChannel = null;

/**
 * Main extension activation function
 * Called when VS Code activates the extension (on startup or when extension is enabled)
 */
function activate(context) {
    try {
        outputChannel = vscode.window.createOutputChannel('VibeSwitch');
        context.subscriptions.push(outputChannel);
        
        const workspaceCount = vscode.workspace.workspaceFolders?.length ?? 0;
        outputChannel.appendLine('VibeSwitch extension is now active');
        outputChannel.appendLine(`Workspace folders: ${workspaceCount}`);
        outputChannel.show(true);
        console.log('VibeSwitch extension is now active');
    } catch (error) {
        console.error('VibeSwitch: Error during activation:', error);
        outputChannel?.appendLine(`ERROR: ${error.message}`);
        outputChannel?.show(true);
    }
    
    // Store context for use in closures (command handlers need it for awareness monitor)
    extensionContext = context;
    
    // Initialize usage statistics
    usageStats = new UsageStatsManager(context);
    
    // Initialize awareness monitor (with usage statistics integration for AI-aware tracking)
    // Pass callback for immediate meter updates when score changes
    awarenessMonitor = new AwarenessMonitor(usageStats, () => {
        const msg = `VibeSwitch: Score update callback triggered, currentMode=${currentMode}`;
        console.log(msg);
        outputChannel?.appendLine(msg);
        
        if (currentMode === 'dev') {
            updateAwarenessMeter();
        }
    });
    
    console.log('VibeSwitch: AwarenessMonitor initialized with callback');
    outputChannel?.appendLine('VibeSwitch: AwarenessMonitor initialized with callback');
    
    // Set output channel for awareness monitor logging
    if (AwarenessMonitorModule.setLogOutput) {
        AwarenessMonitorModule.setLogOutput(outputChannel);
        outputChannel?.appendLine('VibeSwitch: Log output channel connected to AwarenessMonitor');
    }

    // Create status bar items
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'vibeswitch.switchMode';
    context.subscriptions.push(statusBarItem);

    // Create awareness meter bar item (appears right next to mode indicator)
    awarenessBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    awarenessBarItem.command = 'vibeswitch.showStats';
    context.subscriptions.push(awarenessBarItem);

    // Register commands
    registerCommands(context);

    // CRITICAL: Show status bar items IMMEDIATELY after creation
    // This ensures they're visible even if mode detection fails or errors occur
    if (statusBarItem) {
        statusBarItem.text = '$(gear) VibeSwitch';
        statusBarItem.tooltip = 'VibeSwitch: Initializing...';
        statusBarItem.show();
        outputChannel?.appendLine('Status bar item created and shown immediately');
    }
    
    if (awarenessBarItem) {
        awarenessBarItem.text = '$(graph)';
        awarenessBarItem.tooltip = 'Awareness meter: Initializing...';
        // Don't show yet - will be shown after mode detection
        outputChannel?.appendLine('Awareness bar item created');
    }

    // Initialize and update status bar with mode detection
    try {
        updateStatusBar();
        outputChannel?.appendLine(`Status bar updated, currentMode=${currentMode}`);
        
        // Force show status bar item one more time after update (defensive)
        if (statusBarItem) {
            statusBarItem.show();
        }
        
        // Update awareness meter (will show/hide based on mode)
        updateAwarenessMeter();
    } catch (error) {
        console.error('VibeSwitch: Error updating status bar:', error);
        outputChannel?.appendLine(`ERROR updating status bar: ${error.message}`);
        outputChannel?.appendLine(`Stack: ${error.stack}`);
        
        // Ensure status bar is still visible even on error
        if (statusBarItem) {
            statusBarItem.text = '$(alert) VibeSwitch';
            statusBarItem.tooltip = `VibeSwitch: Error - ${error.message}\nClick to switch modes`;
            statusBarItem.show();
        }
    }

    // Start awareness monitor if already in DEV mode
    if (currentMode === 'dev' && awarenessMonitor) {
        console.log('VibeSwitch: Starting awareness monitor (already in DEV mode)...');
        awarenessMonitor.start(context);
        console.log('VibeSwitch: ✅ Awareness monitor started successfully');
        
        // Update meter every 10 seconds in DEV mode
        meterUpdateTimer = setInterval(() => {
            if (currentMode === 'dev') {
                updateAwarenessMeter();
            }
        }, 10000);
        
        // Initial meter update
        updateAwarenessMeter();
    }

    // Watch for .cursorrules changes
    modeManager.watchForModeChanges(() => {
        updateStatusBar();
    });

    // Track file operations for usage statistics
    setupUsageStatsListeners(context);
}

/**
 * Registers all extension commands
 * 
 * @param {vscode.ExtensionContext} context - Extension context for subscriptions
 */
function registerCommands(context) {
    // Main mode switcher command
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.switchMode', async () => {
            ui.showModePicker(
                currentMode,
                usageStats,
                async (mode) => await switchToMode(mode),
                async () => await statistics.showUsageStatistics(usageStats)
            );
        })
    );
    
    // Quick switch commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.toVibe', async () => {
            await switchToMode('vibe');
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.toDev', async () => {
            await switchToMode('dev');
        })
    );

    // Usage statistics commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.showStats', async () => {
            await statistics.showUsageStatistics(usageStats);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.resetStats', async () => {
            await statistics.resetUsageStatistics(usageStats);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.exportStats', async () => {
            await statistics.exportUsageStatistics(usageStats);
        })
    );
    
    // Utility commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.showLogs', () => {
            if (outputChannel) {
                outputChannel.show(true);
                vscode.window.showInformationMessage('VibeSwitch logs opened in Output panel');
            }
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.showStatusBar', () => {
            if (!statusBarItem) {
                vscode.window.showErrorMessage('Status bar items not initialized. Please reload the window.');
                return;
            }
            
            statusBarItem.show();
            if (currentMode === 'dev' && awarenessBarItem) {
                awarenessBarItem.show();
            }
            
            vscode.window.showInformationMessage('VibeSwitch status bar items shown');
            outputChannel?.appendLine('Status bar items manually shown via command');
        })
    );

    // Diagnostic command to check awareness monitor status
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeswitch.diagnoseMonitor', () => {
            if (!awarenessMonitor) {
                vscode.window.showWarningMessage('Awareness Monitor: Not initialized');
                outputChannel?.appendLine('Awareness Monitor: Not initialized');
                outputChannel?.show(true);
                return;
            }

            const status = awarenessMonitor.getStatus();
            const mode = currentMode;
            
            let message = '=== Awareness Monitor Diagnostic ===\n\n';
            message += `Current Mode: ${mode || 'null'}\n`;
            message += `Monitor Active: ${status.isActive ? 'YES' : 'NO'}\n`;
            message += `Has Context: ${status.hasContext ? 'YES' : 'NO'}\n`;
            message += `Has Callback: ${status.hasCallback ? 'YES' : 'NO'}\n`;
            message += `Has Usage Stats: ${status.hasUsageStats ? 'YES' : 'NO'}\n`;
            message += `AI Suggestions: ${status.aiSuggestionsCount}\n`;
            message += `Review Debt Files: ${status.reviewDebtCount}\n`;
            message += `Current Score: ${status.currentScore}\n`;
            message += `Score Components: ${JSON.stringify(status.scores, null, 2)}\n`;
            message += `Watched Directories: ${status.watchedDirectories.length}\n`;
            if (status.watchedDirectories.length > 0) {
                status.watchedDirectories.forEach(dir => {
                    message += `  - ${dir}\n`;
                });
            }
            message += `File System Watcher: ${status.hasFileSystemWatcher ? 'ACTIVE' : 'INACTIVE'}\n`;
            message += `Update Timer: ${status.hasUpdateTimer ? 'ACTIVE' : 'INACTIVE'}\n`;
            message += `Recent Acceptances: ${status.recentAcceptances}\n`;
            message += `Workspace Folders: ${status.workspaceFolders.length}\n`;
            if (status.workspaceFolders.length > 0) {
                status.workspaceFolders.forEach(folder => {
                    message += `  - ${folder}\n`;
                });
            }

            outputChannel?.appendLine(message);
            outputChannel?.show(true);
            
            // Also show a quick summary in a message
            const summary = `Monitor: ${status.isActive ? 'ACTIVE' : 'INACTIVE'} | Mode: ${mode || 'null'} | Suggestions: ${status.aiSuggestionsCount} | Score: ${status.currentScore}`;
            vscode.window.showInformationMessage(summary);
        })
    );
}

/**
 * Sets up event listeners for usage statistics tracking
 * 
 * @param {vscode.ExtensionContext} context - Extension context for subscriptions
 */
function setupUsageStatsListeners(context) {
    // Track file opens for awareness metrics
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            usageStats?.trackFileOpen(document.fileName);
        })
    );

    // Track edits for awareness metrics
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (usageStats && event.contentChanges.length > 0) {
                usageStats.trackEdit();
            }
        })
    );

    // Track saves
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(() => {
            usageStats?.trackFileSave();
        })
    );

    // End usage statistics session on deactivation
    context.subscriptions.push({
        dispose: () => {
            usageStats?.endSession();
        }
    });
}

/**
 * Updates the status bar to reflect current mode
 * Delegates to status-bar module
 */
const updateStatusBar = () => {
    currentMode = modeManager.detectCurrentMode();
    statusBar.updateStatusBar(statusBarItem, currentMode, outputChannel);
    updateAwarenessMeter();
};

/**
 * Updates the awareness meter display
 * Delegates to status-bar module
 */
const updateAwarenessMeter = () => {
    statusBar.updateAwarenessMeter(awarenessBarItem, awarenessMonitor, currentMode, outputChannel);
};

/**
 * Starts the awareness monitor with proper timer setup
 */
const startAwarenessMonitor = () => {
    if (!awarenessMonitor || !extensionContext) {
        return;
    }
    
    awarenessMonitor.start(extensionContext);
    console.log('VibeSwitch: Started real-time awareness monitoring');
    
    // Clear any existing meter update timer
    if (meterUpdateTimer) {
        clearInterval(meterUpdateTimer);
    }
    
    // Update meter every 10 seconds in DEV mode
    meterUpdateTimer = setInterval(() => {
        if (currentMode === 'dev') {
            updateAwarenessMeter();
        }
    }, 10000);
    
    // Initial meter update
    updateAwarenessMeter();
};

/**
 * Stops the awareness monitor and clears the timer
 */
const stopAwarenessMonitor = () => {
    if (!awarenessMonitor) {
        return;
    }
    
    awarenessMonitor.stop();
    console.log('VibeSwitch: Stopped awareness monitoring (VIBE mode)');
    
    // Clear meter update timer
    if (meterUpdateTimer) {
        clearInterval(meterUpdateTimer);
        meterUpdateTimer = null;
    }
};

/**
 * Switches to the specified mode
 * Delegates to mode-manager module
 * 
 * @param {string} mode - The mode to switch to ('vibe' or 'dev')
 */
const switchToMode = async (mode) => {
    await modeManager.switchToMode(mode, {
        currentMode,
        onModeSwitched: (newMode) => {
            currentMode = newMode;
            updateStatusBar();
        },
        onMonitorStart: startAwarenessMonitor,
        onMonitorStop: stopAwarenessMonitor,
        usageStats
    });
};

/**
 * Extension deactivation function
 * Called when VS Code deactivates the extension (on shutdown or when extension is disabled)
 * 
 * Performs cleanup:
 * - Disposes status bar items
 * - Ends usage statistics session
 * - Cleans up any resources that need explicit disposal
 * 
 * Note: VS Code automatically disposes items registered in context.subscriptions
 */
const deactivate = () => {
    statusBarItem?.dispose();
    awarenessBarItem?.dispose();
    usageStats?.endSession();
    
    if (meterUpdateTimer) {
        clearInterval(meterUpdateTimer);
        meterUpdateTimer = null;
    }
};

module.exports = {
    activate,
    deactivate
};
