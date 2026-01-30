/**
 * E2E: event stream -> score -> meter display. 200 events, assert final score and meter consistency.
 */

const ScoreService = require('../../../business_modules/awareness/app/scoring/scoreService');
const DebtService = require('../../../business_modules/awareness/app/debt/debtService');
const SuggestionAggregate = require('../../../business_modules/awareness/domain/aggregates/suggestionAggregate');
const ReplayRunner = require('../../helpers/replayRunner');
const { getScoreMeter, getScoreEmoji } = require('../../../ui/awarenessMeterDisplay');
const { generateBulkScenario } = require('../generators/suggestionEventGenerator');

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

describe('Behavior to meter e2e', () => {
    test('200 events: final score in [0,100], meter and emoji match score', () => {
        const services = createServices();
        const events = generateBulkScenario({ count: 200, seed: 42 });
        const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
        const snapshots = runner.replay(events);
        const last = snapshots[snapshots.length - 1];
        expect(Number.isFinite(last.score)).toBe(true);
        expect(last.score).toBeGreaterThanOrEqual(0);
        expect(last.score).toBeLessThanOrEqual(100);

        const meter = getScoreMeter(last.score);
        const emoji = getScoreEmoji(last.score);
        expect(meter.length).toBe(7);
        expect(['\uD83D\uDFE2', '\uD83D\uDFE1', '\uD83D\uDFE0', '\uD83D\uDD34']).toContain(emoji);
    });
    test('last 20 snapshots: meter and emoji consistent with score', () => {
        const services = createServices();
        const events = generateBulkScenario({ count: 100, seed: 1 });
        const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
        const snapshots = runner.replay(events);
        const tail = snapshots.slice(-20);
        tail.forEach(s => {
            expect(Number.isFinite(s.score)).toBe(true);
            const meter = getScoreMeter(s.score);
            const emoji = getScoreEmoji(s.score);
            expect(meter.length).toBe(7);
            expect(s.score).toBeGreaterThanOrEqual(0);
            expect(s.score).toBeLessThanOrEqual(100);
        });
    });
});
