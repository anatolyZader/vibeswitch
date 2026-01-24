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
    if (!statusBarItem) {
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
        statusBarItem.text = '$(zap) VIBE';
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

    // ALWAYS show status bar - it's the primary way to access the extension
    // Force show() call to ensure visibility regardless of any other state
    statusBarItem.show();
    
    if (outputChannel) {
        outputChannel.appendLine(`[DEBUG] Status bar updated: mode=${currentMode}, text=${statusBarItem.text}`);
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
