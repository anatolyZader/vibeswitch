/**
 * Adapter: implements IResearchAgentPort using HTTP (ResearchAgentClient).
 * POSTs payload to baseUrl/ingest with optional Bearer API key.
 */
const { createResearchAgentClient } = require('../ResearchAgentClient');

/**
 * Create an agent client adapter that implements IResearchAgentPort.
 * @param {Object} opts - { baseUrl: string, getApiKey?: () => Promise<string|null>, timeoutMs?: number, loggerPort?: { error } }
 * @returns {{ send: (payload: Object) => Promise<{ ok: boolean, status?: number, error?: string }> }}
 */
function createResearchAgentClientAdapter(opts) {
    return createResearchAgentClient(opts);
}

module.exports = {
    createResearchAgentClientAdapter
};
