/**
 * DashboardChatService: orchestration for read-only dashboard chat.
 * Supports OpenAI, Claude, and auto provider selection. Enhanced codebase awareness for Claude.
 * Only write: create_insight tool (restricted to insights/ directory).
 */

const ContextBuilder = require('./ContextBuilder');
const { getReadOnlyContext } = require('../infrastructure/adapters/WorkspaceContextAdapter');
const { getEnhancedReadOnlyContext } = require('../infrastructure/adapters/EnhancedWorkspaceContextAdapter');
const { createOpenAILLMAdapter } = require('../infrastructure/adapters/OpenAILLMAdapter');
const { createClaudeLLMAdapter } = require('../infrastructure/adapters/ClaudeLLMAdapter');
const { analyzePrompt, explainProviderChoice } = require('./PromptAnalyzer');
const InsightsWriter = require('./InsightsWriter');
const OperationValidator = require('./OperationValidator');

const DEFAULT_TIMEOUT_MS = 15000;

const CREATE_INSIGHT_TOOL = {
    name: 'create_insight',
    description: 'Create a markdown insight/review file in the designated insights directory. Use when the user explicitly asks to save, document, or create a review/report/assessment file. Do not use for simple Q&A. The file will be saved under business_modules/dashboard-chat/insights/ with a timestamped filename.',
    input_schema: {
        type: 'object',
        properties: {
            filename: { type: 'string', description: 'Base filename without extension (e.g. architecture-review)' },
            content: { type: 'string', description: 'Markdown content of the insight' },
            title: { type: 'string', description: 'Optional title for the document' }
        },
        required: ['filename', 'content']
    }
};

/**
 * Get dashboard chat config from VS Code settings.
 * @param {typeof import('vscode')} vscode
 * @returns {object}
 */
function getConfig(vscode) {
    if (!vscode || !vscode.workspace) {
        return {
            enabled: false,
            provider: 'auto',
            openai: { apiKey: '', model: 'gpt-4o-mini' },
            claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022' },
            useWorkspaceContext: true,
            includeKeyFiles: true,
            enhancedCodebaseAwareness: true,
            timeoutMs: DEFAULT_TIMEOUT_MS
        };
    }
    const cfg = vscode.workspace.getConfiguration('vibeswitch');
    const enabled = cfg.get('dashboardChat.enabled', true) !== false;
    const provider = cfg.get('dashboardChat.provider', 'auto');
    const useWorkspaceContext = cfg.get('dashboardChat.useWorkspaceContext', true) !== false;
    const includeKeyFiles = cfg.get('dashboardChat.includeKeyFiles', true) !== false;
    const enhancedCodebaseAwareness = cfg.get('dashboardChat.enhancedCodebaseAwareness', true) !== false;
    const timeoutMs = cfg.get('dashboardChat.timeoutMs', DEFAULT_TIMEOUT_MS);

    const openaiApiKey = (cfg.get('dashboardChat.openai.apiKey', '') || cfg.get('llm.openai.apiKey', '') || '').trim();
    const openaiModel = cfg.get('dashboardChat.openai.model', '') || cfg.get('llm.openai.model', '') || 'gpt-4o-mini';

    const claudeApiKey = (cfg.get('dashboardChat.claude.apiKey', '') || '').trim();
    const claudeModel = cfg.get('dashboardChat.claude.model', '') || 'claude-3-5-sonnet-20241022';

    return {
        enabled,
        provider,
        openai: { apiKey: openaiApiKey, model: openaiModel },
        claude: { apiKey: claudeApiKey, model: claudeModel },
        useWorkspaceContext,
        includeKeyFiles,
        enhancedCodebaseAwareness,
        timeoutMs
    };
}

/**
 * Resolve effective provider (openai or claude) for auto mode.
 * @param {string} userMessage
 * @param {object} config
 * @param {number} openFileCount
 * @returns {string}
 */
function resolveProvider(userMessage, config, openFileCount) {
    const prov = (config.provider || 'auto').toLowerCase();
    if (prov === 'openai') return 'openai';
    if (prov === 'claude') return 'claude';
    if (prov === 'auto') {
        const { provider } = analyzePrompt(userMessage, { openFileCount });
        return provider;
    }
    return 'openai';
}

/**
 * Reply to a dashboard chat message.
 * @param {typeof import('vscode')} vscode
 * @param {Object} payload
 * @param {string} userMessage
 * @param {{ log?: function, error?: function }} [logger]
 * @param {{ extensionPath?: string }} [opts]
 * @returns {Promise<{ text: string|null, error?: string, providerUsed?: string }>}
 */
