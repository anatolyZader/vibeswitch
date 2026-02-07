/**
 * VibeSwitch Dashboard: React Webview (Meters, Output, Chat) or legacy HTML fallback.
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { buildDashboardMarkdown, buildDashboardWebviewHtml, normalizeBreakdownForDisplay } = require('./dashboardContent');
const dashboardChatService = require('../business_modules/awareness/app/dashboard/dashboardChatService');

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
 * Build HTML for React dashboard Webview. Script loaded via asWebviewUri.
 */
function buildReactDashboardHtml(webview, extensionUri) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'dashboard-app.js'));
    const csp = "default-src 'none'; script-src " + webview.cspSource + "; style-src 'unsafe-inline' " + webview.cspSource + ";";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0;padding:1rem;}
    .vibeswitch-dashboard{max-width:900px;margin:0 auto;}
    .dashboard-header h1{margin:0 0 0.25rem 0;font-size:1.25rem;}
    .dashboard-meta{opacity:0.9;margin:0;}
    section{margin:1.5rem 0;}
    section h2{font-size:1rem;margin:0 0 0.5rem 0;}
    .gauges{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:1rem;}
    .gauge-cell{text-align:center;}
    .gauge-svg{width:64px;height:64px;display:block;margin:0 auto;}
    .gauge-track{stroke:var(--vscode-widget-border);fill:none;}
    .gauge-arc{fill:none;stroke-linecap:round;}
    .gauge-label{font-size:0.7rem;margin-top:0.25rem;}
    .gauge-pct{font-size:0.75rem;font-weight:600;}
    .output-section .token-usage-block{margin:0.25rem 0;}
    .token-unavailable{opacity:0.8;font-style:italic;}
    .events-list{margin:0.25rem 0;padding-left:1.25rem;font-size:0.85rem;}
    .event-sev-high{color:var(--vscode-errorForeground,#e53935);}
    .capabilities-note{font-size:0.75rem;opacity:0.7;margin-top:0.5rem;}
    .chat-section{border-top:1px solid var(--vscode-widget-border);padding-top:1rem;}
    .chat-hint{font-size:0.85rem;opacity:0.9;margin:0 0 0.5rem 0;}
    .chat-messages{max-height:200px;overflow-y:auto;margin:0.5rem 0;padding:0.5rem;background:var(--vscode-input-background);border-radius:4px;}
    .chat-placeholder{opacity:0.7;}
    .chat-message{margin:0.5rem 0;}
    .chat-user,.chat-assistant{margin:0.25rem 0;}
    .chat-error{color:var(--vscode-errorForeground);font-size:0.85rem;}
    .chat-typing{opacity:0.7;}
    .chat-input-row{display:flex;gap:0.5rem;}
    .chat-input{flex:1;padding:0.35rem 0.5rem;}
    .chat-send{padding:0.35rem 0.75rem;}
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

/**
 * Send payload to React dashboard (init or update). Diff-friendly: only send when panel is React.
 */
function sendPayloadToWebview(panel, payload) {
    if (!panel || !panel.webview) return;
    panel.webview.postMessage({ type: 'update', payload });
}

/**
 * Open the VibeSwitch dashboard: React Webview (Meters, Output, Chat) or legacy HTML.
 * Reuses the same panel; sends diff-based updates when React is used.
 */
async function openDashboard(awarenessEngine, currentMode, contentProvider, state) {
    if (!awarenessEngine) {
        vscode.window.showWarningMessage('VibeSwitch: Awareness engine not initialized.');
        return;
    }

    let scoreData;
    let scoreBreakdown = null;
    let antipatternBreakdown = null;
    let events = [];
    let tokenUsage = null;
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
        if (typeof awarenessEngine.getAntipatternEvents === 'function') {
            events = await awarenessEngine.getAntipatternEvents(0).catch(() => []);
        }
        if (state && state.tokenUsageClient && typeof state.tokenUsageClient.fetchTokenUsage === 'function') {
            tokenUsage = await state.tokenUsageClient.fetchTokenUsage().catch(() => null);
        }
    } catch (err) {
        vscode.window.showErrorMessage(`VibeSwitch: Failed to get score: ${err.message}`);
        return;
    }

    const capabilities = {
        git: true,
        ast: true,
        tasksObserved: false,
        usageApiAvailable: tokenUsage ? tokenUsage.usageApiAvailable === true : false
    };
    const flatBreakdown = normalizeBreakdownForDisplay(antipatternBreakdown);
    const payload = {
        currentMode: currentMode || 'dev',
        scoreData,
        scoreBreakdown,
        antipatternBreakdown: flatBreakdown,
        events,
        tokenUsage: tokenUsage || { totalInput: 0, totalOutput: 0, totalTokens: 0, usageApiAvailable: false },
        capabilities
    };

    const extensionContext = state && state.extensionContext;
    const bundlePath = extensionContext ? path.join(extensionContext.extensionPath, 'out', 'dashboard-app.js') : '';
    const useReact = extensionContext && fs.existsSync(bundlePath);

    const existingPanel = state && state.dashboardPanel;
    if (existingPanel) {
        try {
            if (state.useReactDashboard) {
                sendPayloadToWebview(existingPanel, payload);
                existingPanel.reveal(vscode.ViewColumn.Beside);
                return;
            }
            existingPanel.webview.html = useReact
                ? buildReactDashboardHtml(existingPanel.webview, extensionContext.extensionUri)
                : buildDashboardWebviewHtml(scoreData, scoreBreakdown, currentMode, antipatternBreakdown, events, tokenUsage, capabilities);
            if (useReact) {
                state.useReactDashboard = true;
                setTimeout(() => sendPayloadToWebview(existingPanel, payload), 100);
            }
            existingPanel.reveal(vscode.ViewColumn.Beside);
            return;
        } catch (_) {
            state.dashboardPanel = undefined;
            state.useReactDashboard = false;
        }
    }

    const panel = vscode.window.createWebviewPanel(
        WEBVIEW_VIEWTYPE,
        'VibeSwitch Dashboard',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: extensionContext ? [vscode.Uri.joinPath(extensionContext.extensionUri, 'out')] : []
        }
    );

    if (useReact) {
        panel.webview.html = buildReactDashboardHtml(panel.webview, extensionContext.extensionUri);
        setTimeout(() => sendPayloadToWebview(panel, payload), 100);
        panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.command !== 'chat' || !msg.id || !msg.text) return;
            const stubSummary = `Dashboard: risk ${payload.scoreData?.total ?? 0}/100, ${(payload.events || []).length} events, mode ${payload.currentMode}.`;
            const stubReply = `(Read-only assistant) You asked: "${msg.text}". ${stubSummary} I cannot edit files or run commands.`;
            const logger = state && state.outputChannel ? { log: () => {}, error: (m, e) => { state.outputChannel.appendLine('[DashboardChat] ' + m + (e && e.message ? ' ' + e.message : '')); } } : undefined;
            try {
                const result = await dashboardChatService.reply(vscode, payload, msg.text, logger);
                const text = result.text != null ? result.text : stubReply;
                panel.webview.postMessage({ command: 'chatReply', id: msg.id, text, error: result.error || undefined });
            } catch (err) {
                panel.webview.postMessage({ command: 'chatReply', id: msg.id, text: stubReply, error: err.message || 'Request failed' });
            }
        });
        if (state) state.useReactDashboard = true;
    } else {
        panel.webview.html = buildDashboardWebviewHtml(scoreData, scoreBreakdown, currentMode, antipatternBreakdown, events, tokenUsage, capabilities);
        if (state) state.useReactDashboard = false;
    }

    if (state) {
        state.dashboardPanel = panel;
    }
    panel.onDidDispose(() => {
        if (state) {
            state.dashboardPanel = undefined;
            state.useReactDashboard = false;
        }
    });
}

module.exports = {
    openDashboard,
    getDashboardUri,
    DashboardContentProvider
};
