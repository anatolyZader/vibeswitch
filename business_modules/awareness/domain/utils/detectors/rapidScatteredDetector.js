/**
 * Rapid Scattered Detector
 * Detects rapid scattered changes (strong AI signal)
 */

/**
 * Detector: Rapid scattered changes (strong AI signal)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with rapid scattered thresholds
 * @returns {Object|null} Detection result or null
 */
function detectRapidScattered(metrics, config) {
    // Fix: Use event count instead of change count (events are what matter for "rapid")
    if (metrics.rapidEventCount >= config.rapidScatteredEventCount &&
        metrics.rapidRangeCount >= config.rapidScatteredRangeCount &&
        metrics.totalInserted >= config.rapidScatteredMinSize) {
        return {
            label: 'ai',
            score: 0.8,
            reason: `rapid scattered: ${metrics.rapidEventCount} events in ${config.rapidScatteredTimeWindow}ms window across ${metrics.rapidRangeCount} ranges`,
            reasonTag: 'ai:rapid_scattered' // Fix: Add tag for stable filtering
        };
    }
    
    // Fix: Require at least 2 events for rapid burst (avoid false positives from single large events)
    // Fix: Use separate rapidBurstChangeCount threshold (not rapidScatteredEventCount)
    // Fix: Require rapidRangeCount >= 2 to reduce false positives from tight loop editing one place
    if (metrics.rapidEventCount >= 2 && metrics.burstDurationMs > 0 && metrics.burstDurationMs <= 1200 &&
        metrics.rapidRangeCount >= 2 && // Guard: require scatteredness even in burst branch
        metrics.distinctRangeCount >= config.rapidScatteredRangeCount &&
        metrics.changeCount >= (config.rapidBurstChangeCount || 10) &&
        metrics.totalInserted >= config.rapidScatteredMinSize) {
        return {
            label: 'ai',
            score: 0.7,
            reason: `rapid burst: ${metrics.rapidEventCount} events, ${metrics.changeCount} changes in ${metrics.burstDurationMs}ms`,
            reasonTag: 'ai:rapid_burst' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

module.exports = {
    detectRapidScattered
};

