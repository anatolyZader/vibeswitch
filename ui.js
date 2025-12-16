/**
 * UI components like quick pick menus
 */

const vscode = require('vscode');

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
    showModePicker
};


