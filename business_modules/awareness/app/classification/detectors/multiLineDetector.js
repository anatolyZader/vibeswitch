/**
 * Multi-Line Insertion Detector
 * Detects large multi-line insertions in localized area
 */

/**
 * Detector: Large multi-line insertions in localized area
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with multi-line thresholds
 * @returns {Object|null} Detection result or null
 */
function detectMultiLineInsertion(metrics, config) {
    // Fix: Use multiLineThreshold to require minimum multi-line size
    if (metrics.hasMultiLine && 
        metrics.totalInserted >= config.multiLineThreshold &&
        metrics.totalInserted >= config.aiMultiLineSize &&
        metrics.maxLineSpan <= config.aiLineSpan) {
        return {
            label: 'ai',
            score: 0.7,
            reason: `large multi-line insertion: ${metrics.totalInserted} chars, ${metrics.maxLineSpan} line span`,
            reasonTag: 'ai:multi_line' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

module.exports = {
    detectMultiLineInsertion
};

