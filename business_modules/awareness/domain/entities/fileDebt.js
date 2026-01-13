/**
 * FileDebt - Domain entity representing review debt for a single file
 * 
 * Encapsulates the business concept of unreviewed code changes in a file.
 * This is file-level debt - tracks changes to the file itself, not individual suggestions.
 * 
 * Suggestion-level debt is tracked separately via Suggestion entities (status === 'pending').
 * 
 * This is a domain entity with identity (file URI) that tracks file review state.
 */

class FileDebt {
    /**
     * @param {string} fileUri - Canonical URI string for the file
     * @param {Object} options - Optional initial state
     * @param {number} options.modifiedAt - Timestamp when debt was first created
     * @param {number} options.totalChanges - Total size of changes
     * @param {number} options.modificationCount - Number of modifications
     * @param {boolean} options.reviewed - Whether file debt has been reviewed
     * @param {number} options.reviewedAt - Timestamp when reviewed
     * @param {number} options.totalReviewTime - Total time spent reviewing
     * @param {number} options.firstOpenedAt - Timestamp when first opened
     * @param {number} options.lastVisitedAt - Timestamp of last visit
     * @param {number} options.reviewSessions - Number of review sessions
     */
    constructor(fileUri, options = {}) {
        if (!fileUri) {
            throw new Error('FileDebt requires a file URI');
        }
        
        this.fileUri = fileUri;
        const now = Date.now();
        
        this.modifiedAt = options.modifiedAt || now;
        this.lastModifiedAt = options.lastModifiedAt || now;
        this.totalChanges = options.totalChanges || 0;
        this.modificationCount = options.modificationCount || 0;
        this.reviewed = options.reviewed || false;
        this.reviewedAt = options.reviewedAt || null;
        this.totalReviewTime = options.totalReviewTime || 0;
        this.firstOpenedAt = options.firstOpenedAt || null;
        this.lastVisitedAt = options.lastVisitedAt || null;
        this.reviewSessions = options.reviewSessions || 0;
    }

    /**
     * Add a change to this file debt
     * @param {number} changeSize - Size of the change
     */
    addChange(changeSize) {
        if (this.reviewed) {
            // File was reviewed but new changes came in - reset to unreviewed
            const now = Date.now();
            this.modifiedAt = now;
            this.lastModifiedAt = now;
            this.totalChanges = changeSize;
            this.modificationCount = 1;
            this.reviewed = false;
            this.reviewedAt = null;
        } else {
            // Accumulate changes
            this.totalChanges += changeSize;
            this.lastModifiedAt = Date.now();
            this.modificationCount++;
        }
    }

    /**
     * Mark file debt as reviewed
     * Note: This only marks FILE-LEVEL debt as reviewed.
     * Pending suggestions in this file are tracked separately.
     * @param {number} reviewTime - Time spent reviewing in milliseconds
     */
    markAsReviewed(reviewTime = 0) {
        this.reviewed = true;
        this.reviewedAt = Date.now();
        this.totalReviewTime += reviewTime;
    }

    /**
     * Update session information
     * @param {Object} sessionData - Session data
     * @param {number} sessionData.sessionStart - Session start timestamp
     */
    updateSession(sessionData) {
        if (!this.firstOpenedAt && sessionData.sessionStart) {
            this.firstOpenedAt = sessionData.sessionStart;
        }
        this.lastVisitedAt = Date.now();
        this.reviewSessions = (this.reviewSessions || 0) + 1;
    }

    /**
     * Check if file debt is reviewed
     * Note: This only checks FILE-LEVEL debt.
     * Pending suggestions must be checked separately.
     * @returns {boolean} True if file debt is reviewed
     */
    isReviewed() {
        return this.reviewed;
    }

    /**
     * Get age of file debt in milliseconds
     * @returns {number} Age in ms
     */
    getAge() {
        return Date.now() - this.modifiedAt;
    }

    /**
     * Convert to plain object for persistence
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            modifiedAt: this.modifiedAt,
            lastModifiedAt: this.lastModifiedAt,
            totalChanges: this.totalChanges,
            modificationCount: this.modificationCount,
            reviewed: this.reviewed,
            reviewedAt: this.reviewedAt,
            totalReviewTime: this.totalReviewTime,
            firstOpenedAt: this.firstOpenedAt,
            lastVisitedAt: this.lastVisitedAt,
            reviewSessions: this.reviewSessions
        };
    }

    /**
     * Create from plain object (for loading from persistence)
     * @param {string} fileUri - File URI
     * @param {Object} data - Plain object data
     * @returns {FileDebt} FileDebt instance
     */
    static fromJSON(fileUri, data) {
        return new FileDebt(fileUri, data);
    }
}

module.exports = FileDebt;
