// extension.js

const vscode = require('vscode');
const { createLogger, setDisableLogging } = require('./logger');
const UsageStatsManager = require('./userStats');
const detectCurrentMode = require('./mode/detectCurrentMode');
const AwarenessService = require('./business_modules/awareness/app/awarenessService');
const AwarenessController = require('./business_modules/awareness/input/awarenessController');
const DIContainer = require('./diContainer');
const initializeHelpers = require('./helpers/initializeHelpers');
const safe = require('./helpers/safe');

// Development flag: Set to true to disable all output logging
const DISABLE_LOGGING = true;

// Register all commands
// Internal helper - errors propagate to caller (boundary: activate)
// Uses vscodeAdapter directly since it's central to VS Code extension development
const registerCommands = (context, commandHandlers, vscodeAdapter, log = null) => {
    if (!context || !commandHandlers || !vscodeAdapter) {
        throw new Error('registerCommands: context, commandHandlers, and vscodeAdapter are required');
    }
    
    Object.entries(commandHandlers).forEach(([command, handler]) => {
        if (!command || !handler) {
            // Log warning in development mode for missing handlers
            if (log && process.env.NODE_ENV !== 'production') {
                log(`WARNING: Skipping invalid command handler - command: ${command || 'undefined'}, handler: ${handler ? 'exists' : 'missing'}`, false, false);
            }
            return; // Skip invalid entries
        }
        context.subscriptions.push(vscodeAdapter.registerCommand(command, handler));
    });
};

