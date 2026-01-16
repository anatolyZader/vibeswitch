/**
 * Pure Insertion Detector
 * Detects multiple pure insertions (no deletes)
 */

/**
 * Detector: Multiple pure insertions (no deletes)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with pure insertion thresholds
 * @returns {Object|null} Detection result or null
 */
function detectPureInsertions(metrics, config) {
    if (metrics.pureInsertionCount >= config.pureInsertionCount && 
        metrics.totalInserted > config.pureInsertionSize &&
        metrics.totalDeleted === 0) {
        return {
            label: 'ai',
            score: 0.6,
            reason: `pure insertions: ${metrics.pureInsertionCount} insertions, ${metrics.totalInserted} chars`,
            reasonTag: 'ai:pure_insertions' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

module.exports = {
    detectPureInsertions
};

