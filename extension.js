// extension.js

const vscode = require('vscode');
const { 
    initializeLogger, 
    enableLogging, 
    disableLogging,
    isLoggingEnabled,
    createLogWrapperFunc
} = require('./logger');
const modeDetection = require('./business_modules/mode/app/modeDetection');
const ExtensionState = require('./extensionState');
const DIContainer = require('./diContainer');
const initializeHelpers = require('./initializeHelpers');
const safe = require('./safe');
const compositionRoot = require('./compositionRoot');



/**
 * Register all VS Code commands
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {Object} commandHandlers - Object mapping command IDs to handler functions
 * @param {Function} log - Optional logging function
 */
function registerCommands(context, commandHandlers, log = null) {
    if (!context || !commandHandlers) {
        throw new Error('registerCommands: context and commandHandlers are required');
    }
    
    Object.entries(commandHandlers).forEach(([command, handler]) => {
        if (!command || !handler) {
            if (log && process.env.NODE_ENV !== 'production') {
                log(`WARNING: Skipping invalid command handler - command: ${command || 'undefined'}, handler: ${handler ? 'exists' : 'missing'}`, false, false);
            }
            return;
        }
        context.subscriptions.push(vscode.commands.registerCommand(command, handler));
    });
}

/**
 * Setup usage statistics event listeners
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {Object} state - Extension state (must have usageStats property)
 */
function setupUsageStatsListeners(context, state) {
    if (!context || !state) {
        throw new Error('setupUsageStatsListeners: context and state are required');
    }
    
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((doc) => {
            safe('trackFileOpen', () => {
                if (state.usageStats) {
                    // Use URI string for consistency and remote workspace compatibility
                    state.usageStats.trackFileOpen(doc.uri.toString());
                }
            });
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            safe('trackEdit', () => {
                if (state.usageStats && event.contentChanges.length > 0) {
                    const metadata = {
                        // Use URI string for consistency
                        document: event.document.uri.toString(),
                        changeCount: event.contentChanges.length,
                        timestamp: Date.now(),
                    };
                    state.usageStats.trackEdit(metadata);
                }
            });
        }),
        vscode.workspace.onDidSaveTextDocument((document) => {
            safe('trackFileSave', () => {
                if (state.usageStats) {
                    state.usageStats.trackFileSave();
                }
            });
        })
    );
}

/**
 * Create disposable event listeners for UsageStats integration
 * Subscribes to awareness module domain events and forwards them to UsageStats
 * @param {EventEmitter} eventEmitter - Event emitter from messaging adapter
 * @param {Object} state - Extension state (must have usageStats property)
 * @returns {vscode.Disposable} Disposable that removes all listeners
 */
function createUsageStatsEventListenersDisposable(eventEmitter, state) {
    const handlers = {
        aiSuggestion: (payload) => {
            safe('handleAISuggestionEvent', () => {
                if (state.usageStats) {
                    state.usageStats.trackAISuggestion(payload.event);
                }
            });
        },
        aiSuggestionOutcome: (payload) => {
            safe('handleAISuggestionOutcomeEvent', () => {
                if (state.usageStats) {
                    state.usageStats.trackAISuggestionOutcome(payload.event);
                }
            });
        },
        keepAll: (payload) => {
            safe('handleKeepAllEvent', () => {
                if (state.usageStats?.trackKeepAll) {
                    state.usageStats.trackKeepAll(payload.event);
                }
            });
        },
        debtCleared: (payload) => {
            safe('handleDebtClearedEvent', () => {
                if (state.usageStats) {
                    state.usageStats.trackAIDebtCleared(payload.event);
                }
            });
        }
    };

    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
        eventEmitter.on(event, handler);
    });

    // Return disposable that removes all listeners
    return new vscode.Disposable(() => {
        Object.entries(handlers).forEach(([event, handler]) => {
            eventEmitter.off(event, handler);
        });
    });
}

