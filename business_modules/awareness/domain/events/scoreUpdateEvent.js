/**
 * ScoreUpdateEvent - Domain event for awareness score updates
 * 
 * Published when the awareness score changes (new suggestions, debt changes, etc.).
 */

class ScoreUpdateEvent {
    constructor({ score, components, suggestions, debt, occurredAt = new Date() }) {
        this.score = score;
        this.components = components || {};
        this.suggestions = suggestions || { total: 0, pending: 0, pendingFiles: [] };
        this.debt = debt || { unreviewedFiles: 0, files: [] };
        this.occurredAt = occurredAt;
        this.eventType = 'ScoreUpdateEvent';
    }

    toJSON() {
        return {
            eventType: this.eventType,
            score: this.score,
            components: this.components,
            suggestions: this.suggestions,
            debt: this.debt,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

module.exports = ScoreUpdateEvent;

