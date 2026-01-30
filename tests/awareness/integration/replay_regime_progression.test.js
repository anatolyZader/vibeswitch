const ScoreService = require('../../../business_modules/awareness/app/scoring/scoreService');
const DebtService = require('../../../business_modules/awareness/app/debt/debtService');
const SuggestionAggregate = require('../../../business_modules/awareness/domain/aggregates/suggestionAggregate');
const ReplayRunner = require('../../helpers/replayRunner');
const { generateRegimeScenarios } = require('../generators/replayEventGenerator');

const BASE_TS = 1000000;

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

describe('Replay regime progression', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(BASE_TS);
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    test('blind_only final blindAcceptance higher than careful_only', () => {
        const regimes = generateRegimeScenarios({ count: 30, startTime: BASE_TS });
        const setSystemTime = (ts) => jest.setSystemTime(ts);
        const s1 = createServices();
        const runner1 = new ReplayRunner(s1.scoreService, s1.debtService, s1.suggestionAggregate);
        runner1.replay(regimes.blind_only, null, { setSystemTime });
        jest.setSystemTime(BASE_TS + 35000);
        const blindFinal = s1.scoreService.calculateScore({ suggestions: s1.suggestionAggregate.getSuggestions(), debtService: s1.debtService });
        const s2 = createServices();
        const runner2 = new ReplayRunner(s2.scoreService, s2.debtService, s2.suggestionAggregate);
        runner2.replay(regimes.careful_only, null, { setSystemTime });
        jest.setSystemTime(BASE_TS + 35000);
        const carefulFinal = s2.scoreService.calculateScore({ suggestions: s2.suggestionAggregate.getSuggestions(), debtService: s2.debtService });
        expect(blindFinal.scores.blindAcceptance).toBeGreaterThan(carefulFinal.scores.blindAcceptance);
    });
    test('mixed regime produces valid progression', () => {
        const regimes = generateRegimeScenarios({ count: 40, startTime: BASE_TS });
        const setSystemTime = (ts) => jest.setSystemTime(ts);
        const services = createServices();
        const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
        const snapshots = runner.replay(regimes.mixed, null, { setSystemTime });
        expect(snapshots.length).toBeGreaterThan(0);
        snapshots.forEach(s => {
            expect(s.score).toBeGreaterThanOrEqual(0);
            expect(s.score).toBeLessThanOrEqual(100);
        });
    });
});
