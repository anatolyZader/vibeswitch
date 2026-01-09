/**
 * SuggestionBatchCreatedEvent - Domain event for suggestion batch creation
 * 
 * Published when a batch of related AI suggestions is created (e.g., from a single refactor).
 */

class SuggestionBatchCreatedEvent {
    constructor({ batchId, filePath, suggestionCount, totalSize, occurredAt = new Date() }) {
        this.batchId = batchId;
        this.filePath = filePath;
        this.suggestionCount = suggestionCount;
        this.totalSize = totalSize;
        this.occurredAt = occurredAt;
        this.eventType = 'SuggestionBatchCreatedEvent';
    }
    
    toJSON() {
        return {
            eventType: this.eventType,
            batchId: this.batchId,
            filePath: this.filePath,
            suggestionCount: this.suggestionCount,
            totalSize: this.totalSize,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

module.exports = SuggestionBatchCreatedEvent;
