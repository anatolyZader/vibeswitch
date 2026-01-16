/**
 * Tests for ReviewSession domain events
 * 
 * Tests event creation and serialization.
 */

const ReviewSessionStartedEvent = require('../../../../../business_modules/awareness/domain/events/reviewSessionStartedEvent');
const ReviewSessionCompletedEvent = require('../../../../../business_modules/awareness/domain/events/reviewSessionCompletedEvent');

describe('ReviewSessionStartedEvent', () => {
    test('should create event with required fields', () => {
        const filePath = 'file:///workspace/test.js';
        const sessionStart = 1000000;
        const event = new ReviewSessionStartedEvent({ filePath, sessionStart });
        
        expect(event.filePath).toBe(filePath);
        expect(event.sessionStart).toBe(sessionStart);
        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(event.eventType).toBe('ReviewSessionStartedEvent');
    });

    test('should create event with default occurredAt', () => {
        const before = new Date();
        const event = new ReviewSessionStartedEvent({
            filePath: 'file:///workspace/test.js',
            sessionStart: 1000000
        });
        const after = new Date();
        
        expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should serialize to JSON', () => {
        const filePath = 'file:///workspace/test.js';
        const sessionStart = 1000000;
        const occurredAt = new Date('2024-01-01T00:00:00Z');
        const event = new ReviewSessionStartedEvent({ filePath, sessionStart, occurredAt });
        
        const json = event.toJSON();
        
        expect(json.eventType).toBe('ReviewSessionStartedEvent');
        expect(json.filePath).toBe(filePath);
        expect(json.sessionStart).toBe(sessionStart);
        expect(json.occurredAt).toBe(occurredAt.toISOString());
    });
});

describe('ReviewSessionCompletedEvent', () => {
    test('should create event with required fields', () => {
        const filePath = 'file:///workspace/test.js';
        const sessionStart = 1000000;
        const completedAt = 1045000;
        const reviewTime = 45000;
        const engagementScore = 75;
        const event = new ReviewSessionCompletedEvent({
            filePath,
            sessionStart,
            completedAt,
            reviewTime,
            engagementScore
        });
        
        expect(event.filePath).toBe(filePath);
        expect(event.sessionStart).toBe(sessionStart);
        expect(event.completedAt).toBe(completedAt);
        expect(event.reviewTime).toBe(reviewTime);
        expect(event.engagementScore).toBe(engagementScore);
        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(event.eventType).toBe('ReviewSessionCompletedEvent');
    });

    test('should create event with default occurredAt', () => {
        const before = new Date();
        const event = new ReviewSessionCompletedEvent({
            filePath: 'file:///workspace/test.js',
            sessionStart: 1000000,
            completedAt: 1045000,
            reviewTime: 45000,
            engagementScore: 75
        });
        const after = new Date();
        
        expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should serialize to JSON', () => {
        const filePath = 'file:///workspace/test.js';
        const sessionStart = 1000000;
        const completedAt = 1045000;
        const reviewTime = 45000;
        const engagementScore = 75;
        const occurredAt = new Date('2024-01-01T00:00:00Z');
        const event = new ReviewSessionCompletedEvent({
            filePath,
            sessionStart,
            completedAt,
            reviewTime,
            engagementScore,
            occurredAt
        });
        
        const json = event.toJSON();
        
        expect(json.eventType).toBe('ReviewSessionCompletedEvent');
        expect(json.filePath).toBe(filePath);
        expect(json.sessionStart).toBe(sessionStart);
        expect(json.completedAt).toBe(completedAt);
        expect(json.reviewTime).toBe(reviewTime);
        expect(json.engagementScore).toBe(engagementScore);
        expect(json.occurredAt).toBe(occurredAt.toISOString());
    });
});
