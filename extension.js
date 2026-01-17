// extension.js

console.log('[DEBUG] VibeSwitch extension.js module loading...');
const vscode = require('vscode');
console.log('[DEBUG] VibeSwitch vscode module loaded', {hasVscode:vscode!==null,hasWindow:vscode.window!==null});
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
    
    console.log('[DEBUG] registerCommands called', {commandCount:Object.keys(commandHandlers).length,hasShowStatusBar:'vibeswitch.showStatusBar' in commandHandlers});
    const allCommands = Object.keys(commandHandlers);
    console.log('[DEBUG] Commands to register:', allCommands);
    
    Object.entries(commandHandlers).forEach(([command, handler]) => {
        if (!command || !handler) {
            if (log && process.env.NODE_ENV !== 'production') {
                log(`WARNING: Skipping invalid command handler - command: ${command || 'undefined'}, handler: ${handler ? 'exists' : 'missing'}`, false, false);
            }
            console.log(`[DEBUG] Skipping invalid command: ${command}`);
            return;
        }
        try {
            console.log(`[DEBUG] Registering command: ${command}`);
        context.subscriptions.push(vscode.commands.registerCommand(command, handler));
            console.log(`[DEBUG] Successfully registered: ${command}`);
        } catch (error) {
            console.error(`[DEBUG] ERROR registering command ${command}:`, error.message);
            if (log) {
                log(`ERROR registering command ${command}: ${error.message}`, true, true);
            }
        }
    });
    console.log('[DEBUG] registerCommands completed');
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
    // #region agent log
    console.log('[DEBUG] VibeSwitch activate() called', {hasContext:context!==null});
    // #endregion
    // Validate context parameter
    if (!context) {
        console.error('VibeSwitch: ERROR - activate() called with null/undefined context');
        return;
    }
    
    // Create extension runtime state and DI container
    console.log('[DEBUG] Creating ExtensionState and DIContainer');
    const state = new ExtensionState();
    const container = new DIContainer();
    state.extensionContext = context;
    console.log('[DEBUG] State and container created, entering try block');
    
    // Initialize logger early for error reporting
    let log = null;
    
    try {
        // Initialize output channel using direct VS Code API (extension-level concern, not module-specific)
        console.log('[DEBUG] About to create output channel');
        state.outputChannel = vscode.window.createOutputChannel('VibeSwitch');
        console.log('[DEBUG] Output channel created', {hasOutputChannel:state.outputChannel!==null});
        // context.subscriptions is an array of disposables (e.g., event listeners, output channels, status bar items).
        // When the extension deactivates, VS Code calls dispose() on each item in this array.
        // Pushing state.outputChannel ensures it's cleaned up automatically.;
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
        const { awarenessEngine } = compositionRoot.compose(context, state, container);
        
        // Subscribe usage stats service for cleanup
        context.subscriptions.push(state.usageStats);
        
        // Wire awarenessEngine to extension state
        // awarenessEngine implements all required methods: start(), stop(), getScore(), updateScore(), getStatus(), handleExternallyCreatedFile()
        state.awarenessEngine = awarenessEngine;
        
        // Initialize helpers with state
        const loggingDisabled = !loggingEnabled; // Calculate from loggingEnabled (avoid shadowing imported function)
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
        
        // Initialize status bar items using direct VS Code API
        // #region agent log
        const logData1 = {location:'extension.js:185',message:'Creating status bar items',data:{hasWindow:vscode.window!==null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
        console.log('[DEBUG]', JSON.stringify(logData1));
        if (state.outputChannel) state.outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData1)}`);
        fetch('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData1)}).catch(()=>{});
        // #endregion
        state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        state.awarenessBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        // #region agent log
        const logData2 = {location:'extension.js:188',message:'Status bar items created',data:{statusBarItem:state.statusBarItem!==null,awarenessBarItem:state.awarenessBarItem!==null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
        console.log('[DEBUG]', JSON.stringify(logData2));
        if (state.outputChannel) state.outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData2)}`);
        fetch('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch(()=>{});
        // #endregion
        state.statusBarItem.command = 'vibeswitch.switchMode';
        
        // Register status bar items for cleanup
        context.subscriptions.push(state.statusBarItem);
        context.subscriptions.push(state.awarenessBarItem);
        
        // Set initial text to ensure status bar is visible (will be updated by switchModeInStatusBar)
        state.statusBarItem.text = '$(gear) VibeSwitch';
        state.statusBarItem.tooltip = 'VibeSwitch: Initializing...';
        // #region agent log
        const logData3 = {location:'extension.js:196',message:'Calling show() on statusBarItem',data:{text:state.statusBarItem.text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'};
        console.log('[DEBUG]', JSON.stringify(logData3));
        if (state.outputChannel) state.outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData3)}`);
        fetch('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch(()=>{});
        // #endregion
        state.statusBarItem.show();
        
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
        
        // Update status bar and file colors (only if valid mode detected)
        // #region agent log
        const logData8 = {location:'extension.js:222',message:'Before switchModeInStatusBar call',data:{initialMode:initialMode,hasSwitchModeInStatusBar:switchModeInStatusBar!==null,statusBarItem:state.statusBarItem!==null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
        console.log('[DEBUG]', JSON.stringify(logData8));
        if (state.outputChannel) state.outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData8)}`);
        fetch('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData8)}).catch(()=>{});
        // #endregion
        if (initialMode) {
            switchModeInStatusBar(initialMode);
            // #region agent log
            const logData9 = {location:'extension.js:224',message:'After switchModeInStatusBar with initialMode',data:{initialMode:initialMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
            console.log('[DEBUG]', JSON.stringify(logData9));
            if (state.outputChannel) state.outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData9)}`);
            fetch('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData9)}).catch(()=>{});
            // #endregion
            updateFileColorsForMode();
            // Start awareness monitor if in DEV mode
            if (initialMode === 'dev' && startAwarenessMonitor) {
                await startAwarenessMonitor();
            }
            // Ensure awareness meter is updated even if monitor doesn't start
            if (updateAwarenessMeter) {
                updateAwarenessMeter();
            }
        } else {
            // Set default mode if detection failed
            log('VibeSwitch: Using default mode (vibe)');
            // #region agent log
            const logData10 = {location:'extension.js:236',message:'Calling switchModeInStatusBar with default vibe mode',data:{hasSwitchModeInStatusBar:switchModeInStatusBar!==null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'};
            console.log('[DEBUG]', JSON.stringify(logData10));
            if (state.outputChannel) state.outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData10)}`);
            fetch('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData10)}).catch(()=>{});
            // #endregion
            switchModeInStatusBar('vibe');
            // #region agent log
            const logData11 = {location:'extension.js:237',message:'After switchModeInStatusBar with default vibe',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'};
            console.log('[DEBUG]', JSON.stringify(logData11));
            if (state.outputChannel) state.outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData11)}`);
            fetch('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData11)}).catch(()=>{});
            // #endregion
            updateFileColorsForMode(); // Also update file colors for default mode
            // Don't start monitor in vibe mode
            // Ensure awareness meter is updated (will hide in vibe mode)
            if (updateAwarenessMeter) {
                updateAwarenessMeter();
            }
        }
        
        log('VibeSwitch: File watcher disabled - mode only changes on explicit user action');
        
        // Setup usage stats listeners
        setupUsageStatsListeners(context, state);
        
    } catch (error) {
        const errorMessage = `VibeSwitch: Error during activation: ${error.message}`;
        const stackTrace = error.stack ? `Stack trace: ${error.stack}` : '';
        // #region agent log
        const logData12 = {location:'extension.js:250',message:'Activation error caught',data:{error:error.message,hasStatusBarItem:state.statusBarItem!==null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'};
        console.log('[DEBUG]', JSON.stringify(logData12));
        if (state.outputChannel) state.outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData12)}`);
        fetch('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData12)}).catch(()=>{});
        // #endregion
        
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

console.log('[DEBUG] VibeSwitch module.exports setting up', {hasActivate:typeof activate==='function',hasDeactivate:typeof deactivate==='function'});
module.exports = { activate, deactivate };
console.log('[DEBUG] VibeSwitch module.exports complete');