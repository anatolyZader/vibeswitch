// extension.js

const vscode = require('vscode');
const { window, workspace, commands, StatusBarAlignment } = vscode;
const { createLogger, setDisableLogging } = require('./logger');
const UsageStatsManager = require('./userStats');
const detectCurrentMode = require('./mode/detectCurrentMode');
const AwarenessMonitor = require('./awarenessMonitor');
const DIContainer = require('./diContainer');
const initializeHelpers = require('./helpers/initializeHelpers');
const safe = require('./helpers/safe');

// Development flag: Set to true to disable all output logging
const DISABLE_LOGGING = true;

// Register all commands
// Internal helper - errors propagate to caller (boundary: activate)
const registerCommands = (context, commandHandlers) => {
    if (!context || !commandHandlers) {
        throw new Error('registerCommands: context and commandHandlers are required');
    }
    
    Object.entries(commandHandlers).forEach(([command, handler]) => {
        if (!command || !handler) {
            return; // Skip invalid entries silently
        }
        context.subscriptions.push(commands.registerCommand(command, handler));
    });
};

// Setup usage stats listeners
// Internal helper - errors propagate to caller (boundary: activate)
// Event listeners are boundaries - use safe() wrapper
const setupUsageStatsListeners = (context, state) => {
    if (!context || !state) {
        throw new Error('setupUsageStatsListeners: context and state are required');
    }
    
    context.subscriptions.push(
        workspace.onDidOpenTextDocument((doc) => {
            safe('trackFileOpen', () => {
                state.usageStats?.trackFileOpen(doc.fileName);
            });
        }),
        workspace.onDidChangeTextDocument((event) => {
            safe('trackEdit', () => {
                if (state.usageStats && event.contentChanges.length > 0) {
                    state.usageStats.trackEdit();
                }
            });
        }),
        workspace.onDidSaveTextDocument(() => {
            safe('trackFileSave', () => {
                state.usageStats?.trackFileSave();
            });
        }),
        { 
            dispose: () => {
                safe('endSession', () => {
                    state.usageStats?.endSession();
                });
            }
        }
    );
};

// Main activation function
function activate(context) {
    // Validate context parameter
    if (!context) {
        // Cannot use logger here as it's not initialized yet
        // Use console.error as fallback for critical initialization errors
        console.error('VibeSwitch: ERROR - activate() called with null/undefined context');
        return;
    }
    
    // Create extension state
    const state = new DIContainer();
    state.extensionContext = context;
    
    // Initialize logger early for error reporting
    let log = null;
    
    try {
        // Initialize output channel
        state.outputChannel = window.createOutputChannel('VibeSwitch');
        context.subscriptions.push(state.outputChannel);
        
        // Initialize logger with output channel and set logging preference centrally
        createLogger(state.outputChannel);
        setDisableLogging(DISABLE_LOGGING);
        
        // Get logger function for error reporting
        const { getLogger } = require('./logger');
        const logger = getLogger();
        log = (message, showOutput = false, isError = false) => {
            if (logger) {
                logger.log(message, isError);
            }
            if (showOutput && state.outputChannel) {
                state.outputChannel.appendLine(message);
            }
        };
        
        // Initialize managers
        state.usageStats = new UsageStatsManager(context);
        
        // Initialize awareness monitor
        state.awarenessMonitor = new AwarenessMonitor(state.usageStats);
        
        // Initialize helpers with state
        const helpers = initializeHelpers(state, DISABLE_LOGGING);
        const { 
            log: helperLog, 
            switchModeInStatusBar, 
            updateFileColorsForMode, 
            commandHandlers 
        } = helpers;
        
        // Use helper log function if available
        log = helperLog || log;
        
        // Initialize status bar items using VS Code API
        state.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
        state.awarenessBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 99);
        state.statusBarItem.command = 'vibeswitch.switchMode';
        state.statusBarItem.show();
        
        // Register all commands
        registerCommands(context, commandHandlers);
        
        // Detect initial mode from file
        let initialMode = null;
        try {
            initialMode = detectCurrentMode();
            log(`VibeSwitch: Detected initial mode from file: ${initialMode}`);
        } catch (error) {
            log(`ERROR detecting initial mode: ${error.message}`, false, true);
            // Continue with null mode - graceful degradation
        }
        
        // Update status bar and file colors
        switchModeInStatusBar(initialMode);
        if (initialMode) {
            updateFileColorsForMode();
        }
        
        // Disable file-based mode detection completely
        // This prevents all flashing and race conditions
        log('VibeSwitch: File watcher disabled - mode only changes on explicit user action');
        
        setupUsageStatsListeners(context, state);
    } catch (error) {
        // Use logger if available, otherwise fallback to console and output channel
        const errorMessage = `VibeSwitch: Error during activation: ${error.message}`;
        const stackTrace = error.stack ? `Stack trace: ${error.stack}` : '';
        
        if (log) {
            log(errorMessage, true, true);
            log(stackTrace, false, true);
        } else {
            // Fallback for critical errors before logger is initialized
            console.error(errorMessage);
            if (state.outputChannel) {
                state.outputChannel.appendLine(`ERROR: ${errorMessage}`);
                state.outputChannel.appendLine(stackTrace);
                state.outputChannel.show(true);
            }
        }
        
        // Show user-facing error message
        window.showErrorMessage(`VibeSwitch activation failed: ${error.message}`);
    }
}

// Deactivation function
function deactivate() {
    try {
        // Cleanup is handled by context.subscriptions
        // VS Code automatically disposes all subscriptions when extension deactivates
    } catch (error) {
        // Log error but don't throw - deactivation should always succeed
        // Use console.error as fallback since logger may not be available
        console.error('VibeSwitch: Error during deactivation:', error);
    }
}

module.exports = { activate, deactivate };
