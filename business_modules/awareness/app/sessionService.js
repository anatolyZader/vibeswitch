/**
 * SessionService - Application service for managing review sessions
 * 
 * Orchestrates review session tracking, coordinates with debt service,
 * and publishes domain events. This is an application service.
 */

const { normalizeToUri } = require('../domain/utils/utils');
const ReviewSession = require('../domain/entities/reviewSession');

class SessionService {
    /**
     * @param {Object} debtService - Debt service (application service)
     * @param {Object} suggestionService - Suggestion service (application service)
     * @param {Function} onDebtCleared - Callback when debt is cleared
     * @param {Function} updateScore - Score update callback
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors (optional)
     * @param {Object} messagingAdapter - Messaging adapter for domain events (optional)
     */
    constructor(debtService, suggestionService, onDebtCleared, updateScore, updateFileColorsInExplorer = null, messagingAdapter = null) {
        this.debtService = debtService;
        this.suggestionService = suggestionService;
        this.onDebtCleared = onDebtCleared;
        this.updateScore = updateScore;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.messagingAdapter = messagingAdapter; // Optional - for publishing domain events
        
        // Active sessions: URI string -> ReviewSession entity
        this.sessions = new Map();
    }

    /**
     * Initialize session tracking for a file
     * Creates a new ReviewSession entity
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {ReviewSession|null} Created session or null
     */
    initializeSession(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        
        if (this.sessions.has(uri)) {
            return this.sessions.get(uri); // Return existing session
        }

        const session = new ReviewSession(uri);
        this.sessions.set(uri, session);
        
        // Update debt if file has debt
        if (this.debtService) {
            this.debtService.updateSession(uri, {
                sessionStart: session.sessionStart
            });
        }

        // Publish domain event if messaging adapter is available
        if (this.messagingAdapter) {
            const ReviewSessionStartedEvent = require('../events/reviewSessionStartedEvent');
            const event = new ReviewSessionStartedEvent({
                filePath: uri,
                sessionStart: session.sessionStart
            });
            this.messagingAdapter.publishReviewSessionStartedEvent(event).catch(err => {
                // Log but don't throw - event publishing is non-critical
                // Note: loggerPort not available in SessionService, but this is non-critical
                // Consider injecting loggerPort if needed for consistency
            });
        }

        return session;
    }

    /**
     * Update cursor activity for a file being reviewed
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     */
    updateCursorActivity(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const session = this.sessions.get(uri);
        if (session) {
            session.recordCursorMovement();
        }
    }

    /**
     * Update scroll activity for a file being reviewed
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     */
    updateScrollActivity(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const session = this.sessions.get(uri);
        if (session) {
            session.recordScrollEvent();
        }
    }

    /**
     * Check session progress periodically
     * Uses ReviewSession entity methods for business logic
     */
    checkProgress() {
        const MINIMUM_REVIEW_TIME = 30000; // 30 seconds
        const ACTIVITY_TIMEOUT = 60000; // 1 minute
        
        if (this.sessions.size === 0) {
            return;
        }
        
        for (const [uri, session] of this.sessions.entries()) {
            const hasUnreviewedDebt = this.debtService && this.debtService.hasUnreviewedDebt(uri);
            const hasPendingSuggestions = this.suggestionService ? 
                this.suggestionService.getPendingSuggestionsForFile(uri).length > 0 : false;
            
            // If no debt and no pending suggestions, remove session
            if (!hasUnreviewedDebt && !hasPendingSuggestions) {
                this.sessions.delete(uri);
                continue;
            }
            
            // Check if session timed out
            if (session.hasTimedOut(ACTIVITY_TIMEOUT)) {
                if (this.debtService && hasUnreviewedDebt) {
                    const debt = this.debtService.getDebt(uri);
                    if (debt) {
                        session.complete();
                        this.debtService.markAsReviewed(uri, session.reviewTime);
                    }
                }
                this.sessions.delete(uri);
                continue;
            }
            
            // Check if user has reviewed enough
            if (session.hasSufficientEngagement(MINIMUM_REVIEW_TIME, 5, 3)) {
                let needsScoreUpdate = false;
                
                // Mark debt as paid
                if (this.debtService && hasUnreviewedDebt) {
                    const debt = this.debtService.getDebt(uri);
                    if (debt) {
                        session.complete();
                        this.debtService.markAsReviewed(uri, session.reviewTime);
                        
                        // Publish domain event if messaging adapter is available
                        if (this.messagingAdapter) {
                            const ReviewSessionCompletedEvent = require('../events/reviewSessionCompletedEvent');
                            const event = new ReviewSessionCompletedEvent({
                                filePath: uri,
                                sessionStart: session.sessionStart,
                                completedAt: session.completedAt,
                                reviewTime: session.reviewTime,
                                engagementScore: session.getEngagementScore()
                            });
                            this.messagingAdapter.publishReviewSessionCompletedEvent(event).catch(err => {
                                // Log but don't throw - event publishing is non-critical
                                // Note: loggerPort not available in SessionService, but this is non-critical
                                // Consider injecting loggerPort if needed for consistency
                            });
                        }
                        
                        // Call optional callback with engagement score
                        if (this.onDebtCleared) {
                            this.onDebtCleared({
                                filePath: uri,
                                totalChanges: debt.totalChanges,
                                totalReviewTime: debt.totalReviewTime + session.reviewTime,
                                modificationCount: debt.modificationCount,
                                engagementScore: session.getEngagementScore()
                            });
                        }
                        
                        needsScoreUpdate = true;
                    }
                }
                
                // Mark all pending suggestions in this file as reviewed
                if (hasPendingSuggestions && this.suggestionService) {
                    const pendingSuggestions = this.suggestionService.getPendingSuggestionsForFile(uri);
                    for (const suggestion of pendingSuggestions) {
                        suggestion.markAsReviewed(session.reviewTime, session.sessionStart);
                        needsScoreUpdate = true;
                    }
                }
                
                this.sessions.delete(uri);
                
                // Update file colors and score
                if (needsScoreUpdate && this.updateFileColorsInExplorer) {
                    this.updateFileColorsInExplorer();
                }
                
                if (needsScoreUpdate && this.updateScore) {
                    this.updateScore();
                }
            }
        }
    }

    /**
     * Get session for a file
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {ReviewSession|null} Session or null
     */
    getSession(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        return this.sessions.get(uri) || null;
    }

    /**
     * Get tracking data for a file (backward compatibility)
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {Object|null} Tracking data or null
     */
    getTracking(filePathOrUri) {
        const session = this.getSession(filePathOrUri);
        if (!session) return null;
        
        // Return legacy format for backward compatibility
        return {
            sessionStart: session.sessionStart,
            lastActivity: session.lastActivity,
            cursorMovements: session.cursorMovements,
            scrollEvents: session.scrollEvents
        };
    }

    /**
     * Check if a file is being tracked
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {boolean} True if file is being tracked
     */
    isTracking(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return false;
        return this.sessions.has(uri);
    }

    /**
     * Clear all tracking sessions
     */
    clear() {
        this.sessions.clear();
    }

    /**
     * Get number of active sessions
     * @returns {number} Number of active sessions
     */
    getActiveSessionCount() {
        return this.sessions.size;
    }

    /**
     * Get all active sessions
     * @returns {Array<ReviewSession>} Array of active sessions
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
}

module.exports = SessionService;

