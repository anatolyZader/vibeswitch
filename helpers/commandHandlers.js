/**
 * Command Handlers
 * All VS Code command handlers for VibeSwitch extension
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const modeSwitcher = require('../ui/mode-switcher');
const userStatsUI = require('../ui/stats-dashboard');

/**
 * Create command handlers with dependency injection
 * @param {Object} dependencies - Injected dependencies
 * @param {Function} dependencies.log - Logging function
 * @param {Function} dependencies.switchToMode - Mode switching function
 * @param {Function} dependencies.updateFileColorsInExplorer - Function to update file name colors in Explorer
 * @param {Object} dependencies.state - Extension state (DIContainer)
 * @returns {Object} Command handlers map
 */
function commandHandlers({ log, switchToMode, updateFileColorsInExplorer, state }) {
    // Get vscodeAdapter from DI container for Ports and Adapters pattern
    const vscodeAdapter = state.getAdapter('awareness', 'vscodeAdapter');
    
    // Helper functions to use adapter if available, fallback to direct vscode
    const showErrorMessage = vscodeAdapter ? vscodeAdapter.showErrorMessage.bind(vscodeAdapter) : vscode.window.showErrorMessage;
    const showInformationMessage = vscodeAdapter ? vscodeAdapter.showInformationMessage.bind(vscodeAdapter) : vscode.window.showInformationMessage;
    const showWarningMessage = vscodeAdapter ? vscodeAdapter.showWarningMessage.bind(vscodeAdapter) : vscode.window.showWarningMessage;
    const showQuickPick = vscodeAdapter ? vscodeAdapter.showQuickPick.bind(vscodeAdapter) : vscode.window.showQuickPick;
    const showTextDocument = vscodeAdapter ? vscodeAdapter.showTextDocument.bind(vscodeAdapter) : vscode.window.showTextDocument;
    const activeTextEditor = vscodeAdapter ? vscodeAdapter.activeTextEditor : vscode.window.activeTextEditor;
    const workspaceFolders = vscodeAdapter ? vscodeAdapter.workspaceFolders : vscode.workspace.workspaceFolders;
    const openTextDocument = vscodeAdapter ? vscodeAdapter.openTextDocument.bind(vscodeAdapter) : vscode.workspace.openTextDocument;
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

        'vibeswitch.diagnoseDecorations': () => {
            if (!state.fileDecorationProvider) {
                showWarningMessage('File Decoration Provider: Not initialized');
                log(`Current mode: ${state.currentMode}`);
                log(`Awareness monitor exists: ${state.awarenessMonitor ? 'YES' : 'NO'}`);
                state.outputChannel?.show(true);
                return;
            }
            
            const scoreData = state.awarenessMonitor?.getScore();
            let message = '=== File Decoration Provider Diagnostic ===\n\n';
            message += `Provider exists: YES\nCurrent mode: ${state.currentMode}\n`;
            message += `Awareness monitor exists: ${state.awarenessMonitor ? 'YES' : 'NO'}\n`;
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
            if (!state.awarenessMonitor) {
                showWarningMessage('Awareness Monitor: Not initialized');
                return;
            }
            
            const wsFolders = workspaceFolders;
            if (!workspaceFolders?.length) {
                showWarningMessage('No workspace folder found');
                return;
            }
            
            const testingPath = path.join(workspaceFolders[0].uri.fsPath, 'testing');
            if (!fs.existsSync(testingPath)) {
                showWarningMessage('Testing folder not found');
                return;
            }
            
            const files = fs.readdirSync(testingPath)
                .filter(f => f.endsWith('.js'))
                .map(f => path.join(testingPath, f))
                .filter(f => fs.existsSync(f) && fs.statSync(f).isFile())
                .filter(f => fs.readFileSync(f, 'utf8').trim().length > 0);
            
            let detected = 0;
            for (const filePath of files) {
                state.awarenessMonitor.handleExternallyCreatedFile(filePath);
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

        'vibeswitch.diagnoseMonitor': () => {
            if (!state.awarenessMonitor) {
                showWarningMessage('Awareness Monitor: Not initialized');
                state.outputChannel?.appendLine('Awareness Monitor: Not initialized');
                state.outputChannel?.show(true);
                return;
            }
            
            const status = state.awarenessMonitor.getStatus();
            const scoreData = state.awarenessMonitor.getScore();
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
                if (fs.existsSync(testingPath)) {
                    message += '\n=== Testing Folder Files ===\n';
                    const files = fs.readdirSync(testingPath)
                        .filter(f => f.endsWith('.js'))
                        .map(f => path.join(testingPath, f));
                    
                    files.forEach(filePath => {
                        const relativePath = path.relative(wsFolders[0].uri.fsPath, filePath);
                        const inDebt = scoreData?.debt?.files?.some(f => 
                            path.resolve(f.fullPath).toLowerCase() === path.resolve(filePath).toLowerCase()
                        );
                        const inPending = scoreData?.suggestions?.pendingFiles?.some(f => 
                            path.resolve(f.fullPath).toLowerCase() === path.resolve(filePath).toLowerCase()
                        );
                        
                        message += `  ${relativePath}: ${inDebt ? '✅ IN DEBT' : inPending ? '⏳ IN PENDING' : '❌ NOT DETECTED'}\n`;
                        
                        if (!inDebt && !inPending && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                            const content = fs.readFileSync(filePath, 'utf8');
                            if (content.trim().length > 0) {
                                try {
                                    state.awarenessMonitor.handleExternallyCreatedFile(filePath);
                                    message += '      → Manually triggered detection\n';
                                } catch (err) {
                                    message += `      → Error triggering: ${err.message}\n`;
                                }
                            }
                        }
                    });
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
            if (!state.awarenessMonitor) {
                showWarningMessage('Awareness Monitor: Not initialized');
                return;
            }
            
            if (state.currentMode !== 'dev') {
                showInformationMessage('Unreviewed files are only tracked in DEV mode');
                return;
            }
            
            const scoreData = state.awarenessMonitor.getScore();
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
        }
    };
}

module.exports = commandHandlers;

