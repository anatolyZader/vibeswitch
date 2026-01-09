/**
 * Tests for AwarenessEventEmitterMessagingAdapter with new events
 * 
 * Tests that the adapter correctly publishes new domain events.
 */

const EventEmitter = require('events');
const AwarenessEventEmitterMessagingAdapter = require('../../../../../business_modules/awareness/infrastructure/adapters/awarenessEventEmitterMessagingAdapter');
const ReviewSessionStartedEvent = require('../../../../../business_modules/awareness/domain/events/reviewSessionStartedEvent');
const ReviewSessionCompletedEvent = require('../../../../../business_modules/awareness/domain/events/reviewSessionCompletedEvent');
const SuggestionBatchCreatedEvent = require('../../../../../business_modules/awareness/domain/events/suggestionBatchCreatedEvent');

describe('AwarenessEventEmitterMessagingAdapter - New Events', () => {
    let adapter;
    let eventEmitter;

    beforeEach(() => {
        eventEmitter = new EventEmitter();
        adapter = new AwarenessEventEmitterMessagingAdapter(eventEmitter);
    });

    afterEach(() => {
        eventEmitter.removeAllListeners();
    });

    test('should publish ReviewSessionStartedEvent', async () => {
        let receivedEvent = null;
        eventEmitter.on('reviewSessionStarted', (payload) => {
            receivedEvent = payload;
        });

        const event = new ReviewSessionStartedEvent({
            filePath: 'file:///workspace/test.js',
            sessionStart: 1000000
        });

        await adapter.publishReviewSessionStartedEvent(event);

        expect(receivedEvent).not.toBeNull();
        expect(receivedEvent.event.eventType).toBe('ReviewSessionStartedEvent');
        expect(receivedEvent.event.filePath).toBe('file:///workspace/test.js');
        expect(receivedEvent.correlationId).toBeDefined();
    });

    test('should publish ReviewSessionCompletedEvent', async () => {
        let receivedEvent = null;
        eventEmitter.on('reviewSessionCompleted', (payload) => {
            receivedEvent = payload;
        });

        const event = new ReviewSessionCompletedEvent({
            filePath: 'file:///workspace/test.js',
            sessionStart: 1000000,
            completedAt: 1045000,
            reviewTime: 45000,
            engagementScore: 75
        });

        await adapter.publishReviewSessionCompletedEvent(event);

        expect(receivedEvent).not.toBeNull();
        expect(receivedEvent.event.eventType).toBe('ReviewSessionCompletedEvent');
        expect(receivedEvent.event.filePath).toBe('file:///workspace/test.js');
        expect(receivedEvent.event.engagementScore).toBe(75);
        expect(receivedEvent.correlationId).toBeDefined();
    });

    test('should publish SuggestionBatchCreatedEvent', async () => {
        let receivedEvent = null;
        eventEmitter.on('suggestionBatchCreated', (payload) => {
            receivedEvent = payload;
        });

        const event = new SuggestionBatchCreatedEvent({
            batchId: 'batch-123',
            filePath: 'file:///workspace/test.js',
            suggestionCount: 5,
            totalSize: 1000
        });

        await adapter.publishSuggestionBatchCreatedEvent(event);

        expect(receivedEvent).not.toBeNull();
        expect(receivedEvent.event.eventType).toBe('SuggestionBatchCreatedEvent');
        expect(receivedEvent.event.batchId).toBe('batch-123');
        expect(receivedEvent.event.suggestionCount).toBe(5);
        expect(receivedEvent.event.totalSize).toBe(1000);
        expect(receivedEvent.correlationId).toBeDefined();
    });

    test('should generate correlation ID if not provided', async () => {
        let receivedEvent = null;
        eventEmitter.on('reviewSessionStarted', (payload) => {
            receivedEvent = payload;
        });

        const event = new ReviewSessionStartedEvent({
            filePath: 'file:///workspace/test.js',
            sessionStart: 1000000
        });

        await adapter.publishReviewSessionStartedEvent(event);

        expect(receivedEvent.correlationId).toBeDefined();
        expect(typeof receivedEvent.correlationId).toBe('string');
        expect(receivedEvent.correlationId.startsWith('awareness-')).toBe(true);
    });

    test('should use provided correlation ID', async () => {
        let receivedEvent = null;
        eventEmitter.on('reviewSessionStarted', (payload) => {
            receivedEvent = payload;
        });

        const event = new ReviewSessionStartedEvent({
            filePath: 'file:///workspace/test.js',
            sessionStart: 1000000
        });

        const correlationId = 'custom-correlation-id';
        await adapter.publishReviewSessionStartedEvent(event, correlationId);

        expect(receivedEvent.correlationId).toBe(correlationId);
    });

    test('should handle publishing errors gracefully', async () => {
        // Create adapter with event emitter that throws
        const errorEmitter = new EventEmitter();
        errorEmitter.emit = () => {
            throw new Error('Publishing failed');
        };
        
        const errorAdapter = new AwarenessEventEmitterMessagingAdapter(errorEmitter);
        const event = new ReviewSessionStartedEvent({
            filePath: 'file:///workspace/test.js',
            sessionStart: 1000000
        });

        try {
            await errorAdapter.publishReviewSessionStartedEvent(event);
            assert.fail('Should have thrown an error');
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
        }
    });

    test('should publish all event types correctly', async () => {
        const events = [];
        
        eventEmitter.on('reviewSessionStarted', (payload) => {
            events.push({ type: 'reviewSessionStarted', payload });
        });
        eventEmitter.on('reviewSessionCompleted', (payload) => {
            events.push({ type: 'reviewSessionCompleted', payload });
        });
        eventEmitter.on('suggestionBatchCreated', (payload) => {
            events.push({ type: 'suggestionBatchCreated', payload });
        });

        await adapter.publishReviewSessionStartedEvent(new ReviewSessionStartedEvent({
            filePath: 'file:///workspace/test.js',
            sessionStart: 1000000
        }));

        await adapter.publishReviewSessionCompletedEvent(new ReviewSessionCompletedEvent({
            filePath: 'file:///workspace/test.js',
            sessionStart: 1000000,
            completedAt: 1045000,
            reviewTime: 45000,
            engagementScore: 75
        }));

        await adapter.publishSuggestionBatchCreatedEvent(new SuggestionBatchCreatedEvent({
            batchId: 'batch-123',
            filePath: 'file:///workspace/test.js',
            suggestionCount: 3,
            totalSize: 500
        }));

        expect(events.length).toBe(3);
        expect(events[0].type).toBe('reviewSessionStarted');
        expect(events[1].type).toBe('reviewSessionCompleted');
        expect(events[2].type).toBe('suggestionBatchCreated');
    });
});
