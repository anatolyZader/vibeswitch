/**
 * Version Drift Handler
 * Detects document version drift and caps confidence when document changed externally
 */

/**
 * Check if document version has drifted (changed externally)
 * @param {vscode.TextDocument} document - Current document
 * @param {number} lastSeenVersion - Last seen document version
 * @returns {boolean} True if version has drifted
 */
function hasVersionDrift(document, lastSeenVersion) {
    return document && document.version !== lastSeenVersion;
}

/**
 * Apply version drift confidence cap to classification
 * @param {Object} classification - Classification result (will be mutated)
 * @param {vscode.TextDocument} document - Current document
 * @param {number} lastSeenVersion - Last seen document version
 * @param {number} lastSeenTimestamp - Last seen timestamp
 * @param {Object} metrics - Metrics object to update drift count
 * @returns {boolean} True if drift was detected and cap was applied
 */
function applyDriftCap(classification, document, lastSeenVersion, lastSeenTimestamp, metrics) {
    if (!hasVersionDrift(document, lastSeenVersion)) {
        return false;
    }
    
    // Fix: Defensive guards for optional fields (domain code should never crash)
    if (!classification.reasons) {
        classification.reasons = [];
    }
    if (!classification.meta) {
        classification.meta = {};
    }
    
    const originalConfidence = classification.confidence;
    classification.confidence = Math.min(classification.confidence, 0.6); // Cap at 0.6
    
    if (originalConfidence > 0.6) {
        // Production: Track drift for observability
        if (metrics) {
            metrics.versionDriftCount++;
        }
        
        // Fix: Include version and timestamp in drift reason for easier debugging
        // Clarify: version changed after last captured event (could be external edit or missed internal event)
        const driftAge = lastSeenTimestamp ? Date.now() - lastSeenTimestamp : 0;
        classification.reasons.push(`meta:version_drift document version ${document.version} vs last seen ${lastSeenVersion} (age: ${driftAge}ms, version changed after last captured event, confidence capped)`);
        
        // Production: Add meta flag for metrics/observability
        classification.meta.versionDrift = true;
        
        return true;
    }
    
    return false;
}

module.exports = {
    hasVersionDrift,
    applyDriftCap
};

