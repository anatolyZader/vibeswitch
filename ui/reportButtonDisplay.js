/**
 * Report Button Display - Simple status bar button for opening dashboard
 * 
 * Shows a laconic "REPORT" button in the status bar that opens the dashboard on click.
 * Tooltip shows basic info on hover. All detailed metrics are shown in the dashboard itself.
 */

const vscode = require('vscode');

/**
 * Updates the report button with current state
 * Shows basic tooltip with awareness score (if available)
 * 
 * @param {vscode.StatusBarItem} reportButton - The report button status bar item
 * @param {Object} awarenessEngine - The awareness engine instance (optional)
 * @param {string|null} currentMode - Current mode ('vibe', 'dev', or null)
 * @param {vscode.OutputChannel} outputChannel - Optional output channel for logging
 */
function updateReportButton(reportButton, awarenessEngine, currentMode, outputChannel = null) {
    if (!reportButton) {
        if (outputChannel) {
            outputChannel.appendLine('WARNING: reportButton not initialized');
        }
        return;
    }

    // Always show "REPORT" text
    reportButton.text = 'REPORT';
    
    // Build tooltip with basic info
    let tooltip = 'VibeSwitch Dashboard';
    
    if (awarenessEngine) {
        try {
            const scoreData = awarenessEngine.getScore();
            if (scoreData && typeof scoreData.total === 'number') {
                const score = Math.max(0, Math.min(100, scoreData.total));
                const modeLabel = currentMode ? currentMode.toUpperCase() : 'NO MODE';
                tooltip = `${modeLabel} · Risk: ${score}/100\n\nClick to open dashboard`;
                
                // Set background color based on risk score
                if (score >= 80) {
                    reportButton.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                } else if (score >= 60) {
                    reportButton.backgroundColor = '#ff9800'; // orange
                } else if (score >= 40) {
                    reportButton.backgroundColor = '#ffeb3b'; // yellow
                } else {
                    reportButton.backgroundColor = '#4caf50'; // green
                }
            } else {
                tooltip = 'VibeSwitch Dashboard\n\nNo data available yet';
                reportButton.backgroundColor = undefined;
            }
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine(`ERROR getting score for report button: ${error.message}`);
            }
            tooltip = 'VibeSwitch Dashboard\n\nClick to view details';
            reportButton.backgroundColor = undefined;
        }
    } else {
        tooltip = 'VibeSwitch Dashboard\n\nInitializing...';
        reportButton.backgroundColor = undefined;
    }
    
    reportButton.tooltip = tooltip;
    
    // Always show button (unless explicitly disabled by config)
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const shouldShow = config.get('showInStatusBar', true);
    
    if (shouldShow) {
        reportButton.show();
    } else {
        reportButton.hide();
    }
}

module.exports = {
    updateReportButton
};
