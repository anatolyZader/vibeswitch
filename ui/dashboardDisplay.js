/**
 * VibeSwitch Dashboard: opens a virtual markdown document with antipattern meters and file lists.
 * Uses a DocumentContentProvider so the same URI is reused and clicking again focuses the tab and refreshes content.
 */

const vscode = require('vscode');
const { buildDashboardMarkdown } = require('./dashboardContent');

const DASHBOARD_URI_SCHEME = 'vibeswitch-dashboard';
const DASHBOARD_URI_AUTHORITY = 'awareness';
const DASHBOARD_URI_PATH = '/dashboard.md';

function getDashboardUri() {
    return vscode.Uri.parse(`${DASHBOARD_URI_SCHEME}://${DASHBOARD_URI_AUTHORITY}${DASHBOARD_URI_PATH}`);
}

/**
 * TextDocumentContentProvider for the dashboard so the same tab is reused and content can be refreshed.
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
 * Open the VibeSwitch dashboard in an editor tab (virtual document).
 * If a contentProvider is given (from extension state), uses a fixed URI so reopening focuses the same tab and refreshes content.
 * @param {Object} awarenessEngine - Awareness engine (getScore, getScoreBreakdown, getAntipatternBreakdown)
 * @param {string|null} currentMode - 'dev', 'vibe', or null
 * @param {DashboardContentProvider|null} contentProvider - Optional; when set, dashboard uses fixed URI and reuses tab
 */
async function openDashboard(awarenessEngine, currentMode, contentProvider) {
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
        if (typeof awarenessEngine.getAntipatternBreakdown === 'function') {
            antipatternBreakdown = awarenessEngine.getAntipatternBreakdown();
        }
    } catch (err) {
        vscode.window.showErrorMessage(`VibeSwitch: Failed to get score: ${err.message}`);
        return;
    }

    const content = buildDashboardMarkdown(scoreData, scoreBreakdown, currentMode, antipatternBreakdown);

    if (contentProvider) {
        contentProvider.updateContent(content);
        const uri = getDashboardUri();
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, {
            preview: false,
            viewColumn: vscode.ViewColumn.Beside
        });
        return;
    }

    const doc = await vscode.workspace.openTextDocument({
        content,
        language: 'markdown'
    });
    await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside
    });
}

module.exports = {
    openDashboard,
    getDashboardUri,
    DashboardContentProvider
};
