const ScoreService = require('../../../business_modules/awareness/app/scoring/scoreService');
const DebtService = require('../../../business_modules/awareness/app/debt/debtService');
const SuggestionAggregate = require('../../../business_modules/awareness/domain/aggregates/suggestionAggregate');
const ReplayRunner = require('../../helpers/replayRunner');
const { generateBulkScenario } = require('../generators/suggestionEventGenerator');
const { generateRandomReplay } = require('../generators/replayEventGenerator');

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

describe('Replay bulk integration', () => {
    test('200 events: all snapshots valid', () => {
        const services = createServices();
        const events = generateBulkScenario({ count: 200, seed: 1 });
        const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
        const snapshots = runner.replay(events);
        expect(snapshots.length).toBe(events.length);
        snapshots.forEach(s => {
            expect(Number.isFinite(s.score)).toBe(true);
            expect(s.score).toBeGreaterThanOrEqual(0);
            expect(s.score).toBeLessThanOrEqual(100);
        });
    });
    test('500 events: final score in [0,100]', () => {
        const services = createServices();
        const events = generateRandomReplay({ eventCount: 500, seed: 999 });
        const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
        const snapshots = runner.replay(events);
        const last = snapshots[snapshots.length - 1];
        expect(Number.isFinite(last.score)).toBe(true);
        expect(last.score).toBeGreaterThanOrEqual(0);
        expect(last.score).toBeLessThanOrEqual(100);
    });
});
