/**
 * SuggestionOutcomePolicy - Domain policy for determining suggestion outcomes
 * 
 * Pure business logic for deciding if a suggestion should be accepted, rejected, or adapted.
 * This is domain policy - no I/O, no timers, just pure decision logic.
 * 
 * App layer supplies facts (originalText, currentText, wasUserEdited, wasReviewed, meta)
 * Domain policy returns decision (pending|accepted|rejected|adapted, reason)
 */

class SuggestionOutcomePolicy {
    constructor() {
        // Business rules as constants
        this.MIN_SIZE_FOR_RATIO = 10;
        this.REJECTION_THRESHOLD = 0.4; // If current size < 40% of original, reject
    }

    /**
     * Determine suggestion outcome based on current state
     * @param {Object} facts - Input facts
     * @param {string} facts.originalText - Original suggestion text
     * @param {string} facts.currentText - Current text in document
     * @param {number} facts.originalSize - Original suggestion size
     * @param {number} facts.currentSize - Current text size
     * @param {boolean} facts.wasUserEdited - Whether user edited the suggestion
     * @param {boolean} facts.wasReviewed - Whether user reviewed the suggestion (dwell time)
     * @param {Object} facts.meta - Optional metadata (isFileCreation, isExternalCreation, etc.)
     * @returns {Object} Decision { outcome: 'pending'|'accepted'|'rejected'|'adapted', reason: string }
     */
    decideOutcome(facts) {
        const {
            originalText,
            currentText,
            originalSize,
            currentSize,
            wasUserEdited,
            wasReviewed,
            meta = {}
        } = facts;

        // Validate inputs
        if (!originalText || originalSize === undefined || currentSize === undefined) {
            return {
                outcome: 'pending',
                reason: 'Missing required facts for decision'
            };
        }

        // Rule 1: Tiny suggestions (below threshold for ratio calculation)
        if (originalSize < this.MIN_SIZE_FOR_RATIO) {
            if (currentSize === 0) {
                return {
                    outcome: 'rejected',
                    reason: 'Tiny suggestion was completely removed'
                };
            }
            // Too small to evaluate by ratio - keep pending
            return {
                outcome: 'pending',
                reason: 'Suggestion too small for ratio evaluation'
            };
        }

        // Rule 2: Significant reduction (< 40% of original) = rejected
        const sizeRatio = currentSize / originalSize;
        if (sizeRatio < this.REJECTION_THRESHOLD) {
            return {
                outcome: 'rejected',
                reason: `Suggestion reduced to ${(sizeRatio * 100).toFixed(1)}% of original size`
            };
        }

        // Rule 3: User edited the suggestion = adapted
        if (wasUserEdited) {
            return {
                outcome: 'adapted',
                reason: 'User modified the suggestion'
            };
        }

        // Rule 4: User reviewed (dwell time) and text matches = accepted
        if (wasReviewed) {
            // Determine source type for logging
            let sourceType = 'AI suggestion';
            if (meta.isFileCreation || meta.isExternalCreation) {
                sourceType = meta.isExternalCreation ? 'externally created file' : 'file creation';
            } else if (meta.isFileWrite) {
                sourceType = 'agent file write';
            } else {
                sourceType = 'text change';
            }

            return {
                outcome: 'accepted',
                reason: `Suggestion accepted (${sourceType})`
            };
        }

        // Rule 5: No user interaction yet = pending
        return {
            outcome: 'pending',
            reason: 'No user interaction detected yet'
        };
    }

    /**
     * Check if suggestion should be evaluated now
     * @param {Object} suggestion - Suggestion entity
     * @returns {boolean} True if suggestion should be evaluated
     */
    shouldEvaluate(suggestion) {
        // Evaluate if suggestion is pending
        return suggestion && suggestion.status === 'pending';
    }
}

module.exports = SuggestionOutcomePolicy;
