/**
 * ReviewEngagementPolicy - Domain policy for review session engagement rules
 * 
 * Encapsulates business rules for determining if a review session has sufficient engagement.
 * This is a stateless policy that can be configured per mode or environment.
 */

class ReviewEngagementPolicy {
    /**
     * @param {number} minReviewTimeMs - Minimum review time in milliseconds (default: 30000)
     * @param {number} minMovements - Minimum cursor movements (default: 5)
     * @param {number} minScrolls - Minimum scroll events (default: 3)
     */
    constructor({
        minReviewTimeMs = 30000,
        minMovements = 5,
        minScrolls = 3
    } = {}) {
        this.minReviewTimeMs = minReviewTimeMs;
        this.minMovements = minMovements;
        this.minScrolls = minScrolls;
    }

    /**
     * Check if a review session has sufficient engagement
     * @param {ReviewSession} session - Review session entity
     * @returns {boolean} True if session has sufficient engagement
     */
    hasSufficientEngagement(session) {
        if (!session) return false;
        
        const duration = Date.now() - session.sessionStart;
        return duration >= this.minReviewTimeMs && 
               (session.cursorMovements >= this.minMovements || session.scrollEvents >= this.minScrolls);
    }

    /**
     * Check if session has timed out due to inactivity
     * @param {ReviewSession} session - Review session entity
     * @param {number} timeoutMs - Inactivity timeout in milliseconds (default: 60000)
     * @returns {boolean} True if session has timed out
     */
    hasTimedOut(session, timeoutMs = 60000) {
        if (!session) return true;
        const timeSinceActivity = Date.now() - session.lastActivity;
        return timeSinceActivity > timeoutMs;
    }
}

module.exports = ReviewEngagementPolicy;
