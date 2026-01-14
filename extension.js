// extension.js

const vscode = require('vscode');
const { createLogger, setDisableLogging } = require('./logger');
const modeDetection = require('./business_modules/mode/app/modeDetection');
const AwarenessService = require('./business_modules/awareness/app/awarenessService');
const AwarenessController = require('./business_modules/awareness/input/awarenessController');
const DIContainer = require('./diContainer');
const initializeHelpers = require('./helpers/initializeHelpers');
const { registerCommands, setupUsageStatsListeners } = require('./helpers/extensionSetup');
const { createExtensionComposition } = require('./diCompositionRoot');
const safe = require('./helpers/safe');

/**
 * Get logging preference from VS Code settings
 * @param {vscode.ExtensionContext} context - Extension context
 * @returns {boolean} True if logging should be disabled
 */
function getDisableLogging(context) {
    const config = vscode.workspace.getConfiguration('vibeswitch');
    // Default to false (enable logging) unless explicitly disabled
    // Can be overridden by NODE_ENV=production
    if (process.env.NODE_ENV === 'production') {
        return true;
    }
    return config.get('disableLogging', false);
}

/**
 * Create disposable event listeners for domain events
 * @param {EventEmitter} eventEmitter - Event emitter from messaging adapter
 * @param {Object} state - Extension state
 * @returns {vscode.Disposable} Disposable that removes all listeners
 */
function createEventListenersDisposable(eventEmitter, state) {
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
        // Initialize output channel using direct VS Code API (extension-level concern, not module-specific)
        state.outputChannel = vscode.window.createOutputChannel('VibeSwitch');
        context.subscriptions.push(state.outputChannel);
        
        // Get logging preference from settings
        const disableLogging = getDisableLogging(context);
        
        // Initialize logger with output channel and set logging preference centrally
        createLogger(state.outputChannel);
        setDisableLogging(disableLogging);
        
        // Get logger function for error reporting
        // Logger already writes to outputChannel, so we just use logger directly
        const { getLogger } = require('./logger');
        const rawLogger = getLogger();
        
        // Normalize logger interface for controllers/services (simple error/info methods)
        // This decouples controllers from logger implementation details
        const normalizedLogger = {
            error: (message, error = null) => {
                if (rawLogger) {
                    const errorMessage = error ? `${message}: ${error.message || error}` : message;
                    rawLogger.log(errorMessage, true, false); // force=true, show=false
                }
            },
            info: (message) => {
                if (rawLogger) {
                    rawLogger.log(message, false, false);
                }
            }
        };
        
        // Legacy log function for extension-level code
        log = (message, showOutput = false, isError = false) => {
            if (rawLogger) {
                // logger.log() already writes to outputChannel via _writeLog()
                // showOutput parameter controls whether to show the output channel
                rawLogger.log(message, isError, showOutput);
            }
        };
        
        // ============================================
        // Create Extension Composition
        // ============================================
        // This creates all adapters, domain services, and stores them in DI container
        // Composes all modules: awareness, usage-stats, mode, etc.
        const composition = createExtensionComposition(context, state);
        
        // Extract module compositions
        const { adapters, domainServices } = composition.awareness;
        const { usageStatsService } = composition.usageStats;
        
        // Initialize managers
        state.usageStats = usageStatsService;
        // Register UsageStatsManager for cleanup (it implements dispose())
        context.subscriptions.push(state.usageStats);
        
        // Create AwarenessService with explicit dependencies (Ports and Adapters pattern)
        const awarenessService = new AwarenessService({
            vscodeAdapter: adapters.vscodeAdapter,
            persistenceAdapter: adapters.persistenceAdapter,
            messagingAdapter: adapters.messagingAdapter,
            loggerAdapter: adapters.loggerAdapter,
            fileSystemAdapter: adapters.fileSystemAdapter,
            idGeneratorAdapter: adapters.idGeneratorAdapter,
            hashGeneratorAdapter: adapters.hashGeneratorAdapter,
            rangeOperationServiceD: domainServices.rangeOperationServiceD,
            uriPathOperationServiceD: domainServices.uriPathOperationServiceD,
            changeClassificationServiceD: domainServices.changeClassificationServiceD
        });
        
        // Register service in DI container (before creating controller)
        state.register('awarenessService', awarenessService);
        
        // Create controller with explicit dependencies (not whole state container)
        // Controller throws errors; composition root handles UI (no vscodeAdapter needed)
        // Pass normalized logger interface (error/info methods)
        const awarenessController = new AwarenessController({
            awarenessService: awarenessService,
            logger: normalizedLogger
        });
        state.register('awarenessController', awarenessController);
        
        // Store controller in state for backward compatibility with existing code
        // (will be removed once all code uses DI container)
        state.awarenessMonitor = awarenessController;
        
        // Initialize helpers with state
        const helpers = initializeHelpers(state, disableLogging);
        const { 
            log: helperLog, 
            switchModeInStatusBar, 
            updateFileColorsForMode, 
            commandHandlers,
            updateAwarenessMeter
        } = helpers;
        
        // Use helper log function if available
        log = helperLog || log;
        
        // Set callbacks for UI updates only (not UsageStats - that's handled by events)
        // The service publishes domain events, and we subscribe to those events for UsageStats
        // This avoids double-counting and keeps concerns separated
        awarenessService.setCallbacks({
            onScoreUpdate: () => {
                safe('onScoreUpdate', () => {
                    if (updateAwarenessMeter) {
                        updateAwarenessMeter();
                    }
                });
            }
        });
        
        // Subscribe to domain events for UsageStats integration
        // Use disposable pattern for proper cleanup
        const eventEmitter = adapters.messagingAdapter.getEventEmitter();
        const eventListenersDisposable = createEventListenersDisposable(eventEmitter, state);
        context.subscriptions.push(eventListenersDisposable);
        
        // Initialize status bar items using direct VS Code API (extension-level concern)
        state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        state.awarenessBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        state.statusBarItem.command = 'vibeswitch.switchMode';
        state.statusBarItem.show();
        
        // Register status bar items for cleanup
        context.subscriptions.push(state.statusBarItem);
        context.subscriptions.push(state.awarenessBarItem);
        
        // Register all commands
        registerCommands(context, commandHandlers, log);
        
        // Detect initial mode from file
        let initialMode = null;
        try {
            initialMode = modeDetection();
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
        
        // Setup usage stats listeners
        setupUsageStatsListeners(context, state);
        
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
