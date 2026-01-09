/**
 * KeepAllEvent - Domain event for "keep all" detection
 * 
 * Published when the system detects that a user accepted all AI suggestions without review.
 */

class KeepAllEvent {
    constructor({ suggestionIds, filePath, acceptanceCount, occurredAt = new Date() }) {
        this.suggestionIds = suggestionIds || [];
        this.filePath = filePath;
        this.acceptanceCount = acceptanceCount;
        this.occurredAt = occurredAt;
        this.eventType = 'KeepAllEvent';
    }

    toJSON() {
        return {
            eventType: this.eventType,
            suggestionIds: this.suggestionIds,
            filePath: this.filePath,
            acceptanceCount: this.acceptanceCount,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

module.exports = KeepAllEvent;

