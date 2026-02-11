/**
 * DashboardChatService: orchestration for read-only dashboard chat.
 * Builds context (dashboard summary + codebase), calls LLM adapter, returns reply.
 */

const ContextBuilder = require('./ContextBuilder');
const { getReadOnlyContext } = require('../infrastructure/adapters/WorkspaceContextAdapter');
const { getEnhancedReadOnlyContext } = require('../infrastructure/adapters/EnhancedWorkspaceContextAdapter');
const { createOpenAILLMAdapter } = require('../infrastructure/adapters/OpenAILLMAdapter');
const { createClaudeLLMAdapter } = require('../infrastructure/adapters/ClaudeLLMAdapter');
const { analyzePrompt } = require('./PromptAnalyzer');
const { createInsight } = require('./InsightsWriter');

const DEFAULT_TIMEOUT_MS = 15000;

// Tool definition for Claude to create insights
const CREATE_INSIGHT_TOOL = {
    name: 'create_insight',
    description: 'Creates a markdown insight/review file in the insights directory. Use this to save comprehensive analysis, architecture reviews, code quality assessments, or technical findings. Only use when user requests it or after completing a detailed analysis worth preserving.',
    input_schema: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'Title for the insight document (e.g., "Architecture Review 2026-02-11", "Technical Debt Assessment")'
            },
            content: {
                type: 'string',
                description: 'Markdown content for the insight. Should be well-structured with headers, lists, and code examples. Be comprehensive and actionable.'
            },
            filename: {
                type: 'string',
                description: 'Optional custom filename (must end in .md, use alphanumeric/dash/underscore only). If not provided, auto-generated with timestamp.'
            }
        },
        required: ['title', 'content']
    }
};

/**
 * Get dashboard chat config from VS Code settings. Supports OpenAI, Claude, and auto selection.
 * @param {typeof import('vscode')} vscode
 * @returns {{ enabled: boolean, provider: string, openaiApiKey: string, claudeApiKey: string, openaiModel: string, claudeModel: string, useWorkspaceContext: boolean, includeKeyFiles: boolean, timeoutMs: number }}
 */
