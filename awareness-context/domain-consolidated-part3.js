/**
 * DOMAIN LAYER - CONSOLIDATED (PART 3/3)
 * 
 * This file contains part 3 of 3 of the domain layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 6/43
 * Generated: 2026-01-14T18:13:49.746Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 38/43: domain/utils/detectors/smallEditsDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/smallEditsDetector.js
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

// module.exports = { // Commented for consolidation
//     detectSmallEdits // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/smallEditsDetector.js


// ============================================================================
// FILE 39/43: domain/utils/reasonFilter.js
// ============================================================================

(function() { // IIFE scope for domain/utils/reasonFilter.js
/**
 * Reason Filter
 * Filters classification reasons by tag prefix based on final label
 */

/**
 * Filter reasons by reasonTag prefix based on final classification label
 * This reduces noise in logs and makes debugging easier
 * @param {Array<{tag: string|null, text: string}>} reasonObjects - Array of reason objects with tags
 * @param {string} label - Final classification label ('ai'|'user'|'formatter'|'unknown')
 * @returns {Array<string>} Filtered array of reason strings
 */
function filterReasons(reasonObjects, label) {
    return reasonObjects
        .filter(r => {
            if (!r.tag) return true; // Keep reasons without tags (e.g., marker detection)
            
            if (label === 'formatter') {
                return r.tag.startsWith('fmt:');
            } else if (label === 'ai') {
                return r.tag.startsWith('ai:');
            } else if (label === 'user') {
                return r.tag.startsWith('user:');
            }
            return true; // Keep all reasons for unknown
        })
        .map(r => r.text);
}

// module.exports = { // Commented for consolidation
//     filterReasons // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/reasonFilter.js


// ============================================================================
// FILE 40/43: domain/utils/versionDriftHandler.js
// ============================================================================

(function() { // IIFE scope for domain/utils/versionDriftHandler.js
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

// module.exports = { // Commented for consolidation
//     hasVersionDrift, // Commented for consolidation
//     applyDriftCap // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/versionDriftHandler.js


// ============================================================================
// FILE 41/43: domain/value_objects/filePath.js
// ============================================================================

(function() { // IIFE scope for domain/value_objects/filePath.js
/**
 * FilePath - Value object for file paths
 * 
 * Encapsulates file path validation and normalization.
 */

class FilePath {
    constructor(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('FilePath must be a non-empty string');
        }
        this.value = value.trim();
        if (this.value.length === 0) {
            throw new Error('FilePath cannot be empty');
        }
    }

    equals(other) {
        return other instanceof FilePath && this.value === other.value;
    }

    toString() {
        return this.value;
    }

    /**
     * Get the file name (last segment of path)
     * @returns {string} File name
     */
    getFileName() {
        const parts = this.value.split(/[/\\]/);
        return parts[parts.length - 1];
    }

    /**
     * Get the directory path
     * @returns {string} Directory path
     */
    getDirectory() {
        const lastSlash = Math.max(this.value.lastIndexOf('/'), this.value.lastIndexOf('\\'));
        if (lastSlash === -1) return '';
        return this.value.substring(0, lastSlash);
    }
}

// module.exports = FilePath; // Commented for consolidation


})(); // End IIFE for domain/value_objects/filePath.js


// ============================================================================
// FILE 42/43: domain/value_objects/score.js
// ============================================================================

(function() { // IIFE scope for domain/value_objects/score.js
/**
 * Score - Value object for awareness scores
 * 
 * Encapsulates score validation and business rules.
 */

class Score {
    constructor(value) {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error('Score must be a valid number');
        }
        if (value < 0 || value > 100) {
            throw new Error('Score must be between 0 and 100');
        }
        this.value = Math.round(value * 100) / 100; // Round to 2 decimal places
    }

    equals(other) {
        return other instanceof Score && this.value === other.value;
    }

    toNumber() {
        return this.value;
    }

    toString() {
        return this.value.toString();
    }

    /**
     * Check if score is in a critical range (high awareness needed)
     * @returns {boolean} True if score >= 70
     */
    isCritical() {
        return this.value >= 70;
    }

    /**
     * Check if score is in a warning range
     * @returns {boolean} True if score >= 40 and < 70
     */
    isWarning() {
        return this.value >= 40 && this.value < 70;
    }

    /**
     * Check if score is in a safe range
     * @returns {boolean} True if score < 40
     */
    isSafe() {
        return this.value < 40;
    }
}

// module.exports = Score; // Commented for consolidation


})(); // End IIFE for domain/value_objects/score.js


// ============================================================================
// FILE 43/43: domain/value_objects/suggestionId.js
// ============================================================================

(function() { // IIFE scope for domain/value_objects/suggestionId.js
/**
 * SuggestionId - Value object for AI suggestion identifiers
 * 
 * Encapsulates suggestion ID validation.
 */

class SuggestionId {
    constructor(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('SuggestionId must be a non-empty string');
        }
        this.value = value.trim();
        if (this.value.length === 0) {
            throw new Error('SuggestionId cannot be empty');
        }
    }

    equals(other) {
        return other instanceof SuggestionId && this.value === other.value;
    }

    toString() {
        return this.value;
    }
}

// module.exports = SuggestionId; // Commented for consolidation


})(); // End IIFE for domain/value_objects/suggestionId.js

