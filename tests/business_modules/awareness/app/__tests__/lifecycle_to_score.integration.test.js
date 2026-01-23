/**
 * Integration Tests: Lifecycle → Scoring → Debt Flow
 */

const ScoreService = require('../../../../../business_modules/awareness/app/scoring/scoreService');
const DebtService = require('../../../../../business_modules/awareness/app/debt/debtService');
const SuggestionAggregate = require('../../../../../business_modules/awareness/domain/aggregates/suggestionAggregate');
const mkSuggestion = require('../../../../helpers/mkSuggestion');
const { SCORING_CONSTANTS } = require('../../../../../business_modules/awareness/app/scoring/scoreCalculations');
const { PENDING_MAX_AGE_MS } = SCORING_CONSTANTS;

describe('Lifecycle → Scoring → Debt Integration', () => {
    let scoreService;
    let debtService;
    let suggestionAggregate;
    let mockPersistencePort;
    let mockLogger;
    let mockIdGenerator;

    beforeEach(() => {
        mockLogger = {
            debug: jest.fn(),
            log: jest.fn(),
            error: jest.fn()
        };

        let idCounter = 0;
        mockIdGenerator = {
            generateUUID: jest.fn(() => `test-uuid-${++idCounter}`),
            generateId: jest.fn(() => `test-id-${++idCounter}`)
        };

        mockPersistencePort = {
            loadSync: jest.fn(() => new Map()),
            save: jest.fn(() => Promise.resolve())
        };

        scoreService = new ScoreService(mockLogger);
        debtService = new DebtService(
            () => {},
            null,
            mockPersistencePort,
            mockLogger
        );
        suggestionAggregate = new SuggestionAggregate(mockIdGenerator, mockLogger);
    });

    describe('Suggestion Creation → Score Update Flow', () => {
        test('creating suggestion triggers score update', () => {
            const suggestion = suggestionAggregate.createSuggestion({
                document: 'file:///test.js',
                range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
                text: 'test code',
                size: 100,
                timestamp: Date.now()
            });
            suggestionAggregate.addSuggestion(suggestion);

            const suggestions = suggestionAggregate.getSuggestions();
            const result = scoreService.calculateScore({
                suggestions,
                debtService
            });

            expect(result.scores.debt).toBeGreaterThanOrEqual(0);
            expect(result.currentScore).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Time-based Acceptance', () => {
        test('suggestion with effective review does not count as blind accept', () => {
            const suggestion = suggestionAggregate.createSuggestion({
                document: 'file:///test.js',
                range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
                text: 'test code',
                size: 500, // Larger size for review depth calculation
                timestamp: Date.now()
            });
            suggestionAggregate.addSuggestion(suggestion);
            
            // Mark as reviewed with sufficient time (using aggregate method)
            suggestionAggregate.markSuggestionReviewed(suggestion.id, {
                reviewTimeDeltaMs: 6000 // Above MINIMUM_REVIEW_TIME_MS (5000)
            });
            suggestionAggregate.updateSuggestionStatus(suggestion, 'accepted');

            const suggestions = suggestionAggregate.getSuggestions();
            const result = scoreService.calculateScore({
                suggestions,
                debtService
            });

            // Should have low blind acceptance risk (careful accept, not blind)
            // Formula: 30 * (0.85 * blindRate + 0.15 * carefulAcceptRate)
            // With 100% careful accept: 30 * (0.85 * 0 + 0.15 * 1.0) = 4.5 ≈ 5
            expect(result.scores.blindAcceptance).toBeLessThanOrEqual(5); // Careful accept is mild risk
        });
    });

    describe('End-to-End Scenarios', () => {
        test('S1: Blind accept increases risk score', () => {
            const suggestion = suggestionAggregate.createSuggestion({
                document: 'file:///test.js',
                range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
                text: 'test code',
                size: 100,
                timestamp: Date.now(),
                reviewed: false,
                reviewTime: 0
            });
            suggestionAggregate.addSuggestion(suggestion);
            suggestionAggregate.updateSuggestionStatus(suggestion, 'accepted');

            const suggestions = suggestionAggregate.getSuggestions();
            const result = scoreService.calculateScore({
                suggestions,
                debtService
            });

            expect(result.scores.blindAcceptance).toBeGreaterThan(0);
            expect(result.currentScore).toBeGreaterThan(0);
        });

        test('S2: Careful accept lowers risk vs blind accept', () => {
            // Create aggregate for blind accept scenario
            const blindAggregate = new SuggestionAggregate(mockIdGenerator, mockLogger);
            const blindSuggestion = blindAggregate.createSuggestion({
                document: 'file:///test1.js',
                range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
                text: 'test code',
                size: 100,
                timestamp: Date.now(),
                reviewed: false,
                reviewTime: 0
            });
            blindAggregate.addSuggestion(blindSuggestion);
            blindAggregate.updateSuggestionStatus(blindSuggestion, 'accepted');

            const blindResult = scoreService.calculateScore({
                suggestions: blindAggregate.getSuggestions(),
                debtService
            });

            // Create aggregate for careful accept scenario
            const carefulAggregate = new SuggestionAggregate(mockIdGenerator, mockLogger);
            const carefulSuggestion = carefulAggregate.createSuggestion({
                document: 'file:///test2.js',
                range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
                text: 'test code',
                size: 100,
                timestamp: Date.now()
            });
            carefulAggregate.addSuggestion(carefulSuggestion);
            
            // Mark as reviewed with sufficient time
            carefulAggregate.markSuggestionReviewed(carefulSuggestion.id, {
                reviewTimeDeltaMs: 6000
            });
            carefulAggregate.updateSuggestionStatus(carefulSuggestion, 'accepted');

            const carefulResult = scoreService.calculateScore({
                suggestions: carefulAggregate.getSuggestions(),
                debtService
            });

            // Careful accept should have lower blind acceptance risk
            // Formula: 30 * (0.85 * blindRate + 0.15 * carefulAcceptRate)
            // Blind: 30 * (0.85 * 1.0 + 0.15 * 0) = 25.5 ≈ 26
            // Careful: 30 * (0.85 * 0 + 0.15 * 1.0) = 4.5 ≈ 5
            expect(carefulResult.scores.blindAcceptance).toBeLessThanOrEqual(blindResult.scores.blindAcceptance);
            // Careful accept should have lower overall risk (review score contributes positively)
            expect(carefulResult.currentScore).toBeLessThanOrEqual(blindResult.currentScore);
        });
    });
});
