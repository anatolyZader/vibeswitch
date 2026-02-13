/**
 * VibeSwitch Dashboard: React Webview (Meters, Output, Chat) or legacy HTML fallback.
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { buildDashboardMarkdown, buildDashboardWebviewHtml, normalizeBreakdownForDisplay } = require('./dashboardContent');
const dashboardChat = require('../business_modules/dashboard-chat');

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
    const csp = "default-src 'none'; script-src 'unsafe-eval' " + webview.cspSource + "; style-src 'unsafe-inline' " + webview.cspSource + ";";
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
    .dashboard-section{border-top:1px solid var(--vscode-widget-border);padding-top:1rem;margin-top:1rem;}
    .dashboard-section:first-of-type{border-top:none;margin-top:0;padding-top:0;}
    .files-section .files-list{margin:0.25rem 0;padding-left:1.25rem;font-size:0.85rem;}
    .files-section .file-age{opacity:0.8;font-size:0.8em;}
    .gauges{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:1rem;}
    .gauge-cell{text-align:center;}
    .gauge-svg{width:64px;height:64px;display:block;margin:0 auto;}
    .gauge-track{stroke:var(--vscode-widget-border);fill:none;}
    .gauge-arc{fill:none;stroke-linecap:round;}
    .gauge-label{font-size:0.7rem;margin-top:0.25rem;}
    .gauge-pct{font-size:0.75rem;font-weight:600;}
    .token-usage-section .token-usage-block{margin:0.25rem 0;}
    .output-section .token-usage-block{margin:0.25rem 0;}
    .token-unavailable{opacity:0.8;font-style:italic;}
    .events-list{margin:0.25rem 0;padding-left:1.25rem;font-size:0.85rem;}
    .output-messages{margin:0.25rem 0;padding-left:1.25rem;font-size:0.85rem;list-style:disc;}
    .output-entry{margin:0.2rem 0;}
    .output-empty{opacity:0.8;margin:0.25rem 0;font-size:0.9rem;}
    .event-sev-high{color:var(--vscode-errorForeground,#e53935);}
    .capabilities-note{font-size:0.75rem;opacity:0.7;margin-top:0.5rem;}
    .chat-hint{font-size:0.85rem;opacity:0.9;margin:0 0 0.5rem 0;}
    .chat-messages{min-height:120px;max-height:280px;overflow-y:auto;margin:0.5rem 0;padding:0.5rem 0;}
    .chat-placeholder{opacity:0.6;font-size:0.9rem;padding:1rem;text-align:center;}
    .chat-message-group{margin-bottom:1rem;}
    .chat-row{display:flex;margin:0.25rem 0;}
    .chat-row-user{justify-content:flex-end;}
    .chat-row-assistant{justify-content:flex-start;}
    .chat-bubble{max-width:85%;padding:0.5rem 0.75rem;border-radius:12px;font-size:var(--vscode-font-size);line-height:1.45;word-break:break-word;}
    .chat-bubble-user{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);}
    .chat-bubble-assistant{background:var(--vscode-editor-inactiveSelectionBackground,var(--vscode-widget-border));color:var(--vscode-foreground);border:1px solid var(--vscode-widget-border);}
    .chat-bubble-error{background:var(--vscode-inputValidation-errorBackground);color:var(--vscode-errorForeground);border:1px solid var(--vscode-inputValidation-errorBorder);}
    .chat-typing{opacity:0.8;}
    .chat-input-row{display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0;border-top:1px solid var(--vscode-widget-border);margin-top:0.25rem;}
    .chat-input{flex:1;padding:0.5rem 0.75rem;border-radius:8px;border:1px solid var(--vscode-input-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);font-size:var(--vscode-font-size);}
    .chat-input:focus{outline:1px solid var(--vscode-focusBorder);outline-offset:-1px;}
    .chat-send{padding:0.5rem 1rem;border-radius:8px;border:1px solid var(--vscode-button-border);background:var(--vscode-button-background);color:var(--vscode-button-foreground);font-size:var(--vscode-font-size);cursor:pointer;}
    .chat-send:hover:not(:disabled){background:var(--vscode-button-hoverBackground);}
    .chat-send:disabled{opacity:0.5;cursor:default;}
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
    let sessionView = [];
    let moduleView = { modules: {} };
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
        if (typeof awarenessEngine.getSessionView === 'function') {
            const sinceTs = Date.now() - 7 * 24 * 60 * 60 * 1000;
            sessionView = awarenessEngine.getSessionView(sinceTs) || [];
        }
        if (typeof awarenessEngine.getModuleView === 'function') {
            moduleView = await awarenessEngine.getModuleView().catch(() => ({ modules: {} }));
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
        capabilities,
        sessionView,
        moduleView
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
                : buildDashboardWebviewHtml(scoreData, scoreBreakdown, currentMode, antipatternBreakdown, events, tokenUsage, capabilities, sessionView, moduleView);
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
            const extensionPath = extensionContext ? extensionContext.extensionPath : '';
            try {
                const result = await dashboardChat.reply(vscode, payload, msg.text, logger, { extensionPath });
                const text = result.text != null ? result.text : (result.error || stubReply);
                const isConfigMessage = result.error && (result.error.includes('API key') || result.error.includes('disabled'));
                panel.webview.postMessage({ command: 'chatReply', id: msg.id, text, error: !isConfigMessage ? (result.error || undefined) : undefined, providerUsed: result.providerUsed });
            } catch (err) {
                panel.webview.postMessage({ command: 'chatReply', id: msg.id, text: err.message || stubReply, error: err.message || 'Request failed' });
            }
        });
        if (state) state.useReactDashboard = true;
    } else {
        panel.webview.html = buildDashboardWebviewHtml(scoreData, scoreBreakdown, currentMode, antipatternBreakdown, events, tokenUsage, capabilities, sessionView, moduleView);
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
    DashboardContentProvider,
    buildReactDashboardHtml,
    sendPayloadToWebview
};
