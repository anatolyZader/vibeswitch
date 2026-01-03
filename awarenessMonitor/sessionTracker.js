/**
 * Session Tracker
 * Tracks active sessions for files with debt or pending suggestions
 */

const { normalizeToUri } = require('./utils');

class SessionTracker {
    constructor(debtManager, agentSuggestionHandler, usageStats, updateScore, updateFileColorsInExplorer = null) {
        this.debtManager = debtManager;
        this.agentSuggestionHandler = agentSuggestionHandler;
        this.usageStats = usageStats;
        this.updateScore = updateScore;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        
        // Active sessions: URI string -> session data (FIXED: use URI as canonical key)
        this.fileTracking = new Map();
    }

    /**
     * Initialize session tracking for a file
     * Handles both debt and pending suggestions
     * FIXED: Accept URI string as canonical identifier
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     */
    initializeSession(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        
        if (this.fileTracking.has(uri)) {
            return; // Already tracking
        }

        const now = Date.now();
        const tracking = {
            sessionStart: now,
            lastActivity: now,
            cursorMovements: 0,
            scrollEvents: 0
        };
        
        this.fileTracking.set(uri, tracking);
        
        // Update debt if file has debt
        if (this.debtManager) {
            this.debtManager.updateSession(uri, {
                sessionStart: now
            });
        }
    }

    /**
     * Update cursor activity for a file being reviewed
     * FIXED: Accept URI string as canonical identifier
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     */
    updateCursorActivity(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const tracking = this.fileTracking.get(uri);
        if (tracking) {
            tracking.lastActivity = Date.now();
            tracking.cursorMovements++;
        }
    }

    /**
     * Update scroll activity for a file being reviewed
     * FIXED: Accept URI string as canonical identifier
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     */
    updateScrollActivity(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const tracking = this.fileTracking.get(uri);
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
        
        for (const [uri, tracking] of this.fileTracking.entries()) {
            // FIXED: Use URI as canonical identifier throughout
            const hasUnreviewedDebt = this.debtManager && this.debtManager.hasUnreviewedDebt(uri);
            const hasPendingSuggestions = this.agentSuggestionHandler ? 
                this.agentSuggestionHandler.getPendingSuggestionsForFile(uri).length > 0 : false;
            
            // If no debt and no pending suggestions, remove tracking
            if (!hasUnreviewedDebt && !hasPendingSuggestions) {
                this.fileTracking.delete(uri);
                continue;
            }
            
            const sessionDuration = now - tracking.sessionStart;
            const timeSinceActivity = now - tracking.lastActivity;
            
            // Check if session ended due to inactivity
            if (timeSinceActivity > ACTIVITY_TIMEOUT) {
                if (this.debtManager && hasUnreviewedDebt) {
                    const debt = this.debtManager.getDebt(uri);
                    if (debt) {
                        this.debtManager.markAsReviewed(uri, sessionDuration);
                    }
                }
                this.fileTracking.delete(uri);
                continue;
            }
            
            // Check if user has reviewed enough (scrolling OR cursor movements)
            if (sessionDuration >= MINIMUM_REVIEW_TIME && (tracking.cursorMovements >= 5 || tracking.scrollEvents >= 3)) {
                let needsScoreUpdate = false;
                
                // Mark debt as paid
                if (this.debtManager && hasUnreviewedDebt) {
                    const debt = this.debtManager.getDebt(uri);
                    if (debt) {
                        this.debtManager.markAsReviewed(uri, sessionDuration);
                        
                        // EMIT DEBT CLEARED TO USAGE STATISTICS
                        if (this.usageStats) {
                            this.usageStats.trackAIDebtCleared({
                                filePath: uri, // Keep filePath key for backward compatibility with usageStats
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
                    const pendingSuggestions = this.agentSuggestionHandler.getPendingSuggestionsForFile(uri);
                    for (const suggestion of pendingSuggestions) {
                        suggestion.reviewed = true;
                        suggestion.reviewStarted = tracking.sessionStart;
                        suggestion.reviewTime = sessionDuration;
                        needsScoreUpdate = true;
                    }
                }
                
                this.fileTracking.delete(uri);
                
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
     * FIXED: Accept URI string as canonical identifier
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {Object|null} Tracking data or null
     */
    getTracking(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        return this.fileTracking.get(uri) || null;
    }

    /**
     * Check if a file is being tracked
     * FIXED: Accept URI string as canonical identifier
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {boolean} True if file is being tracked
     */
    isTracking(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return false;
        return this.fileTracking.has(uri);
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

