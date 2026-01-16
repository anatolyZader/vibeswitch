/**
 * Tests for ReviewSession entity
 * 
 * Tests domain entity behavior without external dependencies.
 * Pure unit tests - no IO, no VS Code APIs, no global state.
 */

const ReviewSession = require('../../../../../business_modules/awareness/domain/entities/reviewSession');

describe('ReviewSession Entity', () => {
    let session;
    const testFilePath = 'file:///workspace/test.js';
    const testStartTime = 1000000;

    beforeEach(() => {
        // Reset before each test
    });

    afterEach(() => {
        // Cleanup if needed
    });

    test('should create session with file path and start time', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        
        expect(typeof session.filePath).toBe("string");
        expect(session.sessionStart).toBe(testStartTime);
        expect(session.lastActivity).toBe(testStartTime);
        expect(session.cursorMovements).toBe(0);
        expect(session.scrollEvents).toBe(0);
        expect(session.reviewTime).toBe(0);
        expect(session.isActive).toBe(true);
        expect(session.completedAt).toBeNull();
    });

    test('should create session with default start time', () => {
        const before = Date.now();
        session = new ReviewSession(testFilePath);
        const after = Date.now();
        
        expect(session.sessionStart).toBeGreaterThanOrEqual(before);
        expect(session.sessionStart).toBeLessThanOrEqual(after);
    });

    test('should accept file path string', () => {
        const filePath = testFilePath;
        session = new ReviewSession(filePath, testStartTime);
        
        expect(session.filePath).toBe(filePath);
        expect(typeof session.filePath).toBe("string");
    });

    test('should record cursor movement', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        const before = Date.now();
        
        session.recordCursorMovement();
        
        expect(session.cursorMovements).toBe(1);
        expect(session.lastActivity).toBeGreaterThanOrEqual(before);
        expect(session.lastActivity).toBeLessThanOrEqual(Date.now());
    });

    test('should record scroll event', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        const before = Date.now();
        
        session.recordScrollEvent();
        
        expect(session.scrollEvents).toBe(1);
        expect(session.cursorMovements).toBe(1); // Scroll counts as cursor movement
        expect(session.lastActivity).toBeGreaterThanOrEqual(before);
        expect(session.lastActivity).toBeLessThanOrEqual(Date.now());
    });

    test('should not record activity if session is inactive', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        session.complete();
        const lastActivity = session.lastActivity;
        const movements = session.cursorMovements;
        const scrolls = session.scrollEvents;
        
        session.recordCursorMovement();
        session.recordScrollEvent();
        
        expect(session.lastActivity).toBe(lastActivity);
        expect(session.cursorMovements).toBe(movements);
        expect(session.scrollEvents).toBe(scrolls);
    });

    test('should check sufficient engagement with default thresholds', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        
        // Not enough time or activity
        expect(session.hasSufficientEngagement()).toBe(false);
        
        // Simulate time passing and activity
        const now = testStartTime + 35000; // 35 seconds
        // Mock Date.now() by manipulating session state
        const originalNow = Date.now;
        Date.now = jest.fn(() => now);
        
        // Add enough movements
        for (let i = 0; i < 6; i++) {
            session.recordCursorMovement();
        }
        
        expect(session.hasSufficientEngagement()).toBe(true);
        
        Date.now = originalNow;
    });

    test('should check sufficient engagement with custom thresholds', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        
        // Custom thresholds: 10s, 3 movements, 2 scrolls
        const now = testStartTime + 15000; // 15 seconds
        const originalNow = Date.now;
        Date.now = jest.fn(() => now);
        
        // Add enough movements
        for (let i = 0; i < 4; i++) {
            session.recordCursorMovement();
        }
        
        expect(session.hasSufficientEngagement(10000, 3, 2)).toBe(true);
        
        Date.now = originalNow;
    });

    test('should check timeout with default threshold', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        session.lastActivity = testStartTime;
        
        // Not timed out yet
        const now = testStartTime + 30000; // 30 seconds
        const originalNow = Date.now;
        Date.now = jest.fn(() => now);
        expect(session.hasTimedOut()).toBe(false);
        
        // Timed out
        const later = testStartTime + 70000; // 70 seconds
        Date.now = jest.fn(() => later);
        expect(session.hasTimedOut()).toBe(true);
        
        Date.now = originalNow;
    });

    test('should check timeout with custom threshold', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        session.lastActivity = testStartTime;
        
        const now = testStartTime + 5000; // 5 seconds
        const originalNow = Date.now;
        Date.now = jest.fn(() => now);
        
        expect(session.hasTimedOut(3000)).toBe(true); // 3 second timeout
        expect(session.hasTimedOut(10000)).toBe(false); // 10 second timeout
        
        Date.now = originalNow;
    });

    test('should complete session', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        const completeTime = testStartTime + 45000;
        const originalNow = Date.now;
        Date.now = jest.fn(() => completeTime);
        
        session.complete();
        
        expect(session.isActive).toBe(false);
        expect(session.completedAt).toBe(completeTime);
        expect(session.reviewTime).toBe(45000);
        
        Date.now = originalNow;
    });

    test('should complete session with custom review time', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        const customTime = 60000;
        
        session.complete(customTime);
        
        expect(session.isActive).toBe(false);
        expect(session.reviewTime).toBe(customTime);
    });

    test('should get session duration for active session', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        const now = testStartTime + 25000;
        const originalNow = Date.now;
        Date.now = jest.fn(() => now);
        
        const duration = session.getDuration();
        
        expect(duration).toBe(25000);
        
        Date.now = originalNow;
    });

    test('should get session duration for completed session', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        const reviewTime = 50000;
        const completedAt = testStartTime + reviewTime;
        
        // Mock Date.now() to return the completion time
        const originalNow = Date.now;
        Date.now = jest.fn(() => completedAt);
        
        session.complete(reviewTime);
        
        // getDuration() uses completedAt - sessionStart
        const duration = session.getDuration();
        
        // Should return the reviewTime since completedAt was set to Date.now() which we mocked
        expect(duration).toBe(reviewTime);
        
        Date.now = originalNow;
    });

    test('should get time since last activity', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        session.lastActivity = testStartTime;
        
        const now = testStartTime + 15000;
        const originalNow = Date.now;
        Date.now = jest.fn(() => now);
        
        const timeSince = session.getTimeSinceActivity();
        
        expect(timeSince).toBe(15000);
        
        Date.now = originalNow;
    });

    test('should check if session is for file', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        
        expect(session.isForFile(testFilePath)).toBe(true);
        expect(session.isForFile(testFilePath)).toBe(true);
        expect(session.isForFile('file:///workspace/other.js')).toBe(false);
    });

    test('should calculate engagement score', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        
        // Complete session with good engagement
        const now = testStartTime + 90000; // 90 seconds
        const originalNow = Date.now;
        Date.now = jest.fn(() => now);
        
        for (let i = 0; i < 15; i++) {
            session.recordCursorMovement();
        }
        for (let i = 0; i < 8; i++) {
            session.recordScrollEvent();
        }
        
        session.complete();
        
        const score = session.getEngagementScore();
        
        // Should be high score (duration + movements + scrolls)
        expect(score).toBeGreaterThanOrEqual(50);
        expect(score).toBeLessThanOrEqual(100);
        
        Date.now = originalNow;
    });

    test('should cap engagement score at 100', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        
        const now = testStartTime + 200000; // 200 seconds
        const originalNow = Date.now;
        Date.now = jest.fn(() => now);
        
        for (let i = 0; i < 100; i++) {
            session.recordCursorMovement();
        }
        for (let i = 0; i < 50; i++) {
            session.recordScrollEvent();
        }
        
        session.complete();
        
        const score = session.getEngagementScore();
        
        expect(score).toBe(100);
        
        Date.now = originalNow;
    });

    test('should handle multiple cursor movements', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        
        for (let i = 0; i < 10; i++) {
            session.recordCursorMovement();
        }
        
        expect(session.cursorMovements).toBe(10);
    });

    test('should handle multiple scroll events', () => {
        session = new ReviewSession(testFilePath, testStartTime);
        
        for (let i = 0; i < 5; i++) {
            session.recordScrollEvent();
        }
        
        expect(session.scrollEvents).toBe(5);
        expect(session.cursorMovements).toBe(5); // Each scroll counts as movement
    });
});
