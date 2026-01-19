/**
 * LLM module composition helper.
 *
 * Creates InsightStore + AwarenessLLMInsightService + adapters.
 * Keeps wiring out of the awareness module.
 */

const InsightStore = require('./app/insightStore');
const AwarenessLLMInsightService = require('./app/awarenessLLMInsightService');

const VSCodeLLMConfigAdapter = require('./infrastructure/adapters/vscodeLLMConfigAdapter');
const WorkspaceStateCacheAdapter = require('./infrastructure/adapters/workspaceStateCacheAdapter');
const InMemoryRateLimiterAdapter = require('./infrastructure/adapters/inMemoryRateLimiterAdapter');
const LocalHeuristicLLMClientAdapter = require('./infrastructure/adapters/localHeuristicLLMClientAdapter');
const OpenAIChatLLMClientAdapter = require('./infrastructure/adapters/openAIChatLLMClientAdapter');
const LLMClientRouterAdapter = require('./infrastructure/adapters/llmClientRouterAdapter');

function composeLLM({ context, loggerPort = null } = {}) {
    const configPort = new VSCodeLLMConfigAdapter();
    const insightStore = new InsightStore();

    const cachePort = new WorkspaceStateCacheAdapter(context);

    // Rate limiter is configured from config at construction time.
    // If user changes budgets at runtime, it will take effect on reload (acceptable for now).
    const cfg = configPort.getConfig();
    const rateLimiterPort = new InMemoryRateLimiterAdapter({
        maxPerMinute: cfg.maxPerMinute,
        maxPerDay: cfg.maxPerDay
    });

    const localClient = new LocalHeuristicLLMClientAdapter();
    const openAIClientFactory = (openaiCfg) =>
        new OpenAIChatLLMClientAdapter({
            apiKey: openaiCfg?.apiKey,
            model: openaiCfg?.model
        });

    const llmClientPort = new LLMClientRouterAdapter({
        configPort,
        localClient,
        openAIClientFactory
    });

    const insightService = new AwarenessLLMInsightService({
        llmClientPort,
        configPort,
        cachePort,
        rateLimiterPort,
        insightStore,
        loggerPort
    });

    return {
        insightService,
        insightStore
    };
}

module.exports = {
    composeLLM
};

