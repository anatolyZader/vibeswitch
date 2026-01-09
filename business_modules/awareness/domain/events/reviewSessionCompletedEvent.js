/**
 * ReviewSessionCompletedEvent - Domain event for review session completion
 * 
 * Published when a user completes reviewing a file (sufficient engagement or timeout).
 */

class ReviewSessionCompletedEvent {
    constructor({ filePath, sessionStart, completedAt, reviewTime, engagementScore, occurredAt = new Date() }) {
        this.filePath = filePath;
        this.sessionStart = sessionStart;
        this.completedAt = completedAt;
        this.reviewTime = reviewTime;
        this.engagementScore = engagementScore;
        this.occurredAt = occurredAt;
        this.eventType = 'ReviewSessionCompletedEvent';
    }
    
    toJSON() {
        return {
            eventType: this.eventType,
            filePath: this.filePath,
            sessionStart: this.sessionStart,
            completedAt: this.completedAt,
            reviewTime: this.reviewTime,
            engagementScore: this.engagementScore,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

module.exports = ReviewSessionCompletedEvent;
