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

module.exports = SuggestionId;

