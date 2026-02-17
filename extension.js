// extension.js
const vscode = require('vscode');
const { 
    initializeLogger, 
    isLoggingEnabled,
    applyVSCodeLoggingSettings,
    createLogWrapperFunc
} = require('./logger');
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
    // #region agent log
    fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extension.js:activate',message:'activate_start',data:{hasContext:!!context,extensionPath:context?.extensionPath?.slice(-40)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    // Validate context parameter
    if (!context) {
        console.error('VibeSwitch: ERROR - activate() called with null/undefined context');
        return;
    }
    
    // Create extension runtime state and DI container
    const state = new ExtensionState();
    const container = new DIContainer();
    state.extensionContext = context;
    // #region agent log
    fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extension.js:activate',message:'storage_uris',data:{hasStorageUri:!!context?.storageUri,hasGlobalStorageUri:!!context?.globalStorageUri,storagePath:context?.storageUri?.fsPath?.slice(-50),globalPath:context?.globalStorageUri?.fsPath?.slice(-50)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    // Initialize logger early for error reporting
    let log = null;
    
    try {
        // Initialize output channel using direct VS Code API (extension-level concern, not module-specific)
        state.outputChannel = vscode.window.createOutputChannel('VibeSwitch');
        // context.subscriptions is an array of disposables (e.g., event listeners, output channels, status bar items).
        // When the extension deactivates, VS Code calls dispose() on each item in this array.
        // Pushing state.outputChannel ensures it's cleaned up automatically.
        context.subscriptions.push(state.outputChannel);
        
        initializeLogger(state.outputChannel);
        // Apply logging settings from VS Code configuration (disableLogging/debugLogging)
        applyVSCodeLoggingSettings(context);
        
        // Create log wrapper function for extension-level code
        log = createLogWrapperFunc();
        
        // Fixed mode for awareness/dashboard (no mode switching)
        state.currentMode = 'vibe';
        
        // ========== MULTI-AGENT ARCHITECTURE INITIALIZATION ==========
        // Initialize agents integration if enabled
        let agentsIntegration = null;
        try {
            const agentsEnabled = vscode.workspace.getConfiguration('vibeswitch.agents').get('enabled', false);
            if (agentsEnabled) {
                const { AgentsExtensionIntegration } = require('./business_modules/agents');
                agentsIntegration = new AgentsExtensionIntegration(context, state, log);
                agentsIntegration.start();
                context.subscriptions.push(agentsIntegration);
                state.agentsIntegration = agentsIntegration;
                log('VibeSwitch: Agents integration initialized');
            }
        } catch (error) {
            log(`VibeSwitch: Error initializing agents integration: ${error.message}`, true, false);
        }
        // ========== END MULTI-AGENT ARCHITECTURE ==========
        
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
            stopAwarenessMonitor,
            initFileDecorations
        } = helpers;
        
        // Register awareness engine cleanup for extension deactivation
        // This ensures proper resource cleanup when VS Code disposes the extension
        context.subscriptions.push({
            dispose: async () => {
                if (stopAwarenessMonitor) {
                    await stopAwarenessMonitor();
                }
            }
        });

        // Restore window border and clear frame-flash timeout on deactivate
        const { disposeFrameFlash } = require('./ui/frameFlash');
        context.subscriptions.push({ dispose: disposeFrameFlash });

        // Create Report status bar item early (before any await) so it appears even if later steps fail
        const showInStatusBar = vscode.workspace.getConfiguration('vibeswitch').get('showInStatusBar', true);
        state.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            1000
        );
        state.statusBarItem.name = 'VibeSwitch Report';
        state.statusBarItem.command = 'vibeswitch.openDashboard';
        state.statusBarItem.text = 'Report';
        state.statusBarItem.tooltip = 'Open VibeSwitch dashboard';
        context.subscriptions.push(state.statusBarItem);
        if (showInStatusBar) {
            state.statusBarItem.show();
        }
        log('VibeSwitch: Status bar item (Report) created' + (showInStatusBar ? ' and shown' : ' (hidden by showInStatusBar)'));
        
        // Set callbacks for UI updates and UsageStats integration
        const { refreshDashboardIfOpen } = require('./ui/dashboardDisplay');
        awarenessEngine.setCallbacks({
            onScoreUpdate: () => {
                safe('onScoreUpdate', () => {
                    if (updateAwarenessMeter) {
                        updateAwarenessMeter();
                    }
                    refreshDashboardIfOpen(awarenessEngine, state).catch(() => {});
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
        
        // Initialize file decorations early (needed for file coloring regardless of mode)
        // This ensures file decorations are available even if monitor doesn't start
        if (initFileDecorations) {
            initFileDecorations();
        }

        // Dashboard content provider: fixed URI so clicking the status bar circle again focuses the same tab and refreshes content
        const { DashboardContentProvider } = require('./ui/dashboardDisplay');
        const dashboardContentProvider = new DashboardContentProvider();
        context.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider('vibeswitch-dashboard', dashboardContentProvider)
        );
        state.dashboardContentProvider = dashboardContentProvider;

        // Register all commands
        registerCommands(context, commandHandlers, log);
        
        // Refresh status bar (single Report item)
        if (switchModeInStatusBar) {
            switchModeInStatusBar();
        }
        
        // Start awareness monitor once
        // The monitor tracks AI suggestions and calculates awareness score in all modes
        if (startAwarenessMonitor) {
            await startAwarenessMonitor();
        }
        // Ensure awareness meter is updated
        if (updateAwarenessMeter) {
            updateAwarenessMeter();
        }

        // Ensure Report status bar item is visible (in case it was hidden earlier in activation)
        if (state.statusBarItem && vscode.workspace.getConfiguration('vibeswitch').get('showInStatusBar', true)) {
            state.statusBarItem.show();
        }

        // Re-show Report item after workbench settles (multiple attempts in case layout/host is slow)
        const showReportIfEnabled = () => {
            if (state.statusBarItem && vscode.workspace.getConfiguration('vibeswitch').get('showInStatusBar', true)) {
                state.statusBarItem.show();
            }
        };
        [200, 800, 2000].forEach((ms) => {
            const t = setTimeout(showReportIfEnabled, ms);
            context.subscriptions.push({ dispose: () => clearTimeout(t) });
        });

        // When user toggles "Show in status bar", show or hide the Report item without reload
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (!e.affectsConfiguration('vibeswitch.showInStatusBar') || !state.statusBarItem) return;
                const show = vscode.workspace.getConfiguration('vibeswitch').get('showInStatusBar', true);
                if (show) state.statusBarItem.show(); else state.statusBarItem.hide();
            })
        );

        // Start research module when enabled: gathers Sonar, token usage, extension metrics and sends to external agent (Fastify/Cloud Run)
        if (state.researchService) {
            state.researchService.start();
            context.subscriptions.push({
                dispose: () => {
                    if (state.researchService && typeof state.researchService.stop === 'function') {
                        state.researchService.stop();
                    }
                }
            });
            log('VibeSwitch: Research module started (data sent to external analysis agent)');
        }
        // Start daily research when enabled: fetches arxiv, Medium, LinkedIn, X and writes report to researchReview/reports once per day
        if (state.dailyResearchRunner) {
            state.dailyResearchRunner.start();
            context.subscriptions.push({
                dispose: () => {
                    if (state.dailyResearchRunner && typeof state.dailyResearchRunner.stop === 'function') {
                        state.dailyResearchRunner.stop();
                    }
                }
            });
            log('VibeSwitch: Daily research started (reports in researchReview/reports)');
        }
        
        log('VibeSwitch: File watcher disabled - mode only changes on explicit user action');
        
        // Setup usage stats listeners
        setupUsageStatsListeners(context, state);
        
    } catch (error) {
        const errorMessage = `VibeSwitch: Error during activation: ${error.message}`;
        const stackTrace = error.stack ? `Stack trace: ${error.stack}` : '';
        // SyntaxError often includes fileName/lineNumber in stack; log fully for "Invalid or unexpected token"
        const detail = error instanceof SyntaxError && error.stack
            ? `${error.message}\n${error.stack}`
            : errorMessage;

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
        console.error('VibeSwitch activation detail:', detail);

        // Ensure Report status bar is visible so user can still open dashboard
        if (state.statusBarItem && vscode.workspace.getConfiguration('vibeswitch').get('showInStatusBar', true)) {
            state.statusBarItem.show();
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