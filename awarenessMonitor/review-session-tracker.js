/**
 * Review Session Tracker
 * Tracks active review sessions for files with review debt or pending suggestions
 */

class ReviewSessionTracker {
    constructor(reviewDebtManager, suggestionTracker, usageStats, updateScore) {
        this.reviewDebtManager = reviewDebtManager;
        this.suggestionTracker = suggestionTracker;
        this.usageStats = usageStats;
        this.updateScore = updateScore;
        
        // Active review sessions: filepath -> review session data
        this.fileReviewTracking = new Map();
    }

    /**
     * Initialize review session tracking for a file
     * Handles both review debt and pending suggestions
     * @param {string} filePath - Path to the file
     */
    initializeReviewSession(filePath) {
        if (this.fileReviewTracking.has(filePath)) {
            return; // Already tracking
        }

        const now = Date.now();
        const tracking = {
            sessionStart: now,
            lastActivity: now,
            cursorMovements: 0,
            scrollEvents: 0
        };
        
        this.fileReviewTracking.set(filePath, tracking);
        
        // Update review debt if file has debt
        if (this.reviewDebtManager) {
            this.reviewDebtManager.updateReviewSession(filePath, {
                sessionStart: now
            });
        }
    }

    /**
     * Update cursor activity for a file being reviewed
     * @param {string} filePath - Path to the file
     */
    updateCursorActivity(filePath) {
        const tracking = this.fileReviewTracking.get(filePath);
        if (tracking) {
            tracking.lastActivity = Date.now();
            tracking.cursorMovements++;
        }
    }

    /**
     * Update scroll activity for a file being reviewed
     * @param {string} filePath - Path to the file
     */
    updateScrollActivity(filePath) {
        const tracking = this.fileReviewTracking.get(filePath);
        if (tracking) {
            tracking.lastActivity = Date.now();
            tracking.scrollEvents++;
            // Count scrolling as cursor movement for review purposes
            tracking.cursorMovements++;
        }
    }

    /**
     * Check review progress periodically
     * Determines if review sessions should be marked as complete
     */
    checkReviewProgress() {
        const now = Date.now();
        const MINIMUM_REVIEW_TIME = 30000; // 30 seconds
        const ACTIVITY_TIMEOUT = 60000; // 1 minute of inactivity ends session
        
        const activeSessions = this.fileReviewTracking.size;
        if (activeSessions === 0) {
            return; // No active review sessions
        }
        
        for (const [filePath, tracking] of this.fileReviewTracking.entries()) {
            const hasUnreviewedDebt = this.reviewDebtManager && this.reviewDebtManager.hasUnreviewedDebt(filePath);
            const hasPendingSuggestions = this.suggestionTracker ? 
                this.suggestionTracker.getPendingSuggestionsForFile(filePath).length > 0 : false;
            
            // If no debt and no pending suggestions, remove tracking
            if (!hasUnreviewedDebt && !hasPendingSuggestions) {
                this.fileReviewTracking.delete(filePath);
                continue;
            }
            
            const sessionDuration = now - tracking.sessionStart;
            const timeSinceActivity = now - tracking.lastActivity;
            
            // Check if session ended due to inactivity
            if (timeSinceActivity > ACTIVITY_TIMEOUT) {
                if (this.reviewDebtManager && hasUnreviewedDebt) {
                    const debt = this.reviewDebtManager.getDebt(filePath);
                    if (debt) {
                        this.reviewDebtManager.markAsReviewed(filePath, sessionDuration);
                    }
                }
                this.fileReviewTracking.delete(filePath);
                continue;
            }
            
            // Check if user has reviewed enough (scrolling OR cursor movements)
            if (sessionDuration >= MINIMUM_REVIEW_TIME && (tracking.cursorMovements >= 5 || tracking.scrollEvents >= 3)) {
                let needsScoreUpdate = false;
                
                // Mark review debt as paid
                if (this.reviewDebtManager && hasUnreviewedDebt) {
                    const debt = this.reviewDebtManager.getDebt(filePath);
                    if (debt) {
                        this.reviewDebtManager.markAsReviewed(filePath, sessionDuration);
                        
                        // EMIT DEBT CLEARED TO USAGE STATISTICS
                        if (this.usageStats) {
                            this.usageStats.trackAIDebtCleared({
                                filePath,
                                totalChanges: debt.totalChanges,
                                totalReviewTime: debt.totalReviewTime + sessionDuration,
                                modificationCount: debt.modificationCount
                            });
                        }
                        
                        needsScoreUpdate = true;
                    }
                }
                
                // Mark all pending suggestions in this file as reviewed
                if (hasPendingSuggestions && this.suggestionTracker) {
                    const pendingSuggestions = this.suggestionTracker.getPendingSuggestionsForFile(filePath);
                    for (const suggestion of pendingSuggestions) {
                        suggestion.reviewed = true;
                        suggestion.reviewStarted = tracking.sessionStart;
                        suggestion.reviewTime = sessionDuration;
                        needsScoreUpdate = true;
                    }
                }
                
                this.fileReviewTracking.delete(filePath);
                
                if (needsScoreUpdate && this.updateScore) {
                    this.updateScore(); // Recalculate score immediately
                }
            }
        }
    }

    /**
     * Get tracking data for a file
     * @param {string} filePath - Path to the file
     * @returns {Object|null} Tracking data or null
     */
    getTracking(filePath) {
        return this.fileReviewTracking.get(filePath) || null;
    }

    /**
     * Check if a file is being tracked
     * @param {string} filePath - Path to the file
     * @returns {boolean} True if file is being tracked
     */
    isTracking(filePath) {
        return this.fileReviewTracking.has(filePath);
    }

    /**
     * Clear all tracking sessions
     */
    clear() {
        this.fileReviewTracking.clear();
    }

    /**
     * Get number of active sessions
     * @returns {number} Number of active review sessions
     */
    getActiveSessionCount() {
        return this.fileReviewTracking.size;
    }
}

module.exports = ReviewSessionTracker;

