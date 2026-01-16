/**
 * Config Manager
 * Manages classifier configuration: defaults, validation, and merging
 * 
 * Moved from domain/utils to app/classification - these are pure functions, not domain logic.
 * Validation results are returned for application layer to handle logging.
 */

/**
 * Get default classifier configuration
 * @returns {Object} Default configuration object
 */
function getDefaultConfig() {
    return {
        // VIBE: more permissive (lower thresholds)
        // DEV: more conservative (higher thresholds)
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
        rapidScatteredTimeWindow: 1000, // Time window in ms for rapid changes (1 second)
        rapidScatteredEventCount: 8, // Minimum number of events in time window (renamed from ChangeCount for clarity)
        rapidScatteredRangeCount: 6, // Minimum distinct line ranges for scattered pattern
        rapidScatteredMinSize: 50, // Minimum total size to avoid false positives on tiny edits
        rapidBurstChangeCount: 10, // Minimum number of changes for rapid burst branch (separate from event count)
        // Marker-only mode: if true, only use @ai marker, ignore heuristics
        // If false, use behavioral heuristics as primary with markers as strong signal when present
        markerOnly: false  // Default: use behavioral inference (heuristics) as primary method
    };
}

/**
 * Validate and sanitize classifier configuration to prevent silent misclassification
 * Fix: Sanitizes user config BEFORE merge to ensure defaults always win
 * @param {Object} config - User configuration to validate (will be mutated)
 * @param {Object} defaultConfig - Default configuration (for reference)
 * @returns {{errors: string[], sanitized: string[]}} Validation result
 */
function validateConfig(config, defaultConfig = {}) {
    const errors = [];
    const sanitized = [];
    
    // Thresholds must be positive numbers
    const thresholdKeys = [
        'multiLineThreshold', 'pureInsertionCount', 'pureInsertionSize',
        'largeInsertionThreshold', 'scatteredRangeCount', 'scatteredChangeCount',
        'scatteredSizeThreshold', 'formatterRangeCount', 'formatterLineSpan',
        'aiLineSpan', 'aiMultiLineSize', 'rapidScatteredTimeWindow',
        'rapidScatteredEventCount', 'rapidScatteredRangeCount', 'rapidScatteredMinSize',
        'rapidBurstChangeCount'
    ];
    
    // Fix: Sanitize invalid values (delete them so defaults win) instead of just warning
    for (const key of thresholdKeys) {
        if (config[key] !== undefined && (typeof config[key] !== 'number' || config[key] < 0)) {
            errors.push(`${key} must be a non-negative number, got: ${config[key]}`);
            delete config[key]; // Remove invalid value so default wins
            sanitized.push(key);
        }
    }
    
    // Boolean flags
    if (config.markerOnly !== undefined && typeof config.markerOnly !== 'boolean') {
        errors.push(`markerOnly must be a boolean, got: ${config.markerOnly}`);
        delete config.markerOnly; // Remove invalid value so default wins
        sanitized.push('markerOnly');
    }
    
    // Fix: Domain layer doesn't log - return validation result for app layer to handle
    // Invalid values have been deleted, so defaults will be used via merge
    return { errors, sanitized };
}

/**
 * Create and merge classifier configuration
 * @param {Object|null} userConfig - User-provided configuration (optional)
 * @param {ILoggerPort} loggerPort - Logger port (optional, for validation warnings)
 * @returns {Object} Final frozen configuration object
 */
function createConfig(userConfig = null, loggerPort = null) {
    const defaultConfig = getDefaultConfig();
    
    // Fix: Sanitize user config BEFORE merging to ensure defaults always win
    // This prevents invalid values from overwriting defaults, then being deleted, leaving undefined
    const sanitizedUserConfig = userConfig ? { ...userConfig } : {};
    const validationResult = validateConfig(sanitizedUserConfig, defaultConfig);
    
    // Log validation warnings at application layer (if logger provided)
    if (validationResult.errors.length > 0 && loggerPort) {
        loggerPort.log(`[ChangeClassifier] Invalid config sanitized: ${validationResult.sanitized.join(', ')}. ${validationResult.errors.length} invalid value(s) removed, defaults applied.`, true);
    }
    
    // Merge sanitized user config with defaults (defaults win for any missing/invalid keys)
    const config = { ...defaultConfig, ...sanitizedUserConfig };
    
    // Freeze config to prevent accidental mutation
    Object.freeze(config);
    
    return config;
}

module.exports = {
    getDefaultConfig,
    validateConfig,
    createConfig
};

