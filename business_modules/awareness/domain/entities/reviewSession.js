/**
 * ReviewSession - Entity representing a user's review session for a file
 * 
 * Tracks detailed review engagement metrics for a single file review session.
 * This is a domain entity with identity (filePath + sessionStart).
 */

const ReviewEngagementPolicy = require('../policies/reviewEngagementPolicy');

class ReviewSession {
    /**
     * @param {string} filePath - File being reviewed (URI string)
     * @param {number} sessionStart - Timestamp when session started
     * @param {ReviewEngagementPolicy} engagementPolicy - Engagement policy (optional, uses default if not provided)
     */
    constructor(filePath, sessionStart = Date.now(), engagementPolicy = null) {
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('ReviewSession requires a non-empty filePath string');
        }
        this.filePath = filePath;
        this.sessionStart = sessionStart;
        this.lastActivity = sessionStart;
        this.cursorMovements = 0;
        this.scrollEvents = 0;
        this.reviewTime = 0;
        this.isActive = true;
        this.completedAt = null;
        
        // Engagement policy (optional - only use if explicitly provided)
        this.engagementPolicy = engagementPolicy || null;
    }

    /**
     * Update cursor activity
     */
    recordCursorMovement() {
        if (!this.isActive) return;
        this.cursorMovements++;
        this.lastActivity = Date.now();
    }

    /**
     * Update scroll activity
     */
    recordScrollEvent() {
        if (!this.isActive) return;
        this.scrollEvents++;
        this.lastActivity = Date.now();
        // Count scrolling as cursor movement for review purposes
        this.cursorMovements++;
    }

    /**
     * Check if session has sufficient engagement
     * Uses engagement policy if available, otherwise falls back to parameters
     * @param {number} minimumReviewTime - Minimum review time in ms (default: 30000)
     * @param {number} minimumMovements - Minimum cursor movements (default: 5)
     * @param {number} minimumScrolls - Minimum scroll events (default: 3)
     * @returns {boolean} True if session meets engagement criteria
     */
    hasSufficientEngagement(minimumReviewTime = 30000, minimumMovements = 5, minimumScrolls = 3) {
        // Use policy if explicitly provided, otherwise use parameters (backward compatibility)
        if (this.engagementPolicy) {
            return this.engagementPolicy.hasSufficientEngagement(this);
        }
        // Fallback for backward compatibility
        const duration = Date.now() - this.sessionStart;
        return duration >= minimumReviewTime && 
               (this.cursorMovements >= minimumMovements || this.scrollEvents >= minimumScrolls);
    }

    /**
     * Check if session has timed out due to inactivity
     * Uses engagement policy if available, otherwise falls back to parameter
     * @param {number} timeoutMs - Inactivity timeout in ms (default: 60000)
     * @returns {boolean} True if session has timed out
     */
    hasTimedOut(timeoutMs = 60000) {
        // Use policy if explicitly provided, otherwise use parameter (backward compatibility)
        if (this.engagementPolicy) {
            return this.engagementPolicy.hasTimedOut(this, timeoutMs);
        }
        // Fallback for backward compatibility
        const timeSinceActivity = Date.now() - this.lastActivity;
        return timeSinceActivity > timeoutMs;
    }

    /**
     * Complete the session
     * @param {number} reviewTime - Total review time in ms
     */
    complete(reviewTime = null) {
        this.isActive = false;
        this.completedAt = Date.now();
        this.reviewTime = reviewTime || (this.completedAt - this.sessionStart);
    }

    /**
     * Get session duration
     * @returns {number} Duration in milliseconds
     */
    getDuration() {
        if (this.completedAt) {
            return this.completedAt - this.sessionStart;
        }
        return Date.now() - this.sessionStart;
    }

    /**
     * Get time since last activity
     * @returns {number} Milliseconds since last activity
     */
    getTimeSinceActivity() {
        return Date.now() - this.lastActivity;
    }

    /**
     * Check if this session is for the given file
     * @param {string} filePath - File path to check (URI string)
     * @returns {boolean} True if session is for this file
     */
    isForFile(filePath) {
        return this.filePath === String(filePath);
    }

    /**
     * Get engagement score (0-100)
     * Based on duration, movements, and scrolls
     * @returns {number} Engagement score
     */
    getEngagementScore() {
        const duration = this.getDuration();
        const durationScore = Math.min((duration / 60000) * 40, 40); // Max 40 points for duration
        const movementScore = Math.min((this.cursorMovements / 20) * 30, 30); // Max 30 points
        const scrollScore = Math.min((this.scrollEvents / 10) * 30, 30); // Max 30 points
        
        return Math.min(durationScore + movementScore + scrollScore, 100);
    }
}

module.exports = ReviewSession;
