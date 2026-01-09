/**
 * ReviewSessionStartedEvent - Domain event for review session start
 * 
 * Published when a user starts reviewing a file with AI-generated changes.
 */

class ReviewSessionStartedEvent {
    constructor({ filePath, sessionStart, occurredAt = new Date() }) {
        this.filePath = filePath;
        this.sessionStart = sessionStart;
        this.occurredAt = occurredAt;
        this.eventType = 'ReviewSessionStartedEvent';
    }
    
    toJSON() {
        return {
            eventType: this.eventType,
            filePath: this.filePath,
            sessionStart: this.sessionStart,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

module.exports = ReviewSessionStartedEvent;
