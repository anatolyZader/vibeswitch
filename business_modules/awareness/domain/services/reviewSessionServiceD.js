/**
 * ReviewSessionServiceD - Domain service for review session operations
 * 
 * Encapsulates business logic for calculating review session metrics and validations.
 * This is a domain service (stateless, no ports needed).
 */

class ReviewSessionServiceD {
    constructor() {
        // No constructor dependencies - stateless domain service
    }

    /**
     * Calculate engagement score (0-100)
     * @param {ReviewSession} session - Review session entity
     * @returns {number} Engagement score
     */
    calculateEngagementScore(session) {
        if (!session) return 0;

        const duration = session.getDuration ? session.getDuration() : (Date.now() - session.sessionStart);
        const cursorMovements = session.cursorMovements || 0;
        const scrollEvents = session.scrollEvents || 0;

        // Duration score (max 40 points)
        const durationScore = Math.min((duration / 60000) * 40, 40);
        
        // Movement score (max 30 points)
        const movementScore = Math.min((cursorMovements / 20) * 30, 30);
        
        // Scroll score (max 30 points)
        const scrollScore = Math.min((scrollEvents / 10) * 30, 30);
        
        return Math.min(durationScore + movementScore + scrollScore, 100);
    }

    /**
     * Check if session has sufficient engagement
     * @param {ReviewSession} session - Review session entity
     * @param {Object} thresholds - Thresholds {minReviewTime, minMovements, minScrolls}
     * @returns {boolean} True if sufficient engagement
     */
    hasSufficientEngagement(session, thresholds = {}) {
        if (!session) return false;

        const {
            minReviewTime = 30000,
            minMovements = 5,
            minScrolls = 3
        } = thresholds;

        const duration = session.getDuration ? session.getDuration() : (Date.now() - session.sessionStart);
        const cursorMovements = session.cursorMovements || 0;
        const scrollEvents = session.scrollEvents || 0;

        return duration >= minReviewTime && 
               (cursorMovements >= minMovements || scrollEvents >= minScrolls);
    }

    /**
     * Calculate total review time
     * @param {ReviewSession} session - Review session entity
     * @returns {number} Review time in milliseconds
     */
    calculateReviewTime(session) {
        if (!session) return 0;

        if (session.completedAt) {
            return session.completedAt - session.sessionStart;
        }

        return Date.now() - session.sessionStart;
    }

    /**
     * Determine if session should timeout
     * @param {ReviewSession} session - Review session entity
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {boolean} True if should timeout
     */
    shouldTimeoutSession(session, timeoutMs = 60000) {
        if (!session) return false;

        const timeSinceActivity = session.getTimeSinceActivity 
            ? session.getTimeSinceActivity() 
            : (Date.now() - (session.lastActivity || session.sessionStart));

        return timeSinceActivity > timeoutMs;
    }
}

module.exports = ReviewSessionServiceD;
