/**
 * Laconic Report button for the status bar.
 * Violet button with "REPORT" text; click opens dashboard, hover shows rich schematic tooltip.
 * Uses MarkdownString for tooltip to avoid TrustedScript/TrustedString issues in the workbench.
 */

const vscode = require('vscode');
const { buildSchematicTooltip } = require('./dashboardContent');

/** Violet background for the Report button (works in light/dark themes). */
const REPORT_BUTTON_VIOLET = '#7C3AED';

const DEFAULT_TOOLTIP = 'Open VibeSwitch dashboard';

/**
 * Update the Report status bar item: "REPORT" text, violet background, rich tooltip with main insights.
 * Tooltip is set as MarkdownString to avoid Trusted Types blocking in Cursor/VS Code.
 * @param {vscode.StatusBarItem|null} statusBarItem - The Report status bar item (state.statusBarItem)
 * @param {Object|null} awarenessEngine - Awareness engine (getScore, getScoreBreakdown, getAntipatternBreakdown)
 * @param {vscode.OutputChannel|null} outputChannel - Optional output channel
 * @param {string|null} [currentMode='vibe'] - Mode label for tooltip (e.g. 'vibe')
 */
function updateReportButton(statusBarItem, awarenessEngine, outputChannel = null, currentMode = 'vibe') {
    if (!statusBarItem) return;

    const showInStatusBar = vscode.workspace.getConfiguration('vibeswitch').get('showInStatusBar', true);
    if (!showInStatusBar) {
        statusBarItem.hide();
        return;
    }

    statusBarItem.text = 'REPORT';
    statusBarItem.command = 'vibeswitch.openDashboard';
    statusBarItem.backgroundColor = REPORT_BUTTON_VIOLET;

    let tooltipContent = DEFAULT_TOOLTIP;
    if (awarenessEngine) {
        try {
            const scoreData = awarenessEngine.getScore();
            if (scoreData) {
                const scoreBreakdown = typeof awarenessEngine.getScoreBreakdown === 'function' ? awarenessEngine.getScoreBreakdown() : null;
                const antipatternBreakdown = typeof awarenessEngine.getAntipatternBreakdown === 'function' ? awarenessEngine.getAntipatternBreakdown() : null;
                tooltipContent = buildSchematicTooltip(scoreData, scoreBreakdown, currentMode || 'vibe', antipatternBreakdown);
            }
        } catch (err) {
            if (outputChannel) {
                outputChannel.appendLine(`Report button: ${err.message}`);
            }
        }
    }

    try {
        const md = new vscode.MarkdownString();
        md.appendText(tooltipContent);
        md.supportHtml = false;
        statusBarItem.tooltip = md;
    } catch (tooltipErr) {
        if (outputChannel) {
            outputChannel.appendLine(`Report button tooltip: ${tooltipErr.message}`);
        }
        try {
            statusBarItem.tooltip = DEFAULT_TOOLTIP;
        } catch (_) {
            // ignore; show() below keeps button visible
        }
    }
    // Always re-show when config is true so button never disappears after updates
    try {
        statusBarItem.show();
    } catch (showErr) {
        if (outputChannel) {
            outputChannel.appendLine(`Report button show: ${showErr.message}`);
        }
    }
}

module.exports = {
    updateReportButton
};
