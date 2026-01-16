/**
 * ClassificationConfig - Configuration for change classification
 * 
 * Provides mode-specific configuration for the ChangeClassifier.
 * Separated from ClassificationService for better testability and maintainability.
 */

/**
 * Get classification configuration for mode
 * @param {string} mode - Current mode ('vibe', 'dev')
 * @returns {Object} Configuration object
 */
function getClassifierConfig(mode) {
    const baseConfig = {
        multiLineThreshold: 50,
        pureInsertionCount: 3,
        pureInsertionSize: 20,
        largeInsertionThreshold: 100,
        scatteredRangeCount: 5,
        scatteredChangeCount: 5,
        scatteredSizeThreshold: 200,
        formatterRangeCount: 8,
        formatterLineSpan: 50,
        aiLineSpan: 30,
        aiMultiLineSize: 50,
        // Rapid scattered changes: AI agents often make many scattered edits quickly
        rapidScatteredTimeWindow: 1000, // 1 second window
        rapidScatteredEventCount: 8, // Minimum events in window
        rapidScatteredRangeCount: 6, // Minimum distinct line ranges
        rapidScatteredMinSize: 50, // Minimum total size
        rapidBurstChangeCount: 10, // Minimum changes for rapid burst branch
        // Behavioral inference mode: use heuristics as primary, markers as strong signal when present
        markerOnly: false
    };
    
    // VIBE: more permissive (lower thresholds) - behavioral inference enabled
    if (mode === 'vibe') {
        return {
            ...baseConfig,
            pureInsertionSize: 15,
            largeInsertionThreshold: 80,
            aiMultiLineSize: 40,
            rapidScatteredEventCount: 6, // Lower threshold for vibe mode
            rapidScatteredRangeCount: 5,
            rapidScatteredMinSize: 40,
            rapidBurstChangeCount: 8, // Lower threshold for vibe mode
            markerOnly: false
        };
    }
    
    // DEV: default (conservative) - behavioral inference enabled
    return baseConfig;
}

module.exports = {
    getClassifierConfig
};
