/**
 * SuggestionBatch - Entity representing a batch of related AI suggestions
 * 
 * Groups suggestions that were created together (e.g., from a single AI refactor).
 * This helps track batch acceptance patterns and prevents treating each change
 * as a separate suggestion.
 */

class SuggestionBatch {
    /**
     * @param {string} batchId - Unique batch identifier
     * @param {string} filePath - File where batch was created (URI string)
     * @param {number} timestamp - When batch was created
     */
    constructor(batchId, filePath, timestamp = Date.now()) {
        if (!batchId || typeof batchId !== 'string') {
            throw new Error('SuggestionBatch requires a non-empty batchId string');
        }
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('SuggestionBatch requires a non-empty filePath string');
        }
        this.batchId = batchId;
        this.filePath = filePath;
        this.timestamp = timestamp;
        this.suggestionIds = []; // Array of string IDs
        this.totalSize = 0;      // chars (locDelta in event-signal-weight spec)
        this.status = 'pending'; // 'pending' | 'partially_accepted' | 'fully_accepted' | 'rejected'
        this.acceptedCount = 0;
        this.rejectedCount = 0;
        this.modifiedCount = 0;
        // Optional metadata for future meters (event-signal-weight spec)
        this.filesTouched = 1;   // this batch = 1 file; window-level distinctFiles used for spread
        this.archViolations = []; // { severity, ruleId, file } when ARCH_RULE_VIOLATION_DETECTED
        this.obsSignals = {};    // { entryPointsTouched, telemetryTouched } when detection exists
    }

    /**
     * Add a suggestion to this batch
     * @param {string} suggestionId - Suggestion ID (string)
     * @param {number} size - Size of the suggestion
     */
    addSuggestion(suggestionId, size) {
        const idStr = String(suggestionId);
        if (!this.suggestionIds.includes(idStr)) {
            this.suggestionIds.push(idStr);
            this.totalSize += size;
        }
    }

    /**
     * Record outcome for a suggestion in this batch
     * @param {string} suggestionId - Suggestion ID (string)
     * @param {string} outcome - 'accepted' | 'rejected' | 'modified'
     */
    recordOutcome(suggestionId, outcome) {
        const idStr = String(suggestionId);
        if (!this.suggestionIds.includes(idStr)) {
            return; // Suggestion not in this batch
        }

        if (outcome === 'accepted') {
            this.acceptedCount++;
        } else if (outcome === 'rejected') {
            this.rejectedCount++;
        } else if (outcome === 'modified') {
            this.modifiedCount++;
        }

        this._updateStatus();
    }

    _updateStatus() {
        const total = this.suggestionIds.length;
        const resolved = this.acceptedCount + this.rejectedCount + this.modifiedCount;

        if (resolved === 0) {
            this.status = 'pending';
        } else if (resolved === total) {
            if (this.acceptedCount === total) {
                this.status = 'fully_accepted';
            } else if (this.rejectedCount === total) {
                this.status = 'rejected';
            } else {
                this.status = 'partially_accepted';
            }
        } else {
            this.status = 'partially_accepted';
        }
    }

    /**
     * Check if batch is fully resolved
     * @returns {boolean} True if all suggestions have outcomes
     */
    isFullyResolved() {
        const total = this.suggestionIds.length;
        const resolved = this.acceptedCount + this.rejectedCount + this.modifiedCount;
        return resolved === total;
    }

    /**
     * Check if batch represents a "keep all" pattern
     * @returns {boolean} True if all suggestions were accepted without modification
     */
    isKeepAllPattern() {
        return this.status === 'fully_accepted' && 
               this.suggestionIds.length >= 3 && // At least 3 suggestions
               this.modifiedCount === 0; // No modifications
    }

    /**
     * Get acceptance rate (0-1)
     * @returns {number} Acceptance rate
     */
    getAcceptanceRate() {
        const total = this.suggestionIds.length;
        if (total === 0) return 0;
        return this.acceptedCount / total;
    }

    /**
     * Get batch age in milliseconds
     * @returns {number} Age in ms
     */
    getAge() {
        return Date.now() - this.timestamp;
    }

    /**
     * Get suggestion IDs as strings (for event publishing)
     * @returns {Array<string>} Array of suggestion ID strings
     */
    getSuggestionIdStrings() {
        return [...this.suggestionIds];
    }
}

module.exports = SuggestionBatch;
