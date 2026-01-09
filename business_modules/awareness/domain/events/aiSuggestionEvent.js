/**
 * AISuggestionEvent - Domain event for AI-generated code suggestions
 * 
 * Published when the AI agent generates a code suggestion that needs review.
 */

class AISuggestionEvent {
    constructor({ suggestionId, filePath, range, changeSize, reason, occurredAt = new Date() }) {
        this.suggestionId = suggestionId;
        this.filePath = filePath;
        this.range = range;
        this.changeSize = changeSize;
        this.reason = reason;
        this.occurredAt = occurredAt;
        this.eventType = 'AISuggestionEvent';
    }

    toJSON() {
        return {
            eventType: this.eventType,
            suggestionId: this.suggestionId,
            filePath: this.filePath,
            range: this.range,
            changeSize: this.changeSize,
            reason: this.reason,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

module.exports = AISuggestionEvent;

