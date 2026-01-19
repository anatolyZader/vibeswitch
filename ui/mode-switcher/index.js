/**
 * Mode Switcher UI Component
 * 
 * Handles mode switching UI including status bar indicator and quick pick menu
 */

const vscode = require('vscode');

/**
 * Updates the status bar item to reflect the current mode and visibility settings
 * 
 * @param {vscode.StatusBarItem} statusBarItem - The status bar item to update
 * @param {string|null} currentMode - Current mode ('vibe', 'dev', or null)
 * @param {vscode.OutputChannel} outputChannel - Optional output channel for logging
 */
function updateStatusBar(statusBarItem, currentMode, outputChannel = null) {
    // #region agent log
    const logData4 = {location:'ui/mode-switcher/index.js:16',message:'updateStatusBar called',data:{hasStatusBarItem:statusBarItem!==null,currentMode:currentMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
    console.log('[DEBUG]', JSON.stringify(logData4));
    if (outputChannel) outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData4)}`);
    globalThis.fetch?.('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData4)})?.catch?.(()=>{});
    // #endregion
    if (!statusBarItem) {
        // #region agent log
        const logData5 = {location:'ui/mode-switcher/index.js:18',message:'statusBarItem is null, returning early',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
        console.log('[DEBUG]', JSON.stringify(logData5));
        if (outputChannel) outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData5)}`);
        globalThis.fetch?.('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData5)})?.catch?.(()=>{});
        // #endregion
        if (outputChannel) {
            outputChannel.appendLine('WARNING: statusBarItem not initialized');
        }
        return;
    }
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        // Show status bar even without workspace, but with a message
        statusBarItem.text = '$(gear) VibeSwitch';
        statusBarItem.tooltip = 'VibeSwitch: No workspace folder open\nOpen a folder to use VibeSwitch';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.show();
        return;
    }

    // Update status bar appearance
    if (currentMode === 'vibe') {
        statusBarItem.text = '$(dashboard) VIBE';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.tooltip = 'AI Agent: VIBE Mode (Autonomous)\nClick to switch modes';
    } else if (currentMode === 'dev') {
        statusBarItem.text = '$(book) DEV';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = 'AI Agent: DEV Mode (Collaborative)\nClick to switch modes';
    } else {
        statusBarItem.text = '$(gear) Mode?';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = 'AI Agent Mode: Unknown\nClick to set mode';
    }

    // Check if should show (default to true if setting not explicitly false)
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const shouldShow = config.get('showInStatusBar', true); // Default to true
    // #region agent log
    const logData6 = {location:'ui/mode-switcher/index.js:51',message:'Checking showInStatusBar config',data:{shouldShow:shouldShow,currentMode:currentMode,text:statusBarItem.text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
    console.log('[DEBUG]', JSON.stringify(logData6));
    if (outputChannel) outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData6)}`);
    globalThis.fetch?.('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData6)})?.catch?.(()=>{});
    // #endregion
    
    // Always show status bar - it's the primary way to access the extension
    if (shouldShow !== false) {
        // #region agent log
        const logData7 = {location:'ui/mode-switcher/index.js:55',message:'Calling statusBarItem.show()',data:{text:statusBarItem.text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
        console.log('[DEBUG]', JSON.stringify(logData7));
        if (outputChannel) outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData7)}`);
        globalThis.fetch?.('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData7)})?.catch?.(()=>{});
        // #endregion
        statusBarItem.show();
        if (outputChannel) {
            outputChannel.appendLine(`Status bar shown (showInStatusBar=${shouldShow})`);
        }
    } else {
        // #region agent log
        globalThis.fetch?.('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ui/mode-switcher/index.js:60',message:'Hiding status bar due to showInStatusBar=false',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})})?.catch?.(()=>{});
        // #endregion
        statusBarItem.hide();
        if (outputChannel) {
            outputChannel.appendLine('Status bar hidden by showInStatusBar=false setting');
        }
    }
}

/**
 * Displays a quick pick menu allowing user to switch between VIBE and DEV modes
 * 
 * Shows a dropdown with mode options:
 * - VIBE Mode: Autonomous AI operation
 * - DEV Mode: Collaborative AI operation
 * - Current mode indicator
 * - Usage statistics option
 * 
 * Tracks status bar clicks in usage statistics and handles user selection
 * 
 * @param {string|null} currentMode - Current mode ('vibe', 'dev', or null)
 * @param {Object} usageStats - Usage statistics manager instance (optional)
 * @param {Function} onModeSelected - Callback when mode is selected (mode: string)
 * @param {Function} onStatsSelected - Callback when statistics option is selected
 */
function showModePicker(currentMode, usageStats = null, onModeSelected = null, onStatsSelected = null) {
    // Track status bar click (awareness indicator)
    if (usageStats) {
        usageStats.trackStatusBarClick();
    }

    const modes = [
        {
            label: '$(zap) VIBE Mode',
            description: 'Autonomous - AI works independently with minimal interruptions',
            detail: 'Best for: Building features quickly, refactoring, prototyping',
            mode: 'vibe',
            picked: currentMode === 'vibe'  // Highlight if currently active
        },
        {
            label: '$(book) DEV Mode',
            description: 'Collaborative - AI explains and asks for approval',
            detail: 'Best for: Learning, understanding changes, careful review',
            mode: 'dev',
            picked: currentMode === 'dev'  // Highlight if currently active
        },
        {
            label: '$(info) Current: ' + (currentMode || 'Unknown'),
            description: 'View current mode',
            mode: null
        },
        {
            label: '$(graph) Usage Statistics',
            description: 'View your mode usage and awareness metrics',
            mode: 'stats'
        }
    ];

    vscode.window.showQuickPick(modes, {
        placeHolder: 'Select AI Agent Mode',
        title: 'VibeSwitch - Change AI Agent Behavior'
    }).then(selection => {
        if (selection) {
            if (selection.mode === 'stats') {
                if (onStatsSelected) {
                    onStatsSelected();
                }
            } else if (selection.mode) {
                if (onModeSelected) {
                    // Ensure callback is called and awaited properly
                    const result = onModeSelected(selection.mode);
                    if (result && typeof result.then === 'function') {
                        result.catch(error => {
                            console.error('VibeSwitch: Error in mode selection callback:', error);
                            vscode.window.showErrorMessage(`Failed to switch mode: ${error.message}`);
                        });
                    }
                }
            }
        }
    }).catch(error => {
        console.error('VibeSwitch: Error showing mode picker:', error);
    });
}

module.exports = {
    updateStatusBar,
    showModePicker
};
