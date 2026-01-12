/**
 * SuggestionLifecycleServiceD - Domain service for suggestion lifecycle operations
 * 
 * Encapsulates business logic for determining suggestion status and tracking user interactions.
 * This is a domain service that uses VS Code port for document operations.
 */

class SuggestionLifecycleServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Determine suggestion status based on current state
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {Suggestion} suggestion - Suggestion entity
     * @param {string} currentText - Current text in document
     * @param {number} currentSize - Current size in characters
     * @returns {string} Status: 'accepted' | 'rejected' | 'adapted' | 'pending'
     */
    determineSuggestionStatus(vscodePort, suggestion, currentText, currentSize) {
        if (!suggestion) return 'pending';
        
        const MIN_SIZE_FOR_RATIO = 10;
        
        // Handle tiny suggestions
        if (!suggestion.size || suggestion.size < MIN_SIZE_FOR_RATIO) {
            if (currentSize === 0) {
                return 'rejected';
            }
            return 'pending';
        }

        const sizeRatio = this.calculateSizeRatio(suggestion.size, currentSize);

        // Check rejection first (most definitive)
        if (this.shouldMarkAsRejected(sizeRatio)) {
            return 'rejected';
        }

        // Check adaptation (user modified it)
        if (this.shouldMarkAsAdapted(suggestion, suggestion.userEdited)) {
            return 'adapted';
        }

        // Check acceptance (reviewed and unchanged)
        if (this.shouldMarkAsAccepted(suggestion, sizeRatio, suggestion.userEdited)) {
            return 'accepted';
        }

        // Still pending
        return 'pending';
    }

    /**
     * Detect if user edits overlap with suggestion
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {Suggestion} suggestion - Suggestion entity
     * @param {Array<Range>} userEditRanges - User edit ranges
     * @returns {boolean} True if overlaps
     */
    detectUserEditOverlap(vscodePort, suggestion, userEditRanges) {
        if (!suggestion || !userEditRanges || userEditRanges.length === 0) {
            return false;
        }

        // Use RangeOperationServiceD for overlap detection
        // For now, we'll use the vscodePort directly
        for (const editRange of userEditRanges) {
            if (suggestion.range && editRange) {
                const intersection = suggestion.range.intersection(editRange);
                if (intersection !== undefined) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Calculate size ratio for status determination
     * @param {number} originalSize - Original suggestion size
     * @param {number} currentSize - Current size
     * @returns {number} Size ratio (0-1+)
     */
    calculateSizeRatio(originalSize, currentSize) {
        if (!originalSize || originalSize === 0) return 1;
        return currentSize / originalSize;
    }

    /**
     * Determine if suggestion should be marked as rejected
     * @param {number} sizeRatio - Size ratio
     * @param {number} minRatio - Minimum ratio threshold (default: 0.4)
     * @returns {boolean} True if should reject
     */
    shouldMarkAsRejected(sizeRatio, minRatio = 0.4) {
        return sizeRatio < minRatio;
    }

    /**
     * Determine if suggestion should be marked as adapted
     * @param {Suggestion} suggestion - Suggestion entity
     * @param {boolean} hasUserEdits - Whether user edits detected
     * @returns {boolean} True if should mark as adapted
     */
    shouldMarkAsAdapted(suggestion, hasUserEdits) {
        if (!suggestion) return false;
        return hasUserEdits && suggestion.reviewed;
    }

    /**
     * Determine if suggestion should be marked as accepted
     * @param {Suggestion} suggestion - Suggestion entity
     * @param {number} sizeRatio - Size ratio
     * @param {boolean} hasUserEdits - Whether user edits detected
     * @returns {boolean} True if should mark as accepted
     */
    shouldMarkAsAccepted(suggestion, sizeRatio, hasUserEdits) {
        if (!suggestion) return false;
        
        // Must be reviewed and not edited by user
        if (!suggestion.reviewed || hasUserEdits) {
            return false;
        }

        // Size should be close to original (within reasonable range)
        // Accept if size ratio is between 0.8 and 1.2 (allows for minor formatting changes)
        return sizeRatio >= 0.8 && sizeRatio <= 1.2;
    }
}

module.exports = SuggestionLifecycleServiceD;
