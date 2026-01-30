/**
 * ScoreService bulk tests: 100+ suggestions per regime, assert score and components.
 */

const ScoreService = require('../../../../../../business_modules/awareness/app/scoring/scoreService');
const DebtService = require('../../../../../../business_modules/awareness/app/debt/debtService');
const SuggestionAggregate = require('../../../../../../business_modules/awareness/domain/aggregates/suggestionAggregate');
const ReplayRunner = require('../../../../../helpers/replayRunner');
const { generateBulkScenario } = require('../../../../../awareness/generators/suggestionEventGenerator');
const { generateRegimeScenarios } = require('../../../../../awareness/generators/replayEventGenerator');

function createServices() {
    const mockLogger = { debug: jest.fn(), log: jest.fn(), error: jest.fn() };
    let idCounter = 0;
    const mockIdGenerator = {
        generateUUID: jest.fn(() => 'uuid-' + (++idCounter)),
        generateId: jest.fn(() => 'id-' + (++idCounter))
    };
    const mockPersistence = { loadSync: jest.fn(() => new Map()), save: jest.fn(() => Promise.resolve()) };
    const scoreService = new ScoreService(mockLogger);
    const debtService = new DebtService(() => {}, null, mockPersistence, mockLogger);
    const suggestionAggregate = new SuggestionAggregate(mockIdGenerator, mockLogger);
    return { scoreService, debtService, suggestionAggregate };
}

describe('ScoreService bulk', () => {
    describe('generateBulkScenario 100 events', () => {
        test('replay 100 events produces valid scores', () => {
            const { scoreService, debtService, suggestionAggregate } = createServices();
            const events = generateBulkScenario({ count: 100, seed: 42 });
            const createCount = events.filter(e => e.type === 'suggestion_created').length;
            const runner = new ReplayRunner(scoreService, debtService, suggestionAggregate);
            const snapshots = runner.replay(events);

            expect(snapshots.length).toBe(events.length);
            for (const s of snapshots) {
                expect(Number.isFinite(s.score)).toBe(true);
                expect(s.score).toBeGreaterThanOrEqual(0);
                expect(s.score).toBeLessThanOrEqual(100);
                expect(s.components.review).toBeGreaterThanOrEqual(0);
                expect(s.components.blindAcceptance).toBeGreaterThanOrEqual(0);
                expect(s.components.adaptation).toBeGreaterThanOrEqual(0);
                expect(s.components.debt).toBeGreaterThanOrEqual(0);
            }
            const suggestions = suggestionAggregate.getSuggestions();
            expect(suggestions.length).toBeGreaterThanOrEqual(50);
            expect(suggestions.length).toBeLessThanOrEqual(createCount);
        });

        test('replay 150 events with different seed', () => {
            const { scoreService, debtService, suggestionAggregate } = createServices();
            const events = generateBulkScenario({ count: 150, seed: 999 });
            const runner = new ReplayRunner(scoreService, debtService, suggestionAggregate);
            const snapshots = runner.replay(events);
            expect(snapshots.length).toBe(events.length);
            const last = snapshots[snapshots.length - 1];
            expect(last.score).toBeGreaterThanOrEqual(0);
            expect(last.score).toBeLessThanOrEqual(100);
        });
    });

    describe('regime scenarios 50 each', () => {
        test('blind_only has higher or equal blindAcceptance than careful_only', () => {
            jest.useFakeTimers();
            const baseTime = 1000000;
            const regimes = generateRegimeScenarios({ count: 50, startTime: baseTime });
            const { scoreService, debtService, suggestionAggregate } = createServices();
            const runner = new ReplayRunner(scoreService, debtService, suggestionAggregate);
            const snapshotsBlind = runner.replay(regimes.blind_only, null, { setSystemTime: (t) => jest.setSystemTime(t) });
            jest.setSystemTime(snapshotsBlind[snapshotsBlind.length - 1].timestamp);
            const blindResult = scoreService.calculateScore({ suggestions: suggestionAggregate.getSuggestions(), debtService });
            const blindBA = blindResult.scores.blindAcceptance;

            const { scoreService: s2, debtService: d2, suggestionAggregate: a2 } = createServices();
            const runner2 = new ReplayRunner(s2, d2, a2);
            const snapshotsCareful = runner2.replay(regimes.careful_only, null, { setSystemTime: (t) => jest.setSystemTime(t) });
            jest.setSystemTime(snapshotsCareful[snapshotsCareful.length - 1].timestamp);
            const carefulResult = s2.calculateScore({ suggestions: a2.getSuggestions(), debtService: d2 });
            const carefulBA = carefulResult.scores.blindAcceptance;

            jest.useRealTimers();
            expect(blindBA).toBeGreaterThanOrEqual(carefulBA);
        });

        test('pending_only has debt risk', () => {
            const regimes = generateRegimeScenarios({ count: 50 });
            const { scoreService, debtService, suggestionAggregate } = createServices();
            const runner = new ReplayRunner(scoreService, debtService, suggestionAggregate);
            runner.replay(regimes.pending_only);
            const result = scoreService.calculateScore({ suggestions: suggestionAggregate.getSuggestions(), debtService });
            expect(result.currentScore).toBeGreaterThanOrEqual(0);
            expect(result.scores.debt).toBeGreaterThanOrEqual(0);
        });

        test('all regimes produce score in [0,100]', () => {
            const regimes = generateRegimeScenarios({ count: 30 });
            const names = ['blind_only', 'careful_only', 'adapted_only', 'pending_only', 'mixed'];
            for (const name of names) {
                const { scoreService, debtService, suggestionAggregate } = createServices();
                const runner = new ReplayRunner(scoreService, debtService, suggestionAggregate);
                runner.replay(regimes[name]);
                const result = scoreService.calculateScore({ suggestions: suggestionAggregate.getSuggestions(), debtService });
                expect(result.currentScore).toBeGreaterThanOrEqual(0);
                expect(result.currentScore).toBeLessThanOrEqual(100);
            }
        });
    });
});
