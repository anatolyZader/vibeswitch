/**
 * Research Agent Client - Sends gathered objective code-quality data to an external analysis service.
 * The external service (Fastify app on Cloud Run) performs calculations and analysis via Claude/code agent;
 * this client only POSTs the payload. No analysis is done in the extension.
 */

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Create a client that POSTs research payloads to the external agent URL.
 * @param {Object} opts - { baseUrl: string, getApiKey?: () => Promise<string|null>, timeoutMs?: number, loggerPort?: { error } }
 * @returns {{ send: (payload: Object) => Promise<{ ok: boolean, status?: number, error?: string }> }}
 */
function createResearchAgentClient(opts) {
    const baseUrl = (opts && opts.baseUrl) || '';
    const getApiKey = opts && opts.getApiKey ? opts.getApiKey : async () => null;
    const timeoutMs = (opts && opts.timeoutMs) || DEFAULT_TIMEOUT_MS;
    const logger = opts && opts.loggerPort ? opts.loggerPort : null;

    /**
     * POST payload to the agent ingest endpoint.
     * @param {Object} payload - Research payload (scoreData, antipatternBreakdown, tokenUsage, sonarMeasures, etc.)
     * @returns {Promise<{ ok: boolean, status?: number, error?: string }>}
     */
    async function send(payload) {
        if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
            return { ok: false, error: 'Research agent URL not configured' };
        }
        const url = `${baseUrl.replace(/\/$/, '')}/ingest`;
        try {
            const headers = { 'Content-Type': 'application/json' };
            const apiKey = await getApiKey().catch(() => null);
            if (apiKey && typeof apiKey === 'string') {
                headers.Authorization = `Bearer ${apiKey}`;
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) {
                if (logger && logger.error) logger.error('Research agent ingest non-OK', res.status, res.statusText);
                return { ok: false, status: res.status, error: res.statusText || 'Request failed' };
            }
            return { ok: true, status: res.status };
        } catch (err) {
            if (logger && logger.error) logger.error('Research agent ingest failed', err);
            return { ok: false, error: err && err.message ? err.message : 'Network error' };
        }
    }

    return { send };
}

module.exports = {
    createResearchAgentClient,
    DEFAULT_TIMEOUT_MS
};