async function reply(vscode, payload, userMessage, logger, opts) {
    const errLog = logger && typeof logger.error === 'function' ? logger.error : function () {};
    const config = getConfig(vscode);

    if (!config.enabled) {
        return { text: null, error: 'Dashboard chat is disabled. Enable it in Settings (VibeSwitch: Dashboard Chat).' };
    }

    const effectiveProvider = resolveProvider(
        userMessage,
        config,
        (vscode.workspace && vscode.workspace.textDocuments ? vscode.workspace.textDocuments.length : 0)
    );

    const hasOpenAI = !!config.openai.apiKey;
    const hasClaude = !!config.claude.apiKey;

    if (effectiveProvider === 'claude' && !hasClaude) {
        if (hasOpenAI) {
            return { text: null, error: 'Claude selected but no Claude API key. Add vibeswitch.dashboardChat.claude.apiKey or use provider: openai.' };
        }
        return { text: null, error: 'No API key set. Add OpenAI or Claude API key in Settings (VibeSwitch: Dashboard Chat).' };
    }
    if (effectiveProvider === 'openai' && !hasOpenAI) {
        if (hasClaude) {
            return { text: null, error: 'OpenAI selected but no OpenAI API key. Add vibeswitch.dashboardChat.openai.apiKey or use provider: claude.' };
        }
        return { text: null, error: 'No API key set. Add OpenAI or Claude API key in Settings (VibeSwitch: Dashboard Chat).' };
    }

    const useEnhanced = effectiveProvider === 'claude' && config.enhancedCodebaseAwareness;
    const systemPrompt = ContextBuilder.getSystemPrompt(effectiveProvider, useEnhanced);

    let codebaseContext = '';
    if (config.useWorkspaceContext) {
        try {
            if (useEnhanced) {
                codebaseContext = await getEnhancedReadOnlyContext(vscode, { includeKeyFiles: config.includeKeyFiles });
            } else {
                codebaseContext = await getReadOnlyContext(vscode, { includeKeyFiles: config.includeKeyFiles });
            }
        } catch (e) {
            errLog('DashboardChat: workspace context failed', e);
        }
    }

    const userContent = ContextBuilder.buildUserContent(payload, codebaseContext, userMessage);

    const extensionPath = (opts && opts.extensionPath) || '';

    const toolHandler = async (name, input) => {
        if (name !== 'create_insight') {
            const v = OperationValidator.validateToolRequest({ tool: name, input });
            if (!v.allowed) return JSON.stringify({ error: v.reason });
        }
        if (name === 'create_insight' && extensionPath) {
            const filename = (input && input.filename) || 'insight';
            const content = (input && input.content) || '';
            const meta = { title: input && input.title, provider: effectiveProvider };
            const result = await InsightsWriter.writeInsight(extensionPath, filename, content, meta);
            if (result.success) {
                return `Insight created at ${result.path}`;
            }
            return `Failed: ${result.error}`;
        }
        return 'Tool not available';
    };

    const tools = effectiveProvider === 'claude' ? [CREATE_INSIGHT_TOOL] : [];
    const toolValidation = OperationValidator.validateToolDefinitions(tools);
    if (!toolValidation.valid) {
        return { text: null, error: 'Security error: ' + (toolValidation.reason || 'Unauthorized tools') };
    }

    let llm;
    if (effectiveProvider === 'claude') {
        llm = createClaudeLLMAdapter({
            apiKey: config.claude.apiKey,
            model: config.claude.model,
            timeoutMs: config.timeoutMs,
            maxTokens: 4096
        });
    } else {
        llm = createOpenAILLMAdapter({
            apiKey: config.openai.apiKey,
            model: config.openai.model,
            timeoutMs: config.timeoutMs
        });
    }

    try {
        let text;
        if (effectiveProvider === 'claude' && tools.length > 0) {
            text = await llm.chat(systemPrompt, userContent, {
                tools,
                toolHandler
            });
        } else {
            text = await llm.chat(systemPrompt, userContent);
        }

        const contentCheck = OperationValidator.validateResponseContent(text || '');
        if (!contentCheck.safe) {
            return { text: null, error: 'Security error: ' + (contentCheck.reason || 'Unsafe content') };
        }

        const providerNote = config.provider === 'auto' ? '\n\n---\n*' + explainProviderChoice(userMessage) + '*' : '';

        return {
            text: (text || '') + providerNote,
            providerUsed: effectiveProvider
        };
    } catch (err) {
        errLog('DashboardChat: LLM request failed', err);
        return { text: null, error: err.message || 'Request failed' };
    }
}

module.exports = {
    reply,
    getConfig
};
