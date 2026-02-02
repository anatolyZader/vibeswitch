/**
 * VibeSwitch Dashboard: opens a Webview with circular (clock-style) gauges per antipattern,
 * or falls back to virtual markdown document. Reuses the same Webview tab when opening again.
 */

const vscode = require('vscode');
const { buildDashboardMarkdown, buildDashboardWebviewHtml } = require('./dashboardContent');

const DASHBOARD_URI_SCHEME = 'vibeswitch-dashboard';
const DASHBOARD_URI_AUTHORITY = 'awareness';
const DASHBOARD_URI_PATH = '/dashboard.md';
const WEBVIEW_VIEWTYPE = 'vibeswitch.dashboard';

function getDashboardUri() {
    return vscode.Uri.parse(`${DASHBOARD_URI_SCHEME}://${DASHBOARD_URI_AUTHORITY}${DASHBOARD_URI_PATH}`);
}

/**
 * TextDocumentContentProvider for markdown fallback (same tab reuse).
 */
class DashboardContentProvider {
    constructor() {
        this._content = '# VibeSwitch Dashboard\n\n*Loading...*';
        this._onDidChange = new vscode.EventEmitter();
    }

    get onDidChange() {
        return this._onDidChange.event;
    }

    provideTextDocumentContent(uri) {
        return this._content;
    }

    updateContent(content) {
        this._content = content || this._content;
        this._onDidChange.fire(getDashboardUri());
    }
}

/**
 * Open the VibeSwitch dashboard: Webview with circular gauges (clock-style).
 * Reuses the same panel when opening again and refreshes content.
 * @param {Object} awarenessEngine - Awareness engine (getScore, getScoreBreakdown, getAntipatternBreakdown)
 * @param {string|null} currentMode - 'dev', 'vibe', or null
 * @param {DashboardContentProvider|null} contentProvider - Unused when using Webview; kept for API compat
 * @param {Object} [state] - Extension state; if provided and state.dashboardPanel is set, reuses panel
 */
async function openDashboard(awarenessEngine, currentMode, contentProvider, state) {
    if (!awarenessEngine) {
        vscode.window.showWarningMessage('VibeSwitch: Awareness engine not initialized.');
        return;
    }

    let scoreData;
    let scoreBreakdown = null;
    let antipatternBreakdown = null;
    try {
        scoreData = awarenessEngine.getScore();
        if (typeof awarenessEngine.getScoreBreakdown === 'function') {
            scoreBreakdown = awarenessEngine.getScoreBreakdown();
        }
        if (typeof awarenessEngine.getAntipatternBreakdownAsync === 'function') {
            antipatternBreakdown = await awarenessEngine.getAntipatternBreakdownAsync();
        } else if (typeof awarenessEngine.getAntipatternBreakdown === 'function') {
            antipatternBreakdown = awarenessEngine.getAntipatternBreakdown();
        }
    } catch (err) {
        vscode.window.showErrorMessage(`VibeSwitch: Failed to get score: ${err.message}`);
        return;
    }

    const html = buildDashboardWebviewHtml(scoreData, scoreBreakdown, currentMode, antipatternBreakdown);

    const existingPanel = state && state.dashboardPanel;
    if (existingPanel) {
        try {
            existingPanel.webview.html = html;
            existingPanel.reveal(vscode.ViewColumn.Beside);
            return;
        } catch (_) {
            state.dashboardPanel = undefined;
        }
    }

    const panel = vscode.window.createWebviewPanel(
        WEBVIEW_VIEWTYPE,
        'VibeSwitch Dashboard',
        vscode.ViewColumn.Beside,
        { enableScripts: false, retainContextWhenHidden: true }
    );
    panel.webview.html = html;
    if (state) {
        state.dashboardPanel = panel;
    }
    panel.onDidDispose(() => {
        if (state) {
            state.dashboardPanel = undefined;
        }
    });
}

module.exports = {
    openDashboard,
    getDashboardUri,
    DashboardContentProvider
};
