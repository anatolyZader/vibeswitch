/**
 * Tests for SuggestionBatchCreatedEvent
 * 
 * Tests event creation and serialization.
 */

const SuggestionBatchCreatedEvent = require('../../../../../business_modules/awareness/domain/events/suggestionBatchCreatedEvent');

describe('SuggestionBatchCreatedEvent', () => {
    test('should create event with required fields', () => {
        const batchId = 'batch-123';
        const filePath = 'file:///workspace/test.js';
        const suggestionCount = 5;
        const totalSize = 1000;
        const event = new SuggestionBatchCreatedEvent({
            batchId,
            filePath,
            suggestionCount,
            totalSize
        });
        
        expect(event.batchId).toBe(batchId);
        expect(event.filePath).toBe(filePath);
        expect(event.suggestionCount).toBe(suggestionCount);
        expect(event.totalSize).toBe(totalSize);
        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(event.eventType).toBe('SuggestionBatchCreatedEvent');
    });

    test('should create event with default occurredAt', () => {
        const before = new Date();
        const event = new SuggestionBatchCreatedEvent({
            batchId: 'batch-123',
            filePath: 'file:///workspace/test.js',
            suggestionCount: 3,
            totalSize: 500
        });
        const after = new Date();
        
        expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should serialize to JSON', () => {
        const batchId = 'batch-123';
        const filePath = 'file:///workspace/test.js';
        const suggestionCount = 5;
        const totalSize = 1000;
        const occurredAt = new Date('2024-01-01T00:00:00Z');
        const event = new SuggestionBatchCreatedEvent({
            batchId,
            filePath,
            suggestionCount,
            totalSize,
            occurredAt
        });
        
        const json = event.toJSON();
        
        expect(json.eventType).toBe('SuggestionBatchCreatedEvent');
        expect(json.batchId).toBe(batchId);
        expect(json.filePath).toBe(filePath);
        expect(json.suggestionCount).toBe(suggestionCount);
        expect(json.totalSize).toBe(totalSize);
        expect(json.occurredAt).toBe(occurredAt.toISOString());
    });
});
