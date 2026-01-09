/**
 * Tests for SessionTracker with ReviewSession integration
 * 
 * Tests that SessionTracker correctly uses ReviewSession entities.
 */

const { assert } = require('chai');
const SessionTracker = require('../../../../../business_modules/awareness/domain/entities/sessionTracker');
const ReviewSession = require('../../../../../business_modules/awareness/domain/entities/reviewSession');

describe('SessionTracker with ReviewSession', () => {
    let sessionTracker;
    let mockDebtManager;
    let mockAgentSuggestionHandler;
    let mockMessagingAdapter;
    const testFilePath = 'file:///workspace/test.js';

    beforeEach(() => {
        mockDebtManager = {
            hasUnreviewedDebt: () => false,
            getDebt: () => null,
            updateSession: () => {},
            markAsReviewed: () => {}
        };
        
        mockAgentSuggestionHandler = {
            getPendingSuggestionsForFile: () => []
        };
        
        mockMessagingAdapter = {
            publishReviewSessionStartedEvent: async () => {},
            publishReviewSessionCompletedEvent: async () => {}
        };
        
        sessionTracker = new SessionTracker(
            mockDebtManager,
            mockAgentSuggestionHandler,
            () => {}, // onDebtCleared
            () => {}, // updateScore
            null, // updateFileColorsInExplorer
            mockMessagingAdapter
        );
    });

    afterEach(() => {
        if (sessionTracker) {
            sessionTracker.clear();
        }
    });

    test('should create ReviewSession when initializing session', () => {
        const session = sessionTracker.initializeSession(testFilePath);
        
        expect(session, ReviewSession);
        expect(sessionTracker.isTracking(testFilePath));
    });

    test('should return existing session if already tracking', () => {
        const session1 = sessionTracker.initializeSession(testFilePath);
        const session2 = sessionTracker.initializeSession(testFilePath);
        
        expect(session1, session2);
    });

    test('should update cursor activity on ReviewSession', () => {
        sessionTracker.initializeSession(testFilePath);
        const session = sessionTracker.getSession(testFilePath);
        const initialMovements = session.cursorMovements;
        
        sessionTracker.updateCursorActivity(testFilePath);
        
        expect(session.cursorMovements, initialMovements + 1);
    });

    test('should update scroll activity on ReviewSession', () => {
        sessionTracker.initializeSession(testFilePath);
        const session = sessionTracker.getSession(testFilePath);
        const initialScrolls = session.scrollEvents;
        const initialMovements = session.cursorMovements;
        
        sessionTracker.updateScrollActivity(testFilePath);
        
        expect(session.scrollEvents, initialScrolls + 1);
        expect(session.cursorMovements, initialMovements + 1); // Scroll counts as movement
    });

    test('should get session for file', () => {
        sessionTracker.initializeSession(testFilePath);
        const session = sessionTracker.getSession(testFilePath);
        
        expect(session, ReviewSession);
        expect(session.filePath.toString(), testFilePath);
    });

    test('should return null for non-tracked file', () => {
        const session = sessionTracker.getSession('file:///workspace/other.js');
        
        expect(session);
    });

    test('should get all active sessions', () => {
        sessionTracker.initializeSession('file:///workspace/test1.js');
        sessionTracker.initializeSession('file:///workspace/test2.js');
        sessionTracker.initializeSession('file:///workspace/test3.js');
        
        const sessions = sessionTracker.getAllSessions();
        
        expect(sessions.length, 3);
        sessions.forEach(session => {
            expect(session, ReviewSession);
        });
    });

    test('should complete session when sufficient engagement', () => {
        const originalNow = Date.now;
        const startTime = 1000000;
        Date.now = () => startTime;
        
        sessionTracker.initializeSession(testFilePath);
        const session = sessionTracker.getSession(testFilePath);
        
        // Simulate time passing and activity
        Date.now = () => startTime + 35000; // 35 seconds
        
        // Add enough movements
        for (let i = 0; i < 6; i++) {
            sessionTracker.updateCursorActivity(testFilePath);
        }
        
        // Mock debt manager to return debt
        mockDebtManager.hasUnreviewedDebt = () => true;
        mockDebtManager.getDebt = () => ({
            totalChanges: 100,
            totalReviewTime: 0,
            modificationCount: 0
        });
        
        sessionTracker.checkProgress();
        
        // Session should be completed
        expect(session.isActive);
        expect(session.completedAt);
        
        Date.now = originalNow;
    });

    test('should remove session when no debt and no pending suggestions', () => {
        sessionTracker.initializeSession(testFilePath);
        expect(sessionTracker.isTracking(testFilePath));
        
        mockDebtManager.hasUnreviewedDebt = () => false;
        mockAgentSuggestionHandler.getPendingSuggestionsForFile = () => [];
        
        sessionTracker.checkProgress();
        
        expect(sessionTracker.isTracking(testFilePath));
    });

    test('should publish ReviewSessionStartedEvent when session starts', async () => {
        let publishedEvent = null;
        mockMessagingAdapter.publishReviewSessionStartedEvent = async (event) => {
            publishedEvent = event;
        };
        
        sessionTracker.initializeSession(testFilePath);
        
        // Wait a bit for async event publishing
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(publishedEvent);
        expect(publishedEvent.filePath, testFilePath);
        expect(publishedEvent.eventType, 'ReviewSessionStartedEvent');
    });

    test('should publish ReviewSessionCompletedEvent when session completes', async () => {
        const originalNow = Date.now;
        const startTime = 1000000;
        Date.now = () => startTime;
        
        let publishedEvent = null;
        mockMessagingAdapter.publishReviewSessionCompletedEvent = async (event) => {
            publishedEvent = event;
        };
        
        sessionTracker.initializeSession(testFilePath);
        const session = sessionTracker.getSession(testFilePath);
        
        // Simulate sufficient engagement
        Date.now = () => startTime + 35000;
        for (let i = 0; i < 6; i++) {
            sessionTracker.updateCursorActivity(testFilePath);
        }
        
        mockDebtManager.hasUnreviewedDebt = () => true;
        mockDebtManager.getDebt = () => ({
            totalChanges: 100,
            totalReviewTime: 0,
            modificationCount: 0
        });
        
        sessionTracker.checkProgress();
        
        // Wait for async event publishing
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(publishedEvent);
        expect(publishedEvent.eventType, 'ReviewSessionCompletedEvent');
        expect(publishedEvent.filePath, testFilePath);
        expect(isNumber(publishedEvent.engagementScore);
        
        Date.now = originalNow;
    });

    test('should handle messaging adapter errors gracefully', async () => {
        mockMessagingAdapter.publishReviewSessionStartedEvent = async () => {
            throw new Error('Publishing failed');
        };
        
        // Should not throw
        expect(doesNotThrow(() => {
            sessionTracker.initializeSession(testFilePath);
        });
    });

    test('should get tracking data in legacy format', () => {
        sessionTracker.initializeSession(testFilePath);
        sessionTracker.updateCursorActivity(testFilePath);
        sessionTracker.updateScrollActivity(testFilePath);
        
        const tracking = sessionTracker.getTracking(testFilePath);
        
        expect(isObject(tracking);
        expect(isNumber(tracking.sessionStart);
        expect(isNumber(tracking.lastActivity);
        expect(isNumber(tracking.cursorMovements);
        expect(isNumber(tracking.scrollEvents);
    });

    test('should clear all sessions', () => {
        sessionTracker.initializeSession('file:///workspace/test1.js');
        sessionTracker.initializeSession('file:///workspace/test2.js');
        
        expect(sessionTracker.getActiveSessionCount(), 2);
        
        sessionTracker.clear();
        
        expect(sessionTracker.getActiveSessionCount(), 0);
    });
});
