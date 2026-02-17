/**
 * Research Data Service - Gathers objective code quality data (Sonar, ESLint, token usage, extension metrics),
 * persists it to local SQLite (ResearchStore), and sends current + history from the store to the external
 * research agent. No calculations or analysis are done in the extension; the agent performs analysis.
 */

const { createResearchAgentClient } = require('../infrastructure/ResearchAgentClient');
const { createResearchStore } = require('../infrastructure/ResearchStore');

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const DEFAULT_LAST_DAYS = 7;
const DEFAULT_LAST_N = 50;

/**
 * Build the research payload from extension state (awarenessEngine, tokenUsageClient, sonarClient, etc.).
 * @param {Object} state - Extension state
 * @returns {Promise<Object>} Payload for the external agent
 */
async function gatherResearchPayload(state) {
    const payload = {
        timestamp: Date.now(),
        source: 'vibeswitch-extension',
        scoreData: null,
        antipatternBreakdown: null,
        tokenUsage: null,
        sonarMeasures: null,
        eslintMeasures: null,
        projectProgressMeasures: null,
        currentMode: (state && state.getMode ? state.getMode() : state && state.currentMode) || 'dev'
    };

    if (state && state.awarenessEngine) {
        try {
            payload.scoreData = state.awarenessEngine.getScore();
        } catch (_) {
            payload.scoreData = null;
        }
        try {
            if (typeof state.awarenessEngine.getAntipatternBreakdownAsync === 'function') {
                payload.antipatternBreakdown = await state.awarenessEngine.getAntipatternBreakdownAsync();
            } else if (typeof state.awarenessEngine.getAntipatternBreakdown === 'function') {
                payload.antipatternBreakdown = state.awarenessEngine.getAntipatternBreakdown();
            }
        } catch (_) {
            payload.antipatternBreakdown = null;
        }
    }

    if (state && state.tokenUsageClient && typeof state.tokenUsageClient.fetchTokenUsage === 'function') {
        try {
            payload.tokenUsage = await state.tokenUsageClient.fetchTokenUsage();
        } catch (_) {
            payload.tokenUsage = null;
        }
    }

    if (state && state.sonarClient && typeof state.sonarClient.fetchMeasures === 'function') {
        try {
            payload.sonarMeasures = await state.sonarClient.fetchMeasures();
        } catch (_) {
            payload.sonarMeasures = null;
        }
    }

    if (state && state.eslintClient && typeof state.eslintClient.fetchMeasures === 'function') {
        try {
            payload.eslintMeasures = await state.eslintClient.fetchMeasures();
        } catch (_) {
            payload.eslintMeasures = null;
        }
    }

    if (state && state.projectProgressClient && typeof state.projectProgressClient.fetchMeasures === 'function') {
        try {
            payload.projectProgressMeasures = await state.projectProgressClient.fetchMeasures();
        } catch (_) {
            payload.projectProgressMeasures = null;
        }
    }

    return payload;
}

/**
 * Create the research data service: gathers payload, persists to SQLite, then sends current + history from store to agent.
 * @param {Object} opts - { state, getAgentUrl: () => string, getApiKey?: () => Promise<string|null>, getDbPath?: () => string, pollIntervalMs?: number, lastDays?: number, lastN?: number, loggerPort?: { error } }
 * @returns {{ start: () => void, stop: () => void, gatherResearchPayload: typeof gatherResearchPayload }}
 */
function createResearchDataService(opts) {
    const state = opts && opts.state;
    const getAgentUrl = opts && opts.getAgentUrl ? opts.getAgentUrl : () => '';
    const getApiKey = opts && opts.getApiKey ? opts.getApiKey : async () => null;
    const getDbPath = opts && opts.getDbPath ? opts.getDbPath : null;
    const pollIntervalMs = (opts && opts.pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS;
    const lastDays = (opts && opts.lastDays) != null ? opts.lastDays : DEFAULT_LAST_DAYS;
    const lastN = (opts && opts.lastN) != null ? opts.lastN : DEFAULT_LAST_N;
    const logger = opts && opts.loggerPort ? opts.loggerPort : null;

    let intervalId = null;
    let storePromise = null;

    function getStore() {
        if (!storePromise && getDbPath) {
            storePromise = createResearchStore(getDbPath(), { loggerPort: logger });
        }
        return storePromise;
    }

    async function tick() {
        const baseUrl = getAgentUrl();
        if (!baseUrl || !baseUrl.trim()) return;
        try {
            const payload = await gatherResearchPayload(state);

            const store = getDbPath ? await getStore() : null;
            if (store) {
                await store.persist(payload);
                const { current, history } = await store.getPayloadForAgent({ lastDays, lastN });
                const payloadForAgent = { current, history };
                const client = createResearchAgentClient({
                    baseUrl,
                    getApiKey,
                    loggerPort: logger
                });
                const result = await client.send(payloadForAgent);
                if (!result.ok && logger && logger.error) {
                    logger.error('ResearchDataService: send failed', result.status || result.error);
                }
            } else {
                const client = createResearchAgentClient({
                    baseUrl,
                    getApiKey,
                    loggerPort: logger
                });
                const result = await client.send({ current: payload, history: [] });
                if (!result.ok && logger && logger.error) {
                    logger.error('ResearchDataService: send failed', result.status || result.error);
                }
            }
        } catch (err) {
            if (logger && logger.error) logger.error('ResearchDataService: tick failed', err);
        }
    }

    function start() {
        if (intervalId != null) return;
        tick();
        intervalId = setInterval(tick, pollIntervalMs);
    }

    function stop() {
        if (intervalId != null) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (storePromise) {
            storePromise.then((s) => { if (s && s.close) s.close(); }).catch(() => {});
            storePromise = null;
        }
    }

    return {
        start,
        stop,
        gatherResearchPayload
    };
}

module.exports = {
    createResearchDataService,
    gatherResearchPayload,
    DEFAULT_POLL_INTERVAL_MS
};