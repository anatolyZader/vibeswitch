/**
 * DashboardChatService: orchestration for read-only dashboard chat.
 * Builds context (dashboard summary + codebase), calls LLM adapter, returns reply.
 */

const ContextBuilder = require('./ContextBuilder');
const { getReadOnlyContext } = require('../infrastructure/adapters/WorkspaceContextAdapter');
const { getEnhancedReadOnlyContext } = require('../infrastructure/adapters/EnhancedWorkspaceContextAdapter');
const { createOpenAILLMAdapter } = require('../infrastructure/adapters/OpenAILLMAdapter');
const { createClaudeLLMAdapter } = require('../infrastructure/adapters/ClaudeLLMAdapter');

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Get dashboard chat config from VS Code settings. Supports both OpenAI and Claude providers.
 * @param {typeof import('vscode')} vscode
 * @returns {{ enabled: boolean, provider: string, apiKey: string, model: string, useWorkspaceContext: boolean, includeKeyFiles: boolean, timeoutMs: number }}
 */
function getConfig(vscode) {
    if (!vscode || !vscode.workspace) {
        return { enabled: false, provider: 'openai', apiKey: '', model: 'gpt-4o-mini', useWorkspaceContext: true, includeKeyFiles: true, timeoutMs: DEFAULT_TIMEOUT_MS };
    }
    const cfg = vscode.workspace.getConfiguration('vibeswitch');
    const enabled = cfg.get('dashboardChat.enabled', true) !== false;
    const provider = cfg.get('dashboardChat.provider', 'openai');
    const useWorkspaceContext = cfg.get('dashboardChat.useWorkspaceContext', true) !== false;
    const includeKeyFiles = cfg.get('dashboardChat.includeKeyFiles', true) !== false;
    const timeoutMs = cfg.get('dashboardChat.timeoutMs', DEFAULT_TIMEOUT_MS);
    
    // Get API key and model based on provider
    let apiKey = '';
    let model = '';
    
    if (provider === 'claude') {
        apiKey = (cfg.get('dashboardChat.claude.apiKey', '') || '').trim();
        model = cfg.get('dashboardChat.claude.model', '') || 'claude-3-5-sonnet-20241022';
    } else {
        // Default to OpenAI
        apiKey = (cfg.get('dashboardChat.openai.apiKey', '') || cfg.get('llm.openai.apiKey', '') || '').trim();
        model = cfg.get('dashboardChat.openai.model', '') || cfg.get('llm.openai.model', '') || 'gpt-4o-mini';
    }
    
    return {
        enabled,
        provider,
        apiKey,
        model,
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
        const providerName = config.provider === 'claude' ? 'Claude' : 'OpenAI';
        return { text: null, error: `No ${providerName} API key set. Add your key in Settings under VibeSwitch: Dashboard Chat (${providerName} API Key) to get explanations about meters and antipatterns.` };
    }

    const systemPrompt = ContextBuilder.getSystemPrompt(config.provider);
    let codebaseContext = '';
    if (config.useWorkspaceContext) {
        try {
            // Use enhanced context for Claude (larger context window, more codebase awareness)
            if (config.provider === 'claude') {
                codebaseContext = await getEnhancedReadOnlyContext(vscode, { 
                    includeKeyFiles: config.includeKeyFiles,
                    enhancedMode: true,
                    provider: 'claude'
                });
            } else {
                codebaseContext = await getReadOnlyContext(vscode, { includeKeyFiles: config.includeKeyFiles });
            }
        } catch (e) {
            errLog('DashboardChat: workspace context failed', e);
        }
    }
    const userContent = ContextBuilder.buildUserContent(payload, codebaseContext, userMessage);

    // Create appropriate LLM adapter based on provider
    let llm;
    if (config.provider === 'claude') {
        llm = createClaudeLLMAdapter({
            apiKey: config.apiKey,
            model: config.model,
            timeoutMs: config.timeoutMs
        });
    } else {
        llm = createOpenAILLMAdapter({
            apiKey: config.apiKey,
            model: config.model,
            timeoutMs: config.timeoutMs
        });
    }

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
