/**
 * Cursor usage API client - Token usage monitoring (plan: get-filtered-usage-events).
 * Fetches usage events and aggregates input/output tokens. Session token from user or future DB read.
 */

const USAGE_API_URL = 'https://www.cursor.com/api/dashboard/get-filtered-usage-events';
const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Aggregate usage events to tokenUsage shape.
 * @param {Array<{ inputTokens?: number, outputTokens?: number, model?: string, cost?: number }>} events
 * @returns {{ totalInput: number, totalOutput: number, totalTokens: number, byModel: Array, costCents?: number }}
 */
function aggregateUsageEvents(events) {
    if (!Array.isArray(events)) {
        return { totalInput: 0, totalOutput: 0, totalTokens: 0, byModel: [] };
    }
    let totalInput = 0;
    let totalOutput = 0;
    const byModelMap = new Map();
    let costCents = 0;
    for (const e of events) {
        const in_ = e.inputTokens ?? e.prompt_tokens ?? 0;
        const out = e.outputTokens ?? e.completion_tokens ?? 0;
        totalInput += in_;
        totalOutput += out;
        const model = e.model || 'unknown';
        if (!byModelMap.has(model)) byModelMap.set(model, { model, input: 0, output: 0 });
        const row = byModelMap.get(model);
        row.input += in_;
        row.output += out;
        if (typeof e.cost === 'number') costCents += e.cost * 100;
        else if (typeof e.costCents === 'number') costCents += e.costCents;
    }
    const byModel = Array.from(byModelMap.values());
    return {
        totalInput,
        totalOutput,
        totalTokens: totalInput + totalOutput,
        byModel,
        costCents: costCents > 0 ? costCents : undefined
    };
}

/**
 * Create a token usage client.
 * @param {Object} opts - { getToken: () => Promise<string|null>, loggerPort?: { error } }
 */
function createCursorUsageApiClient(opts) {
    const getToken = opts && opts.getToken ? opts.getToken : async () => null;
    const logger = opts && opts.loggerPort ? opts.loggerPort : null;

    /**
     * Fetch usage events from Cursor API. Uses session token from getToken().
     * @returns {Promise<{ totalInput: number, totalOutput: number, totalTokens: number, byModel?: Array, costCents?: number, lastUpdatedTs: number, usageApiAvailable: boolean }>}
     */
    async function fetchTokenUsage() {
        const token = await getToken().catch(() => null);
        if (!token || typeof token !== 'string') {
            return {
                totalInput: 0,
                totalOutput: 0,
                totalTokens: 0,
                lastUpdatedTs: Date.now(),
                usageApiAvailable: false
            };
        }
        try {
            const res = await fetch(USAGE_API_URL, {
                method: 'POST',
                headers: { ...DEFAULT_HEADERS, Cookie: `WorkosCursorSessionToken=${token}` },
                body: JSON.stringify({})
            });
            if (!res.ok) {
                if (logger && logger.error) logger.error('Cursor usage API non-OK', res.status);
                return {
                    totalInput: 0,
                    totalOutput: 0,
                    totalTokens: 0,
                    lastUpdatedTs: Date.now(),
                    usageApiAvailable: false
                };
            }
            const data = await res.json().catch(() => ({}));
            const events = Array.isArray(data.events) ? data.events : (Array.isArray(data) ? data : []);
            const agg = aggregateUsageEvents(events);
            return {
                ...agg,
                lastUpdatedTs: Date.now(),
                usageApiAvailable: true
            };
        } catch (err) {
            if (logger && logger.error) logger.error('Cursor usage API fetch failed', err);
            return {
                totalInput: 0,
                totalOutput: 0,
                totalTokens: 0,
                lastUpdatedTs: Date.now(),
                usageApiAvailable: false
            };
        }
    }

    return { fetchTokenUsage, aggregateUsageEvents };
}

module.exports = {
    createCursorUsageApiClient,
    aggregateUsageEvents,
    USAGE_API_URL
};