// Main activation function
async function activate(context) {
    // Validate context parameter
    if (!context) {
        console.error('VibeSwitch: ERROR - activate() called with null/undefined context');
        return;
    }
    
    // Create extension runtime state and DI container
    const state = new ExtensionState();
    const container = new DIContainer();
    state.extensionContext = context;
    
    // Initialize logger early for error reporting
    let log = null;
    
    try {
        // Initialize output channel using direct VS Code API (extension-level concern, not module-specific)
        state.outputChannel = vscode.window.createOutputChannel('VibeSwitch');
        context.subscriptions.push(state.outputChannel);
        
        // Get logging preference from settings and initialize logger
        const loggingEnabled = isLoggingEnabled(context);
        initializeLogger(state.outputChannel);
        if (loggingEnabled) {
            enableLogging();
        } else {
            disableLogging();
        }
        
        // Create log wrapper function for extension-level code
        log = createLogWrapperFunc();
        
        // Compose all dependencies (adapters, services, domain services)
        const { awarenessEngine, adapters } = compositionRoot.compose(context, state, container);
        
        // Subscribe usage stats service for cleanup
        context.subscriptions.push(state.usageStats);
        
        // Wire awarenessEngine to extension state
        // awarenessEngine implements all required methods: start(), stop(), getScore(), updateScore(), getStatus(), handleExternallyCreatedFile()
        state.awarenessEngine = awarenessEngine;
        
        // Initialize helpers with state
        const loggingDisabled = !loggingEnabled; // Calculate from loggingEnabled (avoid shadowing imported function)
        const helpers = initializeHelpers(state, loggingDisabled);
        const { 
            switchModeInStatusBar, 
            updateFileColorsForMode, 
            commandHandlers,
            updateAwarenessMeter
        } = helpers;
        
        // Set callbacks for UI updates only
        awarenessEngine.setCallbacks({
            onScoreUpdate: () => {
                safe('onScoreUpdate', () => {
                    if (updateAwarenessMeter) {
                        updateAwarenessMeter();
                    }
                });
            }
        });
        
        // Subscribe to domain events for UsageStats integration
        const eventEmitter = adapters.messagingAdapter.getEventEmitter();
        const usageStatsEventListenersDisposable = createUsageStatsEventListenersDisposable(eventEmitter, state);
        context.subscriptions.push(usageStatsEventListenersDisposable);
        
        // Initialize status bar items using direct VS Code API
        state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        state.awarenessBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        state.statusBarItem.command = 'vibeswitch.switchMode';
        state.statusBarItem.show();
        
        // Register status bar items for cleanup
        context.subscriptions.push(state.statusBarItem);
        context.subscriptions.push(state.awarenessBarItem);
        
        // Explicitly show awareness bar item (updateAwarenessMeter may hide it if conditions aren't met)
        state.awarenessBarItem.show();
        
        // Initialize awareness meter display (ensures bar item is shown if in dev mode)
        if (updateAwarenessMeter) {
            updateAwarenessMeter();
        }
        
        // Register all commands
        registerCommands(context, commandHandlers, log);
        
        // Detect initial mode from file
        let initialMode = null;
        try {
            const detectedMode = modeDetection();
            initialMode = normalizeMode(detectedMode);
            if (initialMode) {
                log(`VibeSwitch: Detected initial mode from file: ${initialMode}`);
            } else {
                log(`VibeSwitch: No valid mode detected (got: ${detectedMode})`);
            }
        } catch (error) {
            log(`ERROR detecting initial mode: ${error.message}`, true, false);
        }
        
        // Update status bar and file colors (only if valid mode detected)
        if (initialMode) {
            switchModeInStatusBar(initialMode);
            updateFileColorsForMode();
        } else {
            // Set default mode if detection failed
            log('VibeSwitch: Using default mode (vibe)');
            switchModeInStatusBar('vibe');
            updateFileColorsForMode(); // Also update file colors for default mode
        }
        
        log('VibeSwitch: File watcher disabled - mode only changes on explicit user action');
        
        // Setup usage stats listeners
        setupUsageStatsListeners(context, state);
        
    } catch (error) {
        const errorMessage = `VibeSwitch: Error during activation: ${error.message}`;
        const stackTrace = error.stack ? `Stack trace: ${error.stack}` : '';
        
        if (log) {
            log(errorMessage, true, true);
            log(stackTrace, true, false);
        } else {
            console.error(errorMessage);
            if (state.outputChannel) {
                state.outputChannel.appendLine(`ERROR: ${errorMessage}`);
                state.outputChannel.appendLine(stackTrace);
                state.outputChannel.show(true);
            }
        }
        
        // Show user-facing error message
        try {
            const errorAdapter = container.getAdapter('awareness', 'vscodeAdapter');
            if (errorAdapter) {
                errorAdapter.showErrorMessage(`VibeSwitch activation failed: ${error.message}`);
            } else if (vscode && vscode.window) {
                vscode.window.showErrorMessage(`VibeSwitch activation failed: ${error.message}`);
            }
        } catch (adapterError) {
            if (vscode && vscode.window) {
                vscode.window.showErrorMessage(`VibeSwitch activation failed: ${error.message}`);
            }
        }
    }
}

/**
 * Normalize mode value to valid mode or null
 * @param {string|null|undefined} mode - Raw mode value
 * @returns {string|null} 'vibe', 'dev', or null if invalid
 */
function normalizeMode(mode) {
    if (!mode) return null;
    const normalized = String(mode).trim().toLowerCase();
    return (normalized === 'vibe' || normalized === 'dev') ? normalized : null;
}

// Deactivation function
function deactivate() {
    try {
        // Cleanup is handled by context.subscriptions
        // VS Code automatically disposes all subscriptions when extension deactivates
    } catch (error) {
        console.error('VibeSwitch: Error during deactivation:', error);
    }
}

module.exports = { activate, deactivate };
