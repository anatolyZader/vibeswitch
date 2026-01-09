/**
 * AISuggestionOutcomeEvent - Domain event for AI suggestion outcomes
 * 
 * Published when a user accepts, rejects, or modifies an AI suggestion.
 */

class AISuggestionOutcomeEvent {
    constructor({ suggestionId, outcome, filePath, occurredAt = new Date() }) {
        if (!['accepted', 'rejected', 'modified'].includes(outcome)) {
            throw new Error(`Invalid outcome: ${outcome}. Must be 'accepted', 'rejected', or 'modified'`);
        }
        
        this.suggestionId = suggestionId;
        this.outcome = outcome;
        this.filePath = filePath;
        this.occurredAt = occurredAt;
        this.eventType = 'AISuggestionOutcomeEvent';
    }

    toJSON() {
        return {
            eventType: this.eventType,
            suggestionId: this.suggestionId,
            outcome: this.outcome,
            filePath: this.filePath,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

module.exports = AISuggestionOutcomeEvent;

