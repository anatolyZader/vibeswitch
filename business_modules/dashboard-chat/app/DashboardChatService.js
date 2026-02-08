/**
 * DashboardChatService: orchestration for read-only dashboard chat.
 * Builds context (dashboard summary + codebase), calls LLM adapter, returns reply.
 */

const ContextBuilder = require('./ContextBuilder');
const { getReadOnlyContext } = require('../infrastructure/adapters/WorkspaceContextAdapter');
const { createOpenAILLMAdapter } = require('../infrastructure/adapters/OpenAILLMAdapter');

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Get dashboard chat config from VS Code settings. Reuses llm.openai when dashboardChat keys are empty.
 * @param {typeof import('vscode')} vscode
 * @returns {{ enabled: boolean, apiKey: string, model: string, useWorkspaceContext: boolean, includeKeyFiles: boolean, timeoutMs: number }}
 */
function getConfig(vscode) {
    if (!vscode || !vscode.workspace) {
        return { enabled: false, apiKey: '', model: 'gpt-4o-mini', useWorkspaceContext: true, includeKeyFiles: true, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    const cfg = vscode.workspace.getConfiguration('vibeswitch');
    const enabled = cfg.get('dashboardChat.enabled', true) !== false;
    const useWorkspaceContext = cfg.get('dashboardChat.useWorkspaceContext', true) !== false;
    const apiKey = (cfg.get('dashboardChat.openai.apiKey', '') || cfg.get('llm.openai.apiKey', '') || '').trim();
    const model = cfg.get('dashboardChat.openai.model', '') || cfg.get('llm.openai.model', '') || 'gpt-4o-mini';
    const timeoutMs = cfg.get('dashboardChat.timeoutMs', DEFAULT_TIMEOUT_MS);
    const includeKeyFiles = cfg.get('dashboardChat.includeKeyFiles', true) !== false;
    return {
        enabled,
        apiKey,
        model: model || 'gpt-4o-mini',
        useWorkspaceContext,
        includeKeyFiles,
        timeoutMs
    };
}

/**
 * Reply to a dashboard chat message. Read-only: no tools, no writes.
 * @param {typeof import('vscode')} vscode - VS Code API
 * @param {Object} payload - Current dashboard payload (scoreData, events, antipatternBreakdown, tokenUsage, capabilities)
 * @param {string} userMessage - User's message
 * @param {{ log?: function, error?: function }} [logger]
 * @returns {Promise<{ text: string|null, error?: string }>}
 */
async function reply(vscode, payload, userMessage, logger) {
    const errLog = logger && typeof logger.error === 'function' ? logger.error : function () {};
    const config = getConfig(vscode);
    if (!config.enabled) {
        return { text: null, error: 'Dashboard chat is disabled. Enable it in Settings (VibeSwitch: Dashboard Chat).' };
    }
    if (!config.apiKey) {
        return { text: null, error: 'No OpenAI API key set. Add your key in Settings under VibeSwitch: Dashboard Chat (OpenAI API Key) to get explanations about meters and antipatterns.' };
    }

    const systemPrompt = ContextBuilder.getSystemPrompt();
    let codebaseContext = '';
    if (config.useWorkspaceContext) {
        try {
            codebaseContext = await getReadOnlyContext(vscode, { includeKeyFiles: config.includeKeyFiles });
        } catch (e) {
            errLog('DashboardChat: workspace context failed', e);
        }
    }
    const userContent = ContextBuilder.buildUserContent(payload, codebaseContext, userMessage);

    const llm = createOpenAILLMAdapter({
        apiKey: config.apiKey,
        model: config.model,
        timeoutMs: config.timeoutMs
    });

    try {
        const text = await llm.chat(systemPrompt, userContent);
        return { text: text || null };
    } catch (err) {
        errLog('DashboardChat: LLM request failed', err);
        return { text: null, error: err.message || 'Request failed' };
    }
}

module.exports = {
    reply,
    getConfig
};
