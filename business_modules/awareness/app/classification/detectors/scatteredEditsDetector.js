/**
 * Scattered Edits Detector
 * Detects scattered edits (could be formatter or AI)
 */

/**
 * Detector: Scattered edits (could be formatter or AI)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with scattered edit thresholds
 * @returns {Object|null} Detection result or null
 */
function detectScatteredEdits(metrics, config) {
    if (metrics.distinctRangeCount >= config.scatteredRangeCount && 
        metrics.changeCount >= config.scatteredChangeCount) {
        if (metrics.totalInserted > config.scatteredSizeThreshold) {
            return {
                label: 'ai',
                score: 0.5,
                reason: `scattered edits: ${metrics.distinctRangeCount} ranges, ${metrics.totalInserted} chars`,
                reasonTag: 'ai:scattered' // Fix: Add tag for stable filtering
            };
        }
    }
    return null;
}

module.exports = {
    detectScatteredEdits
};

