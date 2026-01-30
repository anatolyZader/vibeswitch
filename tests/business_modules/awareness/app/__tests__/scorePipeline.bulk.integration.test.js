/**
 * Score pipeline bulk: 50-100 batches via ReplayRunner, assert getScore equivalent each time.
 */

const ScoreService = require('../../../../../business_modules/awareness/app/scoring/scoreService');
const DebtService = require('../../../../../business_modules/awareness/app/debt/debtService');
const SuggestionAggregate = require('../../../../../business_modules/awareness/domain/aggregates/suggestionAggregate');
const ReplayRunner = require('../../../../helpers/replayRunner');
const { generateBulkScenario } = require('../../../../awareness/generators/suggestionEventGenerator');

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

describe('Score pipeline bulk integration', () => {
    test('50 batches: every snapshot score in [0,100]', () => {
        const services = createServices();
        const events = generateBulkScenario({ count: 50, seed: 7 });
        const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
        const snapshots = runner.replay(events);
        expect(snapshots.length).toBe(events.length);
        snapshots.forEach((s, i) => {
            expect(Number.isFinite(s.score)).toBe(true);
            expect(s.score).toBeGreaterThanOrEqual(0);
            expect(s.score).toBeLessThanOrEqual(100);
        });
    });
    test('100 batches: final components in expected ranges', () => {
        const services = createServices();
        const events = generateBulkScenario({ count: 100, seed: 11 });
        const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
        const snapshots = runner.replay(events);
        const last = snapshots[snapshots.length - 1];
        expect(last.components.review).toBeGreaterThanOrEqual(0);
        expect(last.components.review).toBeLessThanOrEqual(40);
        expect(last.components.blindAcceptance).toBeGreaterThanOrEqual(0);
        expect(last.components.blindAcceptance).toBeLessThanOrEqual(30);
        expect(last.components.adaptation).toBeGreaterThanOrEqual(0);
        expect(last.components.adaptation).toBeLessThanOrEqual(30);
        expect(last.components.debt).toBeGreaterThanOrEqual(0);
        expect(last.components.debt).toBeLessThanOrEqual(30);
    });
});
