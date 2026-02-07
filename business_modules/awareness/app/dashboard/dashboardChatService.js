/**
 * Read-only dashboard chat agent: answers using dashboard context + optional workspace content.
 * No write/terminal/git; only read APIs. Isolated from main Cursor agent workflow.
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const SYSTEM_PROMPT = `You are a read-only assistant for the VibeSwitch dashboard. You have access to:
- Dashboard metrics (risk scores, antipatterns, events, token usage)
- Optional read-only snippets from the user's codebase (no ability to edit or run anything)

Rules:
- Only discuss, explain, and answer questions. Never suggest file edits, terminal commands, or git operations.
- You cannot execute code or change the workspace. If the user asks to change something, explain that you are read-only and they should use the main editor/agent for that.
- Be concise. Use the provided context to give relevant answers about metrics, code structure, or events.`;

const MAX_CONTEXT_CHARS = 12000;
const MAX_OPEN_FILES = 8;
const MAX_FILE_CHARS = 2000;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Get workspace context from open documents only (read-only). No file writes or searches that touch disk heavily.
 * @param {typeof import('vscode')} vscode - VS Code API
 * @returns {Promise<string>} Context string (snippets from open code files)
 */
async function getReadOnlyWorkspaceContext(vscode) {
    if (!vscode || !vscode.workspace) return '';
    const docs = vscode.workspace.textDocuments || [];
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.md'];
    let total = 0;
    const parts = [];
    for (const doc of docs) {
        if (total >= MAX_CONTEXT_CHARS) break;
        if (parts.length >= MAX_OPEN_FILES) break;
        const uri = doc.uri;
        if (!uri || uri.scheme !== 'file') continue;
        const ext = (uri.fsPath || '').toLowerCase();
        if (!codeExtensions.some((e) => ext.endsWith(e))) continue;
        const text = doc.getText && doc.getText();
        if (!text || typeof text !== 'string') continue;
        const name = uri.fsPath ? uri.fsPath.split(/[/\\]/).pop() : 'file';
        const snippet = text.length > MAX_FILE_CHARS ? text.slice(0, MAX_FILE_CHARS) + '\n...' : text;
        parts.push(`--- ${name} ---\n${snippet}`);
        total += snippet.length;
    }
    if (parts.length === 0) return '';
    return '\n\n[Open files context]\n' + parts.join('\n\n');
}

/**
 * Build dashboard summary string from payload (no PII; metrics and events only).
 */
function buildDashboardSummary(payload) {
    const p = payload || {};
    const score = p.scoreData && typeof p.scoreData.total === 'number' ? p.scoreData.total : 0;
    const mode = p.currentMode || 'dev';
    const events = p.events || [];
    const breakdown = p.antipatternBreakdown || {};
    const lines = [
        `Mode: ${mode}, Risk: ${score}/100`,
        `Events (${events.length}): ${events.slice(0, 5).map((e) => e.label || e.type).join('; ') || 'none'}`,
        `Boundary violations risk: ${breakdown.boundaryViolations && breakdown.boundaryViolations.risk0To100 != null ? breakdown.boundaryViolations.risk0To100 : 0}`,
        `Verification debt: ${breakdown.verificationDebt && breakdown.verificationDebt.risk0To100 != null ? breakdown.verificationDebt.risk0To100 : 0}`,
        `Token usage: ${(p.tokenUsage && p.tokenUsage.totalTokens) || 0} total`
    ];
    return '[Dashboard]\n' + lines.join('\n');
}

/**
 * Call OpenAI chat completions (no tools). Returns assistant text or null.
 */
async function callOpenAIChat(apiKey, model, systemContent, userContent, timeoutMs) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs || REQUEST_TIMEOUT_MS);
    try {
        const res = await fetch(OPENAI_CHAT_URL, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || 'gpt-4.1-mini',
                temperature: 0.3,
                max_tokens: 1024,
                messages: [
                    { role: 'system', content: systemContent },
                    { role: 'user', content: userContent }
                ]
            })
        });
        clearTimeout(t);
        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 150)}`);
        }
        const data = await res.json();
        const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        return typeof text === 'string' ? text.trim() : null;
    } catch (err) {
        clearTimeout(t);
        throw err;
    }
}

/**
 * Get dashboard chat config from VS Code settings. Reuses llm.openai for API key when possible.
 */
function getConfig(vscode) {
    if (!vscode || !vscode.workspace) return { enabled: false, apiKey: '', model: 'gpt-4.1-mini', useWorkspaceContext: true };
    const cfg = vscode.workspace.getConfiguration('vibeswitch');
    const dashboardCfg = cfg.get('dashboardChat.enabled', true);
    const useWorkspace = cfg.get('dashboardChat.useWorkspaceContext', true);
    const apiKey = cfg.get('dashboardChat.openai.apiKey', '') || cfg.get('llm.openai.apiKey', '');
    const model = cfg.get('dashboardChat.openai.model', '') || cfg.get('llm.openai.model', 'gpt-4.1-mini');
    return {
        enabled: dashboardCfg !== false,
        apiKey: typeof apiKey === 'string' ? apiKey.trim() : '',
        model: model || 'gpt-4.1-mini',
        useWorkspaceContext: useWorkspace !== false,
        timeoutMs: cfg.get('dashboardChat.timeoutMs', REQUEST_TIMEOUT_MS)
    };
}

/**
 * Reply to a dashboard chat message using read-only context and LLM. Returns response text or null (use stub on null).
 * @param {typeof import('vscode')} vscode - VS Code API
 * @param {Object} payload - Current dashboard payload (scoreData, events, antipatternBreakdown, etc.)
 * @param {string} userMessage - User's message
 * @param {Object} [logger] - Optional { log, error }
 * @returns {Promise<{ text: string | null, error?: string }>}
 */
async function reply(vscode, payload, userMessage, logger) {
    const log = logger && logger.log ? logger.log : () => {};
    const errLog = logger && logger.error ? logger.error : () => {};
    const config = getConfig(vscode);
    if (!config.enabled || !config.apiKey) {
        return { text: null };
    }
    const dashboardSummary = buildDashboardSummary(payload);
    let workspaceContext = '';
    if (config.useWorkspaceContext) {
        try {
            workspaceContext = await getReadOnlyWorkspaceContext(vscode);
        } catch (e) {
            errLog('DashboardChat: workspace context failed', e);
        }
    }
    const userContent = `${dashboardSummary}${workspaceContext}\n\nUser question: ${userMessage}`;
    try {
        const text = await callOpenAIChat(
            config.apiKey,
            config.model,
            SYSTEM_PROMPT,
            userContent,
            config.timeoutMs
        );
        return { text: text || null };
    } catch (err) {
        errLog('DashboardChat: LLM request failed', err);
        return { text: null, error: err.message || 'Request failed' };
    }
}

module.exports = {
    reply,
    getConfig,
    buildDashboardSummary,
    getReadOnlyWorkspaceContext
};