function getConfig(vscode) {
    if (!vscode || !vscode.workspace) {
        return { 
            enabled: false, 
            provider: 'openai', 
            openaiApiKey: '', 
            claudeApiKey: '',
            openaiModel: 'gpt-4o-mini',
            claudeModel: 'claude-3-5-sonnet-20241022',
            useWorkspaceContext: true, 
            includeKeyFiles: true, 
            timeoutMs: DEFAULT_TIMEOUT_MS 
        };
    }
    const cfg = vscode.workspace.getConfiguration('vibeswitch');
    const enabled = cfg.get('dashboardChat.enabled', true) !== false;
    const provider = cfg.get('dashboardChat.provider', 'openai'); // Can be 'openai', 'claude', or 'auto'
    const useWorkspaceContext = cfg.get('dashboardChat.useWorkspaceContext', true) !== false;
    const includeKeyFiles = cfg.get('dashboardChat.includeKeyFiles', true) !== false;
    const timeoutMs = cfg.get('dashboardChat.timeoutMs', DEFAULT_TIMEOUT_MS);
    
    // Get API keys for both providers (needed for auto mode)
    const openaiApiKey = (cfg.get('dashboardChat.openai.apiKey', '') || cfg.get('llm.openai.apiKey', '') || '').trim();
    const claudeApiKey = (cfg.get('dashboardChat.claude.apiKey', '') || '').trim();
    
    // Get models for both providers
    const openaiModel = cfg.get('dashboardChat.openai.model', '') || cfg.get('llm.openai.model', '') || 'gpt-4o-mini';
    const claudeModel = cfg.get('dashboardChat.claude.model', '') || 'claude-3-5-sonnet-20241022';
    
    return {
        enabled,
        provider,
        openaiApiKey,
        claudeApiKey,
        openaiModel,
        claudeModel,
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
    const infoLog = logger && typeof logger.log === 'function' ? logger.log : function () {};
    const config = getConfig(vscode);
    
    if (!config.enabled) {
        return { text: null, error: 'Dashboard chat is disabled. Enable it in Settings (VibeSwitch: Dashboard Chat).' };
    }

    // Determine actual provider to use (handle 'auto' mode)
    let actualProvider = config.provider;
    let providerSelectionInfo = null;
    
    if (config.provider === 'auto') {
        // Analyze prompt to determine optimal provider
        const openFileCount = vscode?.workspace?.textDocuments?.length || 0;
        const analysis = analyzePrompt(userMessage, { openFileCount });
        actualProvider = analysis.recommendedProvider;
        providerSelectionInfo = {
            mode: 'auto',
            selected: actualProvider,
            complexity: analysis.complexity,
            score: analysis.score,
            reasons: analysis.reasons
        };
        infoLog(`DashboardChat: Auto-selected ${actualProvider} (complexity: ${analysis.complexity}, score: ${analysis.score})`);
    }

    // Check API key for selected provider
    const apiKey = actualProvider === 'claude' ? config.claudeApiKey : config.openaiApiKey;
    if (!apiKey) {
        const providerName = actualProvider === 'claude' ? 'Claude' : 'OpenAI';
        if (config.provider === 'auto') {
            return { 
                text: null, 
                error: `Auto-selection chose ${providerName}, but no API key is set. Add your ${providerName} API key in Settings, or set both OpenAI and Claude keys for full auto mode.` 
            };
        }
        return { 
            text: null, 
            error: `No ${providerName} API key set. Add your key in Settings under VibeSwitch: Dashboard Chat (${providerName} API Key) to get explanations about meters and antipatterns.` 
        };
    }

    const model = actualProvider === 'claude' ? config.claudeModel : config.openaiModel;
    const systemPrompt = ContextBuilder.getSystemPrompt(actualProvider);
    
    let codebaseContext = '';
    if (config.useWorkspaceContext) {
        try {
            // Use enhanced context for Claude (larger context window, more codebase awareness)
            if (actualProvider === 'claude') {
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

    // Create appropriate LLM adapter based on actual provider
    let llm;
    if (actualProvider === 'claude') {
        llm = createClaudeLLMAdapter({
            apiKey,
            model,
            timeoutMs: config.timeoutMs
        });
    } else {
        llm = createOpenAILLMAdapter({
            apiKey,
            model,
            timeoutMs: config.timeoutMs
        });
    }

    try {
        // Prepare tools array (only for Claude with enhanced mode)
        const tools = actualProvider === 'claude' ? [CREATE_INSIGHT_TOOL] : undefined;
        
        const response = await llm.chat(systemPrompt, userContent, tools);
        
        // Handle tool use response from Claude
        if (response && typeof response === 'object' && response.type === 'tool_use') {
            if (response.tool === 'create_insight') {
                infoLog('DashboardChat: Claude requested to create insight');
                
                // Get extension path from vscode context
                const extensionPath = vscode?.extensionPath || process.cwd();
                
                // Execute the insight creation
                const insightResult = await createInsight(extensionPath, {
                    title: response.input.title,
                    content: response.input.content,
                    filename: response.input.filename,
                    metadata: {
                        provider: actualProvider,
                        autoSelected: config.provider === 'auto',
                        createdBy: 'dashboard-chat'
                    }
                });
                
                if (insightResult.success) {
                    const successMessage = `✅ **Insight Created Successfully**\n\nI've saved the analysis to:\n\`${insightResult.relativePath}\`\n\nYou can find it in your workspace under the dashboard-chat insights directory.`;
                    
                    return {
                        text: successMessage,
                        providerUsed: actualProvider,
                        autoSelected: config.provider === 'auto',
                        insightCreated: true,
                        insightPath: insightResult.path,
                        insightFilename: insightResult.filename
                    };
                } else {
                    return {
                        text: null,
                        error: `Failed to create insight: ${insightResult.error}`,
                        providerUsed: actualProvider
                    };
                }
            }
        }
        
        // Handle regular text response
        const text = typeof response === 'string' ? response : null;
        
        // Include provider selection info in response if in auto mode
        let responseText = text || null;
        if (providerSelectionInfo && text) {
            const providerNote = `\n\n---\n*Auto-selected: ${actualProvider.toUpperCase()} (${providerSelectionInfo.complexity} question)*`;
            responseText = text + providerNote;
        }
        
        return { 
            text: responseText,
            providerUsed: actualProvider,
            autoSelected: config.provider === 'auto',
            selectionInfo: providerSelectionInfo
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
