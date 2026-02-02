/**
 * Command Handlers
 * All VS Code command handlers for VibeSwitch extension
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const modeSwitcher = require('./ui/modeSwitcherDisplay');
const userStatsUI = require('./ui/statsDashboardDisplay');
const { mapDomainStateToViewModel, getUnreviewedFilesForDisplay, getUnopenedAndUnreviewedForDisplay } = require('./ui/awarenessMeterDisplay');
const { triggerFlashNow } = require('./ui/frameFlash');
const dashboardDisplay = require('./ui/dashboardDisplay');

/**
 * Create command handlers with dependency injection
 * Uses adapter if available (for testing/mocking)
 * Falls back to direct VS Code API
 * Enables testability without VS Code runtime
 * @param {Object} dependencies - Injected dependencies
 * @param {Function} dependencies.log - Logging function
 * @param {Function} dependencies.switchToMode - Mode switching function
 * @param {Function} dependencies.updateFileColorsInExplorer - Function to update file name colors in Explorer
 * @param {ExtensionState} dependencies.state - Extension runtime state
 * @param {DIContainer} dependencies.container - DI container for adapters and services
 * @returns {Object} Command handlers map
 */
function commandHandlers({ log, switchToMode, updateFileColorsInExplorer, state, container }) {
    // Get vscodeAdapter from DI container for Ports and Adapters pattern
    const vscodeAdapter = container.getAdapter('awareness', 'vscodeAdapter');
    
    // Helper functions to use adapter if available, fallback to direct vscode
    const showErrorMessage = (vscodeAdapter && vscodeAdapter.showErrorMessage) ? vscodeAdapter.showErrorMessage.bind(vscodeAdapter) : vscode.window.showErrorMessage;
    const showInformationMessage = (vscodeAdapter && vscodeAdapter.showInformationMessage) ? vscodeAdapter.showInformationMessage.bind(vscodeAdapter) : vscode.window.showInformationMessage;
    const showWarningMessage = (vscodeAdapter && vscodeAdapter.showWarningMessage) ? vscodeAdapter.showWarningMessage.bind(vscodeAdapter) : vscode.window.showWarningMessage;
    const showQuickPick = (vscodeAdapter && vscodeAdapter.showQuickPick) ? vscodeAdapter.showQuickPick.bind(vscodeAdapter) : vscode.window.showQuickPick;
    const showTextDocument = (vscodeAdapter && vscodeAdapter.showTextDocument) ? vscodeAdapter.showTextDocument.bind(vscodeAdapter) : vscode.window.showTextDocument;
    const activeTextEditor = (vscodeAdapter && vscodeAdapter.activeTextEditor !== undefined) ? vscodeAdapter.activeTextEditor : vscode.window.activeTextEditor;
    // workspaceFolders is a getter that accesses this.vscode, so check if vscode exists first
    let workspaceFolders;
    try {
        workspaceFolders = (vscodeAdapter && vscodeAdapter.vscode) ? vscodeAdapter.workspaceFolders : vscode.workspace.workspaceFolders;
    } catch (error) {
        workspaceFolders = vscode.workspace.workspaceFolders;
    }
    const openTextDocument = (vscodeAdapter && vscodeAdapter.openTextDocument) ? vscodeAdapter.openTextDocument.bind(vscodeAdapter) : vscode.workspace.openTextDocument;
    return {
        'vibeswitch.switchMode': async () => {
            try {
                log(`VibeSwitch: switchMode command triggered, currentMode=${state.currentMode}`);
                modeSwitcher.showModePicker(
                    state.currentMode,
                    state.usageStats,
                    async (mode) => {
                        log(`VibeSwitch: Mode selected in picker: ${mode}`);
                        await switchToMode(mode);
                    },
                    async () => await userStatsUI.showUsageStatistics(state.usageStats)
                );
            } catch (error) {
                log(`ERROR in switchMode command: ${error.message}`, true, true);
                console.error('VibeSwitch: Error in switchMode command:', error);
                showErrorMessage(`Failed to show mode picker: ${error.message}`);
            }
        },

        'vibeswitch.toVibe': () => switchToMode('vibe'),
        'vibeswitch.toDev': () => switchToMode('dev'),

        'vibeswitch.showStats': () => userStatsUI.showUsageStatistics(state.usageStats),
        'vibeswitch.resetStats': () => userStatsUI.resetUsageStatistics(state.usageStats),
        'vibeswitch.exportStats': () => userStatsUI.exportUsageStatistics(state.usageStats),

        'vibeswitch.showLogs': () => {
            if (state.outputChannel) {
                state.outputChannel.show(true);
                showInformationMessage('VibeSwitch logs opened in Output panel');
            }
        },

        'vibeswitch.showStatusBar': () => {
            if (!state.statusBarItem) {
                showErrorMessage('Status bar items not initialized. Please reload the window.');
                return;
            }
            state.statusBarItem.show();
            if (state.currentMode === 'dev' && state.awarenessBarItem) {
                state.awarenessBarItem.show();
            }
            showInformationMessage('VibeSwitch status bar items shown');
            log('Status bar items manually shown via command');
        },

        'vibeswitch.flashWindowBorder': () => {
            try {
                triggerFlashNow();
                showInformationMessage('Cyan flash triggered. If you saw no effect, try Developer: Reload Window (extension host may be unresponsive).');
            } catch (error) {
                log(`VibeSwitch: Error triggering flash: ${error.message}`, true, false);
                showErrorMessage(`Flash failed: ${error.message}. Try Developer: Reload Window.`);
            }
        },

        'vibeswitch.restartAwarenessMeter': async () => {
            if (!state.awarenessEngine) {
                showWarningMessage('Awareness engine not initialized.');
                return;
            }
            const refreshMeter = () => {
                if (typeof state.updateAwarenessMeter === 'function') {
                    state.updateAwarenessMeter();
                }
            };
            try {
                await state.awarenessEngine.resetAwarenessState();
                refreshMeter();
                setImmediate(refreshMeter);
                if (state.fileDecorationProvider && typeof state.fileDecorationProvider.refresh === 'function') {
                    state.fileDecorationProvider.refresh();
                }
                log('VibeSwitch: Awareness state reset (suggestions, debt, score cleared to zero)');
                showInformationMessage('Awareness meter reset: suggestions, debt, and score cleared to zero.');
            } catch (error) {
                log(`VibeSwitch: Error restarting awareness meter: ${error.message}`, true, true);
                showErrorMessage(`Failed to reset: ${error.message}`);
            }
        },

        'vibeswitch.openDashboard': async () => {
            const mode = state.getMode ? state.getMode() : state.currentMode;
            await dashboardDisplay.openDashboard(state.awarenessEngine, mode, state.dashboardContentProvider, state);
        },

        'vibeswitch.showAwarenessState': () => {
            if (!state.awarenessEngine) {
                showWarningMessage('Awareness engine not initialized.');
                return;
            }
            const ch = state.outputChannel;
            if (!ch) {
                showWarningMessage('Output channel not available.');
                return;
            }
            try {
                const scoreData = state.awarenessEngine.getScore();
                const mode = state.getMode ? state.getMode() : state.currentMode;
                const { unopened, unreviewedSuggestions } = getUnopenedAndUnreviewedForDisplay(scoreData);
                let out = '';
                out += '=== VibeSwitch Awareness State ===\n\n';
                out += `Mode: ${mode || 'null'}\n`;
                out += `Risk Score (total): ${scoreData.total ?? '--'}/100 (higher = worse)\n\n`;
                out += '--- Component subscores (compose the awareness score) ---\n';
                const c = scoreData.components || {};
                out += `  Review Quality:     ${c.review ?? '--'}/40  (higher = better)\n`;
                out += `  Blind Accept Risk: ${c.blindAcceptance ?? '--'}/30  (higher = worse)\n`;
                out += `  Adaptation:         ${c.adaptation ?? '--'}/30  (higher = better)\n`;
                out += `  Debt Risk:          ${c.debt ?? '--'}/30  (higher = worse)\n\n`;
                out += '--- Suggestions ---\n';
                const s = scoreData.suggestions || {};
                out += `  Total: ${s.total ?? 0}  Pending: ${s.pending ?? 0}  Accepted: ${s.accepted ?? 0}  Rejected: ${s.rejected ?? 0}  Adapted: ${s.adapted ?? 0}\n\n`;
                out += `--- Unopened files: ${unopened.count} ---\n`;
                if (unopened.files.length === 0) {
                    out += '  (none)\n';
                } else {
                    unopened.files.forEach((f, i) => {
                        const age = (f.ageMinutes || 0) < 60 ? `${f.ageMinutes || 0}m ago` : `${Math.round((f.ageMinutes || 0) / 60)}h ago`;
                        out += `  ${i + 1}. ${f.path || f.fullPath}  (${age})\n`;
                    });
                }
                out += `\n--- Unreviewed suggestions: ${unreviewedSuggestions.count} ---\n`;
                if (unreviewedSuggestions.files.length === 0) {
                    out += '  (none)\n';
                } else {
                    unreviewedSuggestions.files.slice(0, 20).forEach((f, i) => {
                        const age = (f.ageMinutes || 0) < 60 ? `${f.ageMinutes || 0}m ago` : `${Math.round((f.ageMinutes || 0) / 60)}h ago`;
                        out += `  ${i + 1}. ${f.path || f.fullPath}  (${age})\n`;
                    });
                    if (unreviewedSuggestions.files.length > 20) {
                        out += `  ... and ${unreviewedSuggestions.files.length - 20} more\n`;
                    }
                }
                out += '\n--- Debug ---\n';
                const d = scoreData.debug || {};
                out += `  Last activity: ${d.lastActivity ?? '--'}\n`;
                out += `  Monitoring: ${d.monitoringActive ? 'Active' : 'Inactive'}\n`;
                out += `  Total tracked: ${d.totalTrackedCount ?? '--'}\n`;
                ch.clear();
                ch.append(out);
                ch.show(true);
                showInformationMessage('Awareness state written to Output (VibeSwitch).');
            } catch (error) {
                log(`VibeSwitch: Error showing awareness state: ${error.message}`, true, true);
                if (ch) {
                    ch.appendLine(`ERROR: ${error.message}`);
                    ch.show(true);
                }
                showErrorMessage(`Failed to show state: ${error.message}`);
            }
        },

        'vibeswitch.diagnoseDecorations': () => {
            if (!state.fileDecorationProvider) {
                showWarningMessage('File Decoration Provider: Not initialized');
                log(`Current mode: ${state.currentMode}`);
                log(`Awareness engine exists: ${state.awarenessEngine ? 'YES' : 'NO'}`);
                state.outputChannel?.show(true);
                return;
            }
            
            const scoreData = state.awarenessEngine?.getScore();
            let message = '=== File Decoration Provider Diagnostic ===\n\n';
            message += `Provider exists: YES\nCurrent mode: ${state.currentMode}\n`;
            message += `Awareness engine exists: ${state.awarenessEngine ? 'YES' : 'NO'}\n`;
            message += `Debug call count: ${state.fileDecorationProvider.debugCallCount || 0}\n\nScore Data:\n`;
            message += `  Debt files: ${scoreData?.debt?.files?.length || 0}\n`;
            
            scoreData?.debt?.files?.forEach((f, i) => {
                message += `    [${i}] ${f.path} (${f.fullPath})\n`;
            });
            
            message += `  Pending files: ${scoreData?.suggestions?.pendingFiles?.length || 0}\n`;
            scoreData?.suggestions?.pendingFiles?.forEach((f, i) => {
                message += `    [${i}] ${f.path} (${f.fullPath})\n`;
            });
            
            message += '\nTriggering manual refresh...\n';
            state.outputChannel?.appendLine(message);
            state.outputChannel?.show(true);
            if (updateFileColorsInExplorer) {
                updateFileColorsInExplorer();
            } else {
                state.fileDecorationProvider?.refresh();
            }
            showInformationMessage('File decoration refresh triggered. Check Output panel for details.');
        },

        'vibeswitch.detectTestingFiles': async () => {
            if (!state.awarenessEngine) {
                showWarningMessage('Awareness Engine: Not initialized');
                return;
            }
            
            const wsFolders = workspaceFolders;
            if (!workspaceFolders?.length) {
                showWarningMessage('No workspace folder found');
                return;
            }
            
            const testingPath = path.join(workspaceFolders[0].uri.fsPath, 'testing');
            try {
                await fsPromises.access(testingPath);
            } catch {
                showWarningMessage('Testing folder not found');
                return;
            }
            
            const entries = await fsPromises.readdir(testingPath);
            const files = [];
            for (const entry of entries.filter(f => f.endsWith('.js'))) {
                const filePath = path.join(testingPath, entry);
                try {
                    const stat = await fsPromises.stat(filePath);
                    if (stat.isFile()) {
                        const content = await fsPromises.readFile(filePath, 'utf8');
                        if (content.trim().length > 0) {
                            files.push(filePath);
                        }
                    }
                } catch (err) {
                    // Skip files that can't be read
                    log(`Error reading file ${filePath}: ${err.message}`, false, false);
                }
            }
            
            let detected = 0;
            for (const filePath of files) {
                state.awarenessEngine.handleExternallyCreatedFile(filePath);
                detected++;
            }
            
            if (detected > 0) {
                showInformationMessage(`Detected ${detected} file(s) in testing folder. Check decorations!`);
                if (updateFileColorsInExplorer) {
                    updateFileColorsInExplorer();
                } else if (state.fileDecorationProvider && state.currentMode === 'dev') {
                    state.fileDecorationProvider.refresh();
                }
            } else {
                showInformationMessage('No files detected in testing folder');
            }
        },

        'vibeswitch.diagnoseMonitor': async () => {
            if (!state.awarenessEngine) {
                showWarningMessage('Awareness Engine: Not initialized');
                state.outputChannel?.appendLine('Awareness Monitor: Not initialized');
                state.outputChannel?.show(true);
                return;
            }
            
            const status = state.awarenessEngine.getStatus();
            const scoreData = state.awarenessEngine.getScore();
            const mode = state.currentMode;
            
            let message = '=== Awareness Monitor Diagnostic ===\n\n';
            message += `Current Mode: ${mode || 'null'}\nMonitor Active: ${status.isActive ? 'YES' : 'NO'}\n`;
            message += `Has Context: ${status.hasContext ? 'YES' : 'NO'}\nHas Callback: ${status.hasCallback ? 'YES' : 'NO'}\n`;
            message += `Has Usage Stats: ${status.hasUsageStats ? 'YES' : 'NO'}\nAI Suggestions: ${status.aiSuggestionsCount}\n`;
            message += `Review Debt Files: ${status.reviewDebtCount}\nCurrent Score: ${status.currentScore}\n`;
            message += `Score Components: ${JSON.stringify(status.scores, null, 2)}\n`;
            message += `Watched Directories: ${status.watchedDirectories.length}\n`;
            status.watchedDirectories.forEach(dir => message += `  - ${dir}\n`);
            
            message += '\n=== File Decoration Diagnostic ===\n\n';
            message += `File Decoration Provider: ${state.fileDecorationProvider ? 'EXISTS' : 'NULL'}\n`;
            if (state.fileDecorationProvider) {
                message += `Debug Call Count: ${state.fileDecorationProvider.debugCallCount || 0}\n`;
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
            const wsFolders = workspaceFolders;
            if (wsFolders?.length) {
                const testingPath = path.join(wsFolders[0].uri.fsPath, 'testing');
                try {
                    await fsPromises.access(testingPath);
                    message += '\n=== Testing Folder Files ===\n';
                    const entries = await fsPromises.readdir(testingPath);
                    const files = entries
                        .filter(f => f.endsWith('.js'))
                        .map(f => path.join(testingPath, f));
                    
                    for (const filePath of files) {
                        const relativePath = path.relative(wsFolders[0].uri.fsPath, filePath);
                        const inDebt = scoreData?.debt?.files?.some(f => 
                            path.resolve(f.fullPath).toLowerCase() === path.resolve(filePath).toLowerCase()
                        );
                        const inPending = scoreData?.suggestions?.pendingFiles?.some(f => 
                            path.resolve(f.fullPath).toLowerCase() === path.resolve(filePath).toLowerCase()
                        );
                        
                        message += `  ${relativePath}: ${inDebt ? '✅ IN DEBT' : inPending ? '⏳ IN PENDING' : '❌ NOT DETECTED'}\n`;
                        
                        if (!inDebt && !inPending) {
                            try {
                                const stat = await fsPromises.stat(filePath);
                                if (stat.isFile()) {
                                    const content = await fsPromises.readFile(filePath, 'utf8');
                                    if (content.trim().length > 0) {
                                        try {
                                            state.awarenessEngine.handleExternallyCreatedFile(filePath);
                                            message += '      → Manually triggered detection\n';
                                        } catch (err) {
                                            message += `      → Error triggering: ${err.message}\n`;
                                        }
                                    }
                                }
                            } catch (err) {
                                // Skip files that can't be accessed
                            }
                        }
                    }
                } catch {
                    // Testing folder doesn't exist, skip
                }
            }
            
            message += `\nFile System Watcher: ${status.hasFileSystemWatcher ? 'ACTIVE' : 'INACTIVE'}\n`;
            message += `Update Timer: ${status.hasUpdateTimer ? 'ACTIVE' : 'INACTIVE'}\n`;
            message += `Recent Acceptances: ${status.recentAcceptances}\n`;
            message += `Workspace Folders: ${status.workspaceFolders.length}\n`;
            status.workspaceFolders.forEach(folder => message += `  - ${folder}\n`);
            
            state.outputChannel?.appendLine(message);
            state.outputChannel?.show(true);
            const summary = `Monitor: ${status.isActive ? 'ACTIVE' : 'INACTIVE'} | Mode: ${mode || 'null'} | Suggestions: ${status.aiSuggestionsCount} | Score: ${status.currentScore}`;
            showInformationMessage(summary);
        },

        'vibeswitch.showUnreviewedFiles': async () => {
            if (!state.awarenessEngine) {
                showWarningMessage('Awareness Engine: Not initialized');
                return;
            }
            
            if (state.currentMode !== 'dev') {
                showInformationMessage('Unreviewed files are only tracked in DEV mode');
                return;
            }
            
            const scoreData = state.awarenessEngine.getScore();
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
                showInformationMessage('✅ No unreviewed files - great job!');
                return;
            }
            
            const selected = await showQuickPick(allItems, {
                placeHolder: `Select a file to open and review (${allItems.length} unreviewed items)`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            
            if (selected?.filePath) {
                try {
                    const document = await openTextDocument(selected.filePath);
                    await showTextDocument(document);
                    log(`Opened unreviewed file: ${selected.filePath}`);
                } catch (error) {
                    showErrorMessage(`Failed to open file: ${error.message}`);
                    log(`Error opening file ${selected.filePath}: ${error.message}`);
                }
            }
        },

        'vibeswitch.showAlertLog': async () => {
            const os = require('os');
            const auditLogPath = path.join(os.homedir(), '.vibeswitch', 'state', 'audit.log');
            try {
                const doc = await openTextDocument(auditLogPath);
                await showTextDocument(doc);
                showInformationMessage('Capability audit log opened');
            } catch (error) {
                showWarningMessage(`No audit log found at ${auditLogPath}`);
            }
        },

        'vibeswitch.capabilitySelfTest': async () => {
            if (!state.modeEnforcement || !state.modeEnforcement.selfTest) {
                showWarningMessage('Mode enforcement not initialized');
                return;
            }
            const result = state.modeEnforcement.selfTest.run();
            let message = '=== Capability Self-Test ===\n\n';
            message += `Status: ${result.passed ? 'PASSED ✅' : 'FAILED ❌'}\n\n`;
            if (result.errors.length > 0) {
                message += 'Errors:\n';
                result.errors.forEach(e => message += `  ❌ ${e}\n`);
            }
            if (result.warnings.length > 0) {
                message += '\nWarnings:\n';
                result.warnings.forEach(w => message += `  ⚠️ ${w}\n`);
            }
            state.outputChannel?.appendLine(message);
            state.outputChannel?.show(true);
            if (result.passed) {
                showInformationMessage('Capability self-test passed ✅');
            } else {
                showErrorMessage(`Capability self-test failed: ${result.errors[0]}`);
            }
        },

        'vibeswitch.setupCapability': async () => {
            // #region agent log
            fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vsCommandsFactory.js:setupCapability',message:'command_invoked',data:{hasExtensionPath:!!state.extensionContext?.extensionPath},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
            // #endregion
            const capabilitySetup = require('./business_modules/mode-enforcement/app/capabilitySetup');
            const extensionPath = state.extensionContext?.extensionPath;
            if (!extensionPath) {
                showErrorMessage('Extension context not available');
                return;
            }
            const result = capabilitySetup.runSetup(extensionPath);
            // #region agent log
            fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vsCommandsFactory.js:setupCapability',message:'after_runSetup',data:{success:result.success,copiedCount:result.copied?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
            // #endregion
            let message = '=== Setup Capability Scripts ===\n\n';
            if (result.copied.length > 0) {
                message += 'Copied:\n';
                result.copied.forEach(f => message += `  ${f}\n`);
            }
            if (result.errors.length > 0) {
                message += '\nErrors:\n';
                result.errors.forEach(e => message += `  ${e}\n`);
            }
            message += `\nStatus: ${result.success ? 'OK' : 'FAILED'}\n`;
            state.outputChannel?.appendLine(message);
            state.outputChannel?.show(true);
            if (result.success) {
                showInformationMessage('VibeSwitch capability scripts installed. Run Capability Self-Test to verify.');
                if (state.modeEnforcement?.selfTest) {
                    const testResult = state.modeEnforcement.selfTest.run();
                    if (testResult.passed) {
                        showInformationMessage('Capability self-test passed.');
                    } else {
                        showWarningMessage(`Self-test still failing: ${testResult.errors[0]}. Ensure jq is installed.`);
                    }
                }
            } else {
                showErrorMessage(`Setup failed: ${result.errors[0]}`);
            }
        },

        'vibeswitch.registerMcpServer': async () => {
            const mcpRegistration = require('./business_modules/mode-enforcement/app/mcpRegistration');
            const extensionPath = state.extensionContext?.extensionPath;
            if (!extensionPath) {
                showErrorMessage('Extension context not available');
                return;
            }
            const result = mcpRegistration.registerMcpServer(extensionPath);
            if (result.success) {
                showInformationMessage('VibeSwitch: MCP server registered. Restart Cursor or reload window if needed.');
            } else {
                showErrorMessage(`VibeSwitch: Register MCP failed: ${result.error}`);
            }
        },

        // @ai
        'vibeswitch.testAddAICode': async () => {
            // @ai
            const editor = activeTextEditor;
            // @ai
            if (!editor) {
                showWarningMessage('No active editor. Please open a file first.');
                return;
            }

            // @ai
            const testCode = `// @ai
// This is a test function added by VibeSwitch
function testAICodeMarker() {
    const message = 'This code was added with the // @ai marker';
    console.log(message);
    return message;
}

// @ai
// Another test block
const testVariable = 'AI-generated code test';
`;

            // @ai
            try {
                // @ai
                const position = editor.selection.active;
                // @ai
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, testCode);
                });
                
                // @ai
                log(`Test AI code inserted at line ${position.line + 1}, column ${position.character + 1}`);
                // @ai
                showInformationMessage('✅ Test AI code inserted with // @ai markers!');
            // @ai
            } catch (error) {
                // @ai
                log(`ERROR inserting test code: ${error.message}`, true, true);
                // @ai
                showErrorMessage(`Failed to insert test code: ${error.message}`);
            }
        },

        // Test-only: return current score for extension-host integration tests (when VIBESWITCH_INTEGRATION_TEST=1)
        'vibeswitch._testGetScore': () => {
            if (process.env.VIBESWITCH_INTEGRATION_TEST !== '1') return undefined;
            return state.awarenessEngine ? state.awarenessEngine.getScore() : undefined;
        },

        // Test-only: reset test-only state (avoids order-dependent tests; call at start of tests that assert pre/post)
        'vibeswitch._testResetState': () => {
            if (process.env.VIBESWITCH_INTEGRATION_TEST !== '1') return;
            state._testTerminalBlocksCount = 0;
        },
        // Test-only: simulate terminal blocked (increments counter for electron test assertion)
        'vibeswitch._testSimulateTerminalBlocked': () => {
            if (process.env.VIBESWITCH_INTEGRATION_TEST !== '1') return;
            state._testTerminalBlocksCount = (state._testTerminalBlocksCount || 0) + 1;
        },

        // Test-only: checkpoint save (ledger checkpoint for electron test)
        'vibeswitch._testCheckpointSave': async () => {
            if (process.env.VIBESWITCH_INTEGRATION_TEST !== '1') return;
            const ledger = state.awarenessEngine && state.awarenessEngine.getChangeLedger ? state.awarenessEngine.getChangeLedger() : null;
            if (ledger && typeof ledger.checkpointNow === 'function') await ledger.checkpointNow({ reason: 'test' });
        },

        // Test-only: checkpoint restore (returns current checkpoint shape for electron test)
        'vibeswitch._testCheckpointRestore': () => {
            if (process.env.VIBESWITCH_INTEGRATION_TEST !== '1') return undefined;
            const ledger = state.awarenessEngine && state.awarenessEngine.getChangeLedger ? state.awarenessEngine.getChangeLedger() : null;
            return ledger && typeof ledger.getCheckpoint === 'function' ? ledger.getCheckpoint() : undefined;
        },

        // Test-only: debug snapshot for asserting deltas and meter (counters, breakdown, view model)
        'vibeswitch._testGetDebugSnapshot': () => {
            if (process.env.VIBESWITCH_INTEGRATION_TEST !== '1') return undefined;
            if (!state.awarenessEngine) return undefined;
            const score = state.awarenessEngine.getScore();
            const breakdown = state.awarenessEngine.getScoreBreakdown();
            const terminalAttemptsBlocked = state._testTerminalBlocksCount ?? 0;
            const counters = {
                suggestionsTotal: score?.suggestions?.total ?? 0,
                accepted: score?.suggestions?.accepted ?? 0,
                rejected: score?.suggestions?.rejected ?? 0,
                adapted: score?.suggestions?.adapted ?? 0,
                pending: score?.suggestions?.pending ?? 0,
                debtFileCount: score?.debt?.unreviewedFiles ?? 0,
                terminalAttemptsBlocked
            };
            const meterViewModel = mapDomainStateToViewModel(score, state.currentMode || 'dev');
            return {
                score,
                breakdown,
                counters,
                meterViewModel,
                currentMode: state.currentMode || 'dev',
                flags: { terminalBlocked: terminalAttemptsBlocked > 0 }
            };
        }
    };
}

module.exports = commandHandlers;
