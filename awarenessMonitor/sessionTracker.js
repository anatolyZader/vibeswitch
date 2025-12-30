/**
 * Session Tracker
 * Tracks active sessions for files with debt or pending suggestions
 */

class SessionTracker {
    constructor(debtManager, agentSuggestionHandler, usageStats, updateScore, updateFileColorsInExplorer = null) {
        this.debtManager = debtManager;
        this.agentSuggestionHandler = agentSuggestionHandler;
        this.usageStats = usageStats;
        this.updateScore = updateScore;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        
        // Active sessions: filepath -> session data
        this.fileTracking = new Map();
    }

    /**
     * Initialize session tracking for a file
     * Handles both debt and pending suggestions
     * @param {string} filePath - Path to the file
     */
    initializeSession(filePath) {
        if (this.fileTracking.has(filePath)) {
            return; // Already tracking
        }

        const now = Date.now();
        const tracking = {
            sessionStart: now,
            lastActivity: now,
            cursorMovements: 0,
            scrollEvents: 0
        };
        
        this.fileTracking.set(filePath, tracking);
        
        // Update debt if file has debt
        if (this.debtManager) {
            this.debtManager.updateSession(filePath, {
                sessionStart: now
            });
        }
    }

    /**
     * Update cursor activity for a file being reviewed
     * @param {string} filePath - Path to the file
     */
    updateCursorActivity(filePath) {
        const tracking = this.fileTracking.get(filePath);
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
        const tracking = this.fileTracking.get(filePath);
        if (tracking) {
            tracking.lastActivity = Date.now();
            tracking.scrollEvents++;
            // Count scrolling as cursor movement for review purposes
            tracking.cursorMovements++;
        }
    }

    /**
     * Check session progress periodically
     * Determines if sessions should be marked as complete
     */
    checkProgress() {
        const now = Date.now();
        const MINIMUM_REVIEW_TIME = 30000; // 30 seconds
        const ACTIVITY_TIMEOUT = 60000; // 1 minute of inactivity ends session
        
        const activeSessions = this.fileTracking.size;
        if (activeSessions === 0) {
            return; // No active sessions
        }
        
        for (const [filePath, tracking] of this.fileTracking.entries()) {
            const hasUnreviewedDebt = this.debtManager && this.debtManager.hasUnreviewedDebt(filePath);
            const hasPendingSuggestions = this.agentSuggestionHandler ? 
                this.agentSuggestionHandler.getPendingSuggestionsForFile(filePath).length > 0 : false;
            
            // If no debt and no pending suggestions, remove tracking
            if (!hasUnreviewedDebt && !hasPendingSuggestions) {
                this.fileTracking.delete(filePath);
                continue;
            }
            
            const sessionDuration = now - tracking.sessionStart;
            const timeSinceActivity = now - tracking.lastActivity;
            
            // Check if session ended due to inactivity
            if (timeSinceActivity > ACTIVITY_TIMEOUT) {
                if (this.debtManager && hasUnreviewedDebt) {
                    const debt = this.debtManager.getDebt(filePath);
                    if (debt) {
                        this.debtManager.markAsReviewed(filePath, sessionDuration);
                    }
                }
                this.fileTracking.delete(filePath);
                continue;
            }
            
            // Check if user has reviewed enough (scrolling OR cursor movements)
            if (sessionDuration >= MINIMUM_REVIEW_TIME && (tracking.cursorMovements >= 5 || tracking.scrollEvents >= 3)) {
                let needsScoreUpdate = false;
                
                // Mark debt as paid
                if (this.debtManager && hasUnreviewedDebt) {
                    const debt = this.debtManager.getDebt(filePath);
                    if (debt) {
                        this.debtManager.markAsReviewed(filePath, sessionDuration);
                        
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
                if (hasPendingSuggestions && this.agentSuggestionHandler) {
                    const pendingSuggestions = this.agentSuggestionHandler.getPendingSuggestionsForFile(filePath);
                    for (const suggestion of pendingSuggestions) {
                        suggestion.reviewed = true;
                        suggestion.reviewStarted = tracking.sessionStart;
                        suggestion.reviewTime = sessionDuration;
                        needsScoreUpdate = true;
                    }
                }
                
                this.fileTracking.delete(filePath);
                
                // Update file colors immediately when suggestions are reviewed
                if (needsScoreUpdate && this.updateFileColorsInExplorer) {
                    this.updateFileColorsInExplorer();
                }
                
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
        return this.fileTracking.get(filePath) || null;
    }

    /**
     * Check if a file is being tracked
     * @param {string} filePath - Path to the file
     * @returns {boolean} True if file is being tracked
     */
    isTracking(filePath) {
        return this.fileTracking.has(filePath);
    }

    /**
     * Clear all tracking sessions
     */
    clear() {
        this.fileTracking.clear();
    }

    /**
     * Get number of active sessions
     * @returns {number} Number of active sessions
     */
    getActiveSessionCount() {
        return this.fileTracking.size;
    }
}

module.exports = SessionTracker;

