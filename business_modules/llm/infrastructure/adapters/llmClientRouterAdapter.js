/**
 * LLMClientRouterAdapter
 *
 * Selects the LLM client implementation based on config.provider.
 */

class LLMClientRouterAdapter {
    constructor({ configPort, localClient, openAIClientFactory }) {
        this.configPort = configPort;
        this.localClient = localClient;
        this.openAIClientFactory = openAIClientFactory;
    }

    async analyzeBatch({ prompt, schema, timeoutMs }) {
        const cfg = this.configPort.getConfig();
        const provider = (cfg.provider || 'local').toLowerCase();

        if (provider === 'openai') {
            const client = this.openAIClientFactory(cfg.openai);
            return await client.analyzeBatch({ prompt, schema, timeoutMs });
        }

        // default: local
        return await this.localClient.analyzeBatch({ prompt, schema, timeoutMs });
    }
}

module.exports = LLMClientRouterAdapter;

