/**
 * Formatter Detector
 * Detects formatter patterns (many scattered changes with high whitespace ratio)
 */

/**
 * Detector: Formatter pattern (many scattered changes with high whitespace ratio)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with formatter thresholds
 * @returns {Object|null} Detection result or null
 */
function detectFormatter(metrics, config) {
    // Fix: Use whitespace-only change ratio instead of whitespace character ratio
    // This avoids false positives on normal code (which naturally contains whitespace)
    // Fix: Add guard for small inserted text per change (formatters typically have small inserts)
    // Fix: Also detect formatters with moderate whitespace ratio but strong other signals
    const avgInsertedPerChange = metrics.changeCount > 0 ? metrics.totalInserted / metrics.changeCount : 0;
    const formatterMaxAvgInsert = 30; // Formatters typically insert small amounts per change
    
    // Primary signal: high whitespace-only ratio
    const hasHighWhitespaceRatio = metrics.whitespaceOnlyChangeRatio > 0.6;
    
    // Secondary signal: formatter characteristics (many ranges, wide span, small inserts, both deletes and inserts)
    const hasFormatterCharacteristics = 
        metrics.distinctRangeCount >= config.formatterRangeCount && 
        metrics.maxLineSpan >= config.formatterLineSpan &&
        metrics.totalDeleted > 0 && // Formatters typically have deletes
        (metrics.totalInserted <= 500 || avgInsertedPerChange <= formatterMaxAvgInsert);
    
    // Detect formatter if: (high whitespace ratio) OR (formatter characteristics with moderate whitespace)
    if (hasFormatterCharacteristics) {
        const whitespaceThreshold = hasHighWhitespaceRatio ? 0.6 : 0.3; // Lower threshold if other signals are strong
        if (metrics.whitespaceOnlyChangeRatio > whitespaceThreshold) {
            return {
                label: 'formatter',
                score: hasHighWhitespaceRatio ? 0.9 : 0.7, // Lower confidence if whitespace ratio is moderate
                reason: `formatter pattern: ${metrics.distinctRangeCount} ranges, ${metrics.maxLineSpan} line span, ${(metrics.whitespaceOnlyChangeRatio * 100).toFixed(0)}% whitespace-only changes, avg ${avgInsertedPerChange.toFixed(0)} chars/change`,
                reasonTag: 'fmt:whitespace' // Fix: Add tag for stable filtering
            };
        }
    }
    return null;
}

module.exports = {
    detectFormatter
};

