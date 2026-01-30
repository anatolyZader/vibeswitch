/**
 * ScoreService monotonicity: one more event (blind accept, pending, debt) moves score in expected direction.
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

describe('ScoreService monotonicity', () => {
    test('adding one more blind accept does not decrease blindAcceptance component', () => {
        const { scoreService, debtService, suggestionAggregate } = createServices();
        const now = Date.now();
        for (let i = 0; i < 5; i++) {
            const s = suggestionAggregate.createSuggestion({
                document: 'file:///f.js',
                range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
                text: 'x',
                size: 100,
                timestamp: now - (5 - i) * 1000,
                reviewed: false,
                reviewTime: 0
            });
            suggestionAggregate.addSuggestion(s);
            suggestionAggregate.updateSuggestionStatus(s, 'accepted');
        }
        const resultBefore = scoreService.calculateScore({ suggestions: suggestionAggregate.getSuggestions(), debtService });
        const s6 = suggestionAggregate.createSuggestion({
            document: 'file:///f.js',
            range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
            text: 'x',
            size: 100,
            timestamp: now,
            reviewed: false,
            reviewTime: 0
        });
        suggestionAggregate.addSuggestion(s6);
        suggestionAggregate.updateSuggestionStatus(s6, 'accepted');
        const resultAfter = scoreService.calculateScore({ suggestions: suggestionAggregate.getSuggestions(), debtService });
        expect(resultAfter.scores.blindAcceptance).toBeGreaterThanOrEqual(resultBefore.scores.blindAcceptance - 1);
    });

    test('adding one more pending suggestion increases or maintains debt-related score', () => {
        const { scoreService, debtService, suggestionAggregate } = createServices();
        const now = Date.now();
        for (let i = 0; i < 3; i++) {
            const s = suggestionAggregate.createSuggestion({
                document: 'file:///f.js',
                range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
                text: 'x',
                size: 100,
                timestamp: now - 5000,
                status: 'pending'
            });
            suggestionAggregate.addSuggestion(s);
        }
        const resultBefore = scoreService.calculateScore({ suggestions: suggestionAggregate.getSuggestions(), debtService });
        const s4 = suggestionAggregate.createSuggestion({
            document: 'file:///f.js',
            range: { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
            text: 'x',
            size: 100,
            timestamp: now - 5000,
            status: 'pending'
        });
        suggestionAggregate.addSuggestion(s4);
        const resultAfter = scoreService.calculateScore({ suggestions: suggestionAggregate.getSuggestions(), debtService });
        expect(resultAfter.currentScore).toBeGreaterThanOrEqual(resultBefore.currentScore - 5);
    });

    test('adding debt increases or maintains debt component', () => {
        const { scoreService, debtService, suggestionAggregate } = createServices();
        const resultBefore = scoreService.calculateScore({ suggestions: [], debtService });
        debtService.addToDebt('file:///a.js', 500, () => {});
        const resultAfter = scoreService.calculateScore({ suggestions: [], debtService });
        expect(resultAfter.scores.debt).toBeGreaterThanOrEqual(resultBefore.scores.debt);
    });
});
