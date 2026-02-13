/**
 * TimeSeriesCollector: flattens dashboard payload to measure/value pairs and writes to SQLite.
 * Debounced: max 1 write per 5 minutes to avoid excessive DB writes.
 */

const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

const MEASURE_PATHS = [
    ['scoreData', 'total'],
    ['scoreData', 'components', 'review'],
    ['scoreData', 'components', 'blindAcceptance'],
    ['scoreData', 'components', 'adaptation'],
    ['scoreData', 'components', 'debt'],
    ['antipatternBreakdown', 'flooding', 'risk0To100'],
    ['antipatternBreakdown', 'responseDrill', 'risk0To100'],
    ['antipatternBreakdown', 'diffFlooding', 'risk0To100'],
    ['antipatternBreakdown', 'verificationDebt', 'risk0To100'],
    ['antipatternBreakdown', 'comprehensionDebt', 'risk0To100'],
    ['antipatternBreakdown', 'boundaryViolations', 'risk0To100'],
    ['antipatternBreakdown', 'contextSpread', 'risk0To100'],
    ['antipatternBreakdown', 'duplication', 'risk0To100'],
    ['tokenUsage', 'totalInput'],
    ['tokenUsage', 'totalOutput'],
    ['tokenUsage', 'totalTokens']
];

function getNested(obj, path) {
    let cur = obj;
    for (const key of path) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = cur[key];
    }
    return cur;
}

function flattenPayload(payload) {
    const measures = [];
    for (const path of MEASURE_PATHS) {
        const value = getNested(payload, path);
        if (value != null && typeof value === 'number' && !Number.isNaN(value)) {
            const measureName = path.join('.');
            measures.push({ measureName, value });
        }
    }
    return measures;
}

/**
 * @param {import('../infrastructure/ResearchDbAdapter')} dbAdapter
 * @param {{ loggerPort?: { error?: function } }} [opts]
 * @returns {TimeSeriesCollector}
 */
function createTimeSeriesCollector(dbAdapter, opts) {
    const logger = opts && opts.loggerPort;
    let lastWriteTs = 0;
    let pendingMeasures = [];

    return {
        /**
         * @param {Object} payload - Dashboard payload (scoreData, antipatternBreakdown, tokenUsage)
         * @param {string} [sessionId]
         */
        sample(payload, sessionId) {
            if (!payload || !dbAdapter) return;

            const measures = flattenPayload(payload);
            if (measures.length === 0) return;

            const timestamp = new Date().toISOString();
            for (const { measureName, value } of measures) {
                pendingMeasures.push({ timestamp, sessionId, measureName, value });
            }

            const now = Date.now();
            if (now - lastWriteTs >= DEBOUNCE_MS || lastWriteTs === 0) {
                try {
                    for (const m of pendingMeasures) {
                        dbAdapter.insertTimeSeries({
                            timestamp: m.timestamp,
                            sessionId: m.sessionId,
                            measureName: m.measureName,
                            value: m.value
                        });
                    }
                    pendingMeasures = [];
                    lastWriteTs = now;
                } catch (err) {
                    if (logger && logger.error) logger.error('TimeSeriesCollector: write failed', err);
                }
            }
        }
    };
}

module.exports = {
    createTimeSeriesCollector,
    flattenPayload,
    MEASURE_PATHS
};
