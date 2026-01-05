/**
 * Small Edits Detector
 * Detects small edits (likely user formatting)
 */

/**
 * Detector: Small edits (likely user formatting)
 * @param {Object} metrics - Calculated metrics
 * @returns {Object|null} Detection result or null
 */
function detectSmallEdits(metrics) {
    if (metrics.hasMultiLine && metrics.totalInserted < 20) {
        return {
            label: 'user',
            score: 0.4,
            reason: `small multi-line edit: ${metrics.totalInserted} chars (likely formatting)`,
            reasonTag: 'user:small_edit' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

module.exports = {
    detectSmallEdits
};

