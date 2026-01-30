/**
 * ScoreService bounds: empty state, huge pending, score always in [0,100].
 */

const ScoreService = require('../../../../../../business_modules/awareness/app/scoring/scoreService');
const DebtService = require('../../../../../../business_modules/awareness/app/debt/debtService');
const SuggestionAggregate = require('../../../../../../business_modules/awareness/domain/aggregates/suggestionAggregate');
const mkSuggestion = require('../../../../../helpers/mkSuggestion');

function createServices() {
    const mockLogger = { debug: jest.fn(), log: jest.fn(), error: jest.fn() };
    let idCounter = 0;
    const mockIdGenerator = { generateUUID: jest.fn(() => 'u-' + (++idCounter)), generateId: jest.fn(() => 'i-' + (++idCounter)) };
    const mockPersistence = { loadSync: jest.fn(() => new Map()), save: jest.fn(() => Promise.resolve()) };
    const scoreService = new ScoreService(mockLogger);
    const debtService = new DebtService(() => {}, null, mockPersistence, mockLogger);
    const suggestionAggregate = new SuggestionAggregate(mockIdGenerator, mockLogger);
    return { scoreService, debtService, suggestionAggregate };
}

describe('ScoreService bounds', () => {
    test('empty suggestions and no debt produces score in [0,100]', () => {
        const { scoreService, debtService } = createServices();
        const result = scoreService.calculateScore({ suggestions: [], debtService });
        expect(Number.isFinite(result.currentScore)).toBe(true);
        expect(result.currentScore).toBeGreaterThanOrEqual(0);
        expect(result.currentScore).toBeLessThanOrEqual(100);
    });

    test('many pending suggestions (50) produces capped score', () => {
        const { scoreService, debtService, suggestionAggregate } = createServices();
        const now = Date.now();
        for (let i = 0; i < 50; i++) {
            const s = suggestionAggregate.createSuggestion({
                document: 'file:///f.js',
                range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
                text: 'x',
                size: 100,
                timestamp: now - 20000,
                status: 'pending'
            });
            suggestionAggregate.addSuggestion(s);
        }
        const result = scoreService.calculateScore({ suggestions: suggestionAggregate.getSuggestions(), debtService });
        expect(result.currentScore).toBeLessThanOrEqual(100);
        expect(Number.isFinite(result.currentScore)).toBe(true);
    });

    test('no NaN or Infinity in components', () => {
        const { scoreService, debtService, suggestionAggregate } = createServices();
        const now = Date.now();
        const s = suggestionAggregate.createSuggestion({
            document: 'file:///f.js',
            range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
            text: 'x',
            size: 100,
            timestamp: now,
            status: 'accepted',
            reviewed: true,
            reviewTime: 6000
        });
        suggestionAggregate.addSuggestion(s);
        const result = scoreService.calculateScore({ suggestions: suggestionAggregate.getSuggestions(), debtService });
        expect(Number.isFinite(result.currentScore)).toBe(true);
        expect(Number.isFinite(result.scores.review)).toBe(true);
        expect(Number.isFinite(result.scores.blindAcceptance)).toBe(true);
        expect(Number.isFinite(result.scores.adaptation)).toBe(true);
        expect(Number.isFinite(result.scores.debt)).toBe(true);
    });
});
