/**
 * DOMAIN LAYER - CONSOLIDATED (PART 4/4)
 * 
 * This file contains part 4 of 4 of the domain layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 2/54
 * Generated: 2026-01-12T18:19:21.013Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 53/54: domain/value_objects/score.js
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
// FILE 54/54: domain/value_objects/suggestionId.js
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

