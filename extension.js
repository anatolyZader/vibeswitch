// extension.js
const vscode = require('vscode');
const { 
    initializeLogger, 
    isLoggingEnabled,
    applyVSCodeLoggingSettings,
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
        try {
            context.subscriptions.push(vscode.commands.registerCommand(command, handler));
        } catch (error) {
            console.error(`VibeSwitch: Error registering command ${command}:`, error.message);
            if (log) {
                log(`ERROR registering command ${command}: ${error.message}`, true, true);
            }
        }
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



// Main activation function.Actual runtime call happens in the VS Code Extension Host process (Node.js), not in your code.
// VS Code Extension Host Runtime (internal code):  
// const context = createExtensionContext();
// await extensionModule.activate(context);  // ← YOUR FUNCTION IS CALLED HERE
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
        // context.subscriptions is an array of disposables (e.g., event listeners, output channels, status bar items).
        // When the extension deactivates, VS Code calls dispose() on each item in this array.
        // Pushing state.outputChannel ensures it's cleaned up automatically.;
        context.subscriptions.push(state.outputChannel);
        
        initializeLogger(state.outputChannel);
        // Apply logging settings from VS Code configuration (disableLogging/debugLogging)
        applyVSCodeLoggingSettings(context);
        
        // Create log wrapper function for extension-level code
        log = createLogWrapperFunc();
        
        // Compose all dependencies (adapters, services, domain services)
        const { awarenessEngine } = compositionRoot.compose(context, state, container);
        
        // Subscribe usage stats service for cleanup
        context.subscriptions.push(state.usageStats);
        
        // Wire awarenessEngine to extension state
        // awarenessEngine implements all required methods: start(), stop(), getScore(), updateScore(), getStatus(), handleExternallyCreatedFile()
        state.awarenessEngine = awarenessEngine;
        
        // Initialize helpers with state
        const loggingDisabled = !isLoggingEnabled(context);
        const helpers = initializeHelpers(state, container, loggingDisabled);
        const { 
            switchModeInStatusBar, 
            updateFileColorsForMode, 
            commandHandlers,
            updateAwarenessMeter,
            startAwarenessMonitor,
            initFileDecorations
        } = helpers;
        
        // Set callbacks for UI updates and UsageStats integration
        awarenessEngine.setCallbacks({
            onScoreUpdate: () => {
                safe('onScoreUpdate', () => {
                    if (updateAwarenessMeter) {
                        updateAwarenessMeter();
                    }
                });
            },
            onAISuggestion: (event) => {
                safe('onAISuggestion', () => {
                    if (state.usageStats) {
                        state.usageStats.trackAISuggestion(event);
                    }
                });
            },
            onAISuggestionOutcome: (event) => {
                safe('onAISuggestionOutcome', () => {
                    if (state.usageStats) {
                        state.usageStats.trackAISuggestionOutcome(event);
                    }
                });
            },
            onKeepAll: (event) => {
                safe('onKeepAll', () => {
                    if (state.usageStats?.trackKeepAll) {
                        state.usageStats.trackKeepAll(event);
                    }
                });
            },
            onDebtCleared: (event) => {
                safe('onDebtCleared', () => {
                    if (state.usageStats) {
                        state.usageStats.trackAIDebtCleared(event);
                    }
                });
            }
        });
        
        // Initialize status bar items using direct VS Code API with explicit IDs
        // Use Right alignment with high priority to appear prominently
        state.statusBarItem = vscode.window.createStatusBarItem(
            'vibeswitch.modeIndicator',
            vscode.StatusBarAlignment.Right,
            1000  // High priority to appear early (leftmost on right side)
        );
        state.awarenessBarItem = vscode.window.createStatusBarItem(
            'vibeswitch.awarenessMeter',
            vscode.StatusBarAlignment.Right,
            999
        );
        state.statusBarItem.name = 'VibeSwitch Mode';
        state.awarenessBarItem.name = 'VibeSwitch Awareness';
        state.statusBarItem.command = 'vibeswitch.switchMode';
        // Awareness meter is not clickable (removed command to prevent untitled editor tab popup)
        state.awarenessBarItem.command = undefined;
        
        // Register status bar items for cleanup
        context.subscriptions.push(state.statusBarItem);
        context.subscriptions.push(state.awarenessBarItem);
        
        // Set initial text to ensure status bar is visible (will be updated by switchModeInStatusBar)
        state.statusBarItem.text = '$(zap) INIT';
        state.statusBarItem.tooltip = 'VibeSwitch: Initializing...';
        state.statusBarItem.show();
        
        log('VibeSwitch: Status bar item created and shown');
        
        // Initialize file decorations early (needed for file coloring regardless of mode)
        // This ensures file decorations are available even if monitor doesn't start
        if (initFileDecorations) {
            initFileDecorations();
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
        
        // Update status bar and file colors
        if (initialMode) {
            switchModeInStatusBar(initialMode);
            updateFileColorsForMode();
        } else {
            // Set default mode if detection failed
            log('VibeSwitch: Using default mode (vibe)');
            switchModeInStatusBar('vibe');
            updateFileColorsForMode();
        }
        
        // Start awareness monitor once - it runs continuously regardless of mode
        // The monitor tracks AI suggestions and calculates awareness score in all modes
        if (startAwarenessMonitor) {
            await startAwarenessMonitor();
        }
        // Ensure awareness meter is updated
        if (updateAwarenessMeter) {
            updateAwarenessMeter();
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