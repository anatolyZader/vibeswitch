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
const { getGlobalKey, setGlobalKeySync } = require('./cross_cut_modules/storage-uri/globalKeysStorage');
const {
    ModeManager,
    HooksJsonGuard,
    CapabilitySelfTest,
    WorkspaceAllowlist,
    AlertFileEditDetector,
    KeypairManager,
    ApprovalManager
} = require('./business_modules/mode-enforcement');

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
        
        // ========== MODE-ENFORCEMENT INITIALIZATION ==========
        // Initialize early before any other components
        
        // 1. Mode Manager - source of truth in disk (globalStorageUri), mirror to filesystem
        const modeManager = new ModeManager(context);
        modeManager.syncToFileSystem();  // Ensure filesystem is in sync on startup
        log('VibeSwitch: ModeManager initialized');
        
        // 2. Workspace Allowlist - sync current workspaces
        const workspaceAllowlist = new WorkspaceAllowlist();
        if (vscode.workspace.workspaceFolders) {
            workspaceAllowlist.syncFromWorkspace(vscode.workspace.workspaceFolders);
        }
        log('VibeSwitch: WorkspaceAllowlist synced');
        
        // 3. Sync hooks and lib from extension to ~/.vibeswitch (so Cursor runs latest hook code)
        const capabilitySetup = require('./business_modules/mode-enforcement/app/capabilitySetup');
        capabilitySetup.runSetup(context.extensionPath);

        // 4. Capability Self-Test - verify setup integrity
        const selfTest = new CapabilitySelfTest();
        let testResult = selfTest.run();
        // #region agent log
        fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extension.js:selftest',message:'selftest_result',data:{passed:testResult.passed,errors:testResult.errors,warningCount:testResult.warnings?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        if (!testResult.passed) {
            log(`VibeSwitch: Capability self-test FAILED: ${testResult.errors.join(', ')}`, true, true);
            vscode.window.showWarningMessage(
                `VibeSwitch: Setup verification failed: ${testResult.errors[0]}. Capability enforcement may not work correctly.`
            );
            const setupPromptShown = getGlobalKey(context, 'vibeswitch.setupPromptShown', false);
            // #region agent log
            fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extension.js:setup_prompt',message:'first_run_setup',data:{setupPromptShown},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
            // #endregion
            if (!setupPromptShown) {
                setGlobalKeySync(context, 'vibeswitch.setupPromptShown', true);
                vscode.window.showInformationMessage(
                    'VibeSwitch: Copy hook scripts and canonical.js to ~/.vibeswitch?',
                    'Setup',
                    'Later'
                ).then(choice => {
                    // #region agent log
                    fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extension.js:setup_choice',message:'user_choice',data:{choice:choice||'dismissed'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
                    // #endregion
                    if (choice === 'Setup') {
                        const capabilitySetup = require('./business_modules/mode-enforcement/app/capabilitySetup');
                        const setupResult = capabilitySetup.runSetup(context.extensionPath);
                        // #region agent log
                        fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extension.js:setup_done',message:'setup_after_prompt',data:{success:setupResult.success,copied:setupResult.copied?.length,errors:setupResult.errors?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
                        // #endregion
                        if (setupResult.success) {
                            testResult = selfTest.run();
                            if (testResult.passed) {
                                vscode.window.showInformationMessage('VibeSwitch: Setup complete. Capability self-test passed.');
                            } else {
                                vscode.window.showWarningMessage(`VibeSwitch: Scripts copied. Self-test still failing: ${testResult.errors[0]}. Ensure jq is installed.`);
                            }
                        } else {
                            vscode.window.showErrorMessage(`VibeSwitch: Setup failed: ${setupResult.errors[0]}`);
                        }
                    }
                });
            }
        } else {
            log('VibeSwitch: Capability self-test passed');
        }
        if (testResult.warnings.length > 0) {
            log(`VibeSwitch: Warnings: ${testResult.warnings.join(', ')}`);
        }
        
        // Start periodic self-test
        selfTest.startPeriodic((result) => {
            log(`VibeSwitch: Periodic self-test FAILED: ${result.errors.join(', ')}`, true, false);
        });
        context.subscriptions.push({ dispose: () => selfTest.dispose() });
        
        // 5. HooksJsonGuard - watch and protect hooks.json
        const hooksGuard = new HooksJsonGuard(context, modeManager);
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            hooksGuard.start(vscode.workspace.workspaceFolders[0].uri.fsPath);
        }
        context.subscriptions.push({ dispose: () => hooksGuard.dispose() });
        log('VibeSwitch: HooksJsonGuard started');
        
        // 6. AlertFileEditDetector - monitor for unapproved edits with auto-revert
        const autoRevertEnabled = vscode.workspace.getConfiguration('vibeswitch').get('autoRevertUnapprovedEdits', false);
        const alertDetector = new AlertFileEditDetector(modeManager, { autoRevert: autoRevertEnabled });
        alertDetector.createBadge(context);
        alertDetector.start();
        context.subscriptions.push({ dispose: () => alertDetector.dispose() });
        log(`VibeSwitch: AlertFileEditDetector started (autoRevert: ${autoRevertEnabled})`);
        
        // 7. KeypairManager - Ed25519 keypair for token signing
        const keypairManager = new KeypairManager(context);
        await keypairManager.initialize();
        log('VibeSwitch: KeypairManager initialized');
        
        // 8. ApprovalManager - MCP patch request approval workflow
        const approvalManager = new ApprovalManager(context, keypairManager, modeManager);
        approvalManager.start();
        context.subscriptions.push({ dispose: () => approvalManager.dispose() });
        log('VibeSwitch: ApprovalManager started');
        
        // Store mode-enforcement components in state for later access
        state.modeEnforcement = {
            modeManager,
            workspaceAllowlist,
            selfTest,
            hooksGuard,
            alertDetector,
            keypairManager,
            approvalManager
        };
        
        // ========== END MODE-ENFORCEMENT ==========
        
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
        const { awarenessEngine, adapters } = compositionRoot.compose(context, state, container);
        
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
            updateReportButton,
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
        state.awarenessBarItem = vscode.window.createStatusBarItem(
            'vibeswitch.reportButton',
            vscode.StatusBarAlignment.Right,
            1000
        );
        state.awarenessBarItem.name = 'VibeSwitch Report';
        state.awarenessBarItem.command = 'vibeswitch.openDashboard';
        state.awarenessBarItem.text = 'REPORT';
        state.awarenessBarItem.tooltip = 'Open VibeSwitch dashboard';
        context.subscriptions.push(state.awarenessBarItem);
        if (showInStatusBar) {
            state.awarenessBarItem.show();
        }
        log('VibeSwitch: Report status bar item created' + (showInStatusBar ? ' and shown' : ' (hidden by showInStatusBar config)'));
        
        // Set callbacks for UI updates and UsageStats integration
        awarenessEngine.setCallbacks({
            onScoreUpdate: () => {
                safe('onScoreUpdate', () => {
                    if (updateReportButton) {
                        updateReportButton();
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

        // Research module (optional): time-series collection and daily statistical analysis
        const researchResult = await compositionRoot.composeResearch(context, state, adapters);
        if (researchResult && researchResult.researchService) {
            researchResult.researchService.start();
            context.subscriptions.push({ dispose: () => researchResult.researchService.dispose() });
            state.researchService = researchResult.researchService;
            log('VibeSwitch: Research module started');
        }
        
        // Create mode indicator status bar item
        state.statusBarItem = vscode.window.createStatusBarItem(
            'vibeswitch.modeIndicator',
            vscode.StatusBarAlignment.Right,
            999
        );
        state.statusBarItem.name = 'VibeSwitch Mode';
        state.statusBarItem.command = 'vibeswitch.switchMode';
        context.subscriptions.push(state.statusBarItem);
        
        // Set initial text to ensure status bar is visible (will be updated by switchModeInStatusBar)
        state.statusBarItem.text = '$(zap) INIT';
        state.statusBarItem.tooltip = 'VibeSwitch: Initializing...';
        state.statusBarItem.show();
        
        log('VibeSwitch: Mode indicator status bar item created and shown');
        
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
        // Ensure report button is updated (updates tooltip with current score)
        if (updateReportButton) {
            updateReportButton();
        }

        // Ensure Report status bar item is visible (in case it was hidden earlier in activation)
        if (state.awarenessBarItem && vscode.workspace.getConfiguration('vibeswitch').get('showInStatusBar', true)) {
            state.awarenessBarItem.show();
        }

        // Re-show Report item after workbench settles (multiple attempts in case layout/host is slow)
        const showReportIfEnabled = () => {
            if (state.awarenessBarItem && vscode.workspace.getConfiguration('vibeswitch').get('showInStatusBar', true)) {
                state.awarenessBarItem.show();
            }
        };
        [200, 800, 2000].forEach((ms) => {
            const t = setTimeout(showReportIfEnabled, ms);
            context.subscriptions.push({ dispose: () => clearTimeout(t) });
        });

        // When user toggles "Show in status bar", show or hide the Report item without reload
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (!e.affectsConfiguration('vibeswitch.showInStatusBar') || !state.awarenessBarItem) return;
                const show = vscode.workspace.getConfiguration('vibeswitch').get('showInStatusBar', true);
                if (show) state.awarenessBarItem.show(); else state.awarenessBarItem.hide();
            })
        );
        
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
        if (state.awarenessBarItem && vscode.workspace.getConfiguration('vibeswitch').get('showInStatusBar', true)) {
            state.awarenessBarItem.show();
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