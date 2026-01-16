/**
 * Large Insertion Detector
 * Detects large single insertions
 */

/**
 * Detector: Large single insertion
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with large insertion threshold
 * @returns {Object|null} Detection result or null
 */
function detectLargeInsertion(metrics, config) {
    if (metrics.totalInserted > config.largeInsertionThreshold && metrics.totalDeleted === 0) {
        return {
            label: 'ai',
            score: 0.6,
            reason: `large insertion: ${metrics.totalInserted} chars`,
            reasonTag: 'ai:large_insertion' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

module.exports = {
    detectLargeInsertion
};