// Setup usage stats listeners
// Internal helper - errors propagate to caller (boundary: activate)
// Event listeners are boundaries - use safe() wrapper
// Uses vscodeAdapter directly since it's central to VS Code extension development
// Enhanced with metadata for future AI vs human inference
const setupUsageStatsListeners = (context, state, vscodeAdapter) => {
    if (!context || !state || !vscodeAdapter) {
        throw new Error('setupUsageStatsListeners: context, state, and vscodeAdapter are required');
    }
    
    context.subscriptions.push(
        vscodeAdapter.onDidOpenTextDocument((doc) => {
            safe('trackFileOpen', () => {
                if (state.usageStats) {
                    state.usageStats.trackFileOpen(doc.fileName);
                }
            });
        }),
        vscodeAdapter.onDidChangeTextDocument((event) => {
            safe('trackEdit', () => {
                if (state.usageStats && event.contentChanges.length > 0) {
                    // Enhanced metadata for future AI vs human inference
                    const metadata = {
                        document: event.document.uri.fsPath,
                        changeCount: event.contentChanges.length,
                        timestamp: Date.now(),
                        // Future: could add file size, edit pattern analysis, etc.
                    };
                    state.usageStats.trackEdit(metadata);
                }
            });
        }),
        vscodeAdapter.onDidSaveTextDocument((document) => {
            safe('trackFileSave', () => {
                if (state.usageStats) {
                    state.usageStats.trackFileSave();
                }
            });
        })
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
        // Create adapters for Ports and Adapters pattern (early, before other initialization)
        const VSCodeAdapter = require('./infrastructure/adapters/vscodeAdapter');
        const WorkspaceStateAdapter = require('./infrastructure/adapters/workspaceStateAdapter');
        const vscodeAdapter = new VSCodeAdapter(vscode);
        const persistenceAdapter = new WorkspaceStateAdapter(context);
        
        // Store adapters in DI container (single source of truth)
        // Use DI container methods for all adapter access - no direct property assignments
        state.setAdapter('awareness', 'vscodeAdapter', vscodeAdapter);
        state.setAdapter('awareness', 'persistenceAdapter', persistenceAdapter);
        
        // Initialize output channel using adapter
        state.outputChannel = vscodeAdapter.createOutputChannel('VibeSwitch');
        context.subscriptions.push(state.outputChannel);
        
        // Initialize logger with output channel and set logging preference centrally
        createLogger(state.outputChannel);
        setDisableLogging(DISABLE_LOGGING);
        
        // Get logger function for error reporting
        // Logger already writes to outputChannel, so we just use logger directly
        const { getLogger } = require('./logger');
        const logger = getLogger();
        log = (message, showOutput = false, isError = false) => {
            if (logger) {
                // logger.log() already writes to outputChannel via _writeLog()
                // showOutput parameter controls whether to show the output channel
                logger.log(message, isError, showOutput);
            }
        };
        
        // Initialize managers
        state.usageStats = new UsageStatsManager(context);
        // Register UsageStatsManager for cleanup (it implements dispose())
        context.subscriptions.push(state.usageStats);
        
        // Initialize awareness monitor with explicit dependencies (object parameters)
        // Avoids null placeholders and makes dependencies clear
        const awarenessCallbacks = {
            onAISuggestion: (data) => {
                safe('trackAISuggestion', () => {
                    state.usageStats?.trackAISuggestion(data);
                });
            },
            onAISuggestionOutcome: (data) => {
                safe('trackAISuggestionOutcome', () => {
                    state.usageStats?.trackAISuggestionOutcome(data);
                });
            },
            onKeepAll: (data) => {
                safe('trackKeepAll', () => {
                    if (state.usageStats?.trackKeepAll) {
                        state.usageStats.trackKeepAll(data);
                    }
                });
            },
            onDebtCleared: (data) => {
                safe('trackAIDebtCleared', () => {
                    state.usageStats?.trackAIDebtCleared(data);
                });
            }
        };
        
        // Get adapters from DI container (single source of truth)
        const awarenessVscodeAdapter = state.getAdapter('awareness', 'vscodeAdapter');
        const awarenessPersistenceAdapter = state.getAdapter('awareness', 'persistenceAdapter');
        
        // Create AwarenessService with explicit dependencies (Ports and Adapters pattern)
        const awarenessService = new AwarenessService({
            vscodeAdapter: awarenessVscodeAdapter,
            persistenceAdapter: awarenessPersistenceAdapter
        });
        
        // Register service in DI container (before creating controller)
        state.register('awarenessService', awarenessService);
        
        // Create controller (thin input layer)
        const awarenessController = new AwarenessController(state);
        state.register('awarenessController', awarenessController);
        
        // Store controller in state for backward compatibility with existing code
        // (will be removed once all code uses DI container)
        state.awarenessMonitor = awarenessController;
        
        // Initialize helpers with state
        const helpers = initializeHelpers(state, DISABLE_LOGGING);
        const { 
            log: helperLog, 
            switchModeInStatusBar, 
            updateFileColorsForMode, 
            commandHandlers,
            updateAwarenessMeter
        } = helpers;
        
        // Use helper log function if available
        log = helperLog || log;
        
        // Set all callbacks for external tracking (UsageStats integration + UI updates)
        // onScoreUpdate is set after helpers are initialized so updateAwarenessMeter is available
        awarenessService.setCallbacks({
            ...awarenessCallbacks,
            onScoreUpdate: () => {
                safe('onScoreUpdate', () => {
                    if (updateAwarenessMeter) {
                        updateAwarenessMeter();
                    }
                });
            }
        });
        
        // Initialize status bar items using adapter
        const StatusBarAlignment = vscodeAdapter.StatusBarAlignment;
        state.statusBarItem = vscodeAdapter.createStatusBarItem(StatusBarAlignment.Right, 100);
        state.awarenessBarItem = vscodeAdapter.createStatusBarItem(StatusBarAlignment.Right, 99);
        state.statusBarItem.command = 'vibeswitch.switchMode';
        state.statusBarItem.show();
        
        // Register all commands using adapter
        // Get adapter from DI container (single source of truth)
        const cmdVscodeAdapter = state.getAdapter('awareness', 'vscodeAdapter');
        registerCommands(context, commandHandlers, cmdVscodeAdapter, log);
        
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
        
        // Get adapter from DI container for usage stats listeners
        const statsVscodeAdapter = state.getAdapter('awareness', 'vscodeAdapter');
        setupUsageStatsListeners(context, state, statsVscodeAdapter);
        
        // Defer non-critical initialization to improve activation time
        // Status bar is already shown, so we can defer heavy work
        queueMicrotask(() => {
            try {
                // Non-critical initialization that can happen after activation
                // This improves perceived performance
            } catch (error) {
                log(`Error in deferred initialization: ${error.message}`, false, true);
            }
        });
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
        
        // Show user-facing error message using adapter from DI container
        try {
            const errorAdapter = state.getAdapter('awareness', 'vscodeAdapter');
            if (errorAdapter) {
                errorAdapter.showErrorMessage(`VibeSwitch activation failed: ${error.message}`);
            } else if (vscode && vscode.window) {
                vscode.window.showErrorMessage(`VibeSwitch activation failed: ${error.message}`);
            }
        } catch (adapterError) {
            // Fallback if adapter not available
            if (vscode && vscode.window) {
                vscode.window.showErrorMessage(`VibeSwitch activation failed: ${error.message}`);
            }
        }
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
