'use strict';

const ScoreService = require('../../../business_modules/awareness/app/scoring/scoreService');
const DebtService = require('../../../business_modules/awareness/app/debt/debtService');
const SuggestionAggregate = require('../../../business_modules/awareness/domain/aggregates/suggestionAggregate');
const ReplayRunner = require('../../helpers/replayRunner');
const { scenarios, baseTs } = require('../golden/goldenScenarios');

function createInMemoryPersistence() {
    const store = {};
    return {
        loadSync(key) { return store[key]; },
        save(key, value) { store[key] = value; return Promise.resolve(); }
    };
}

function createServices(persistence) {
    const mockLogger = { debug: jest.fn(), log: jest.fn(), error: jest.fn() };
    let idCounter = 0;
    const mockIdGenerator = { generateUUID: jest.fn(() => 'u-' + (++idCounter)), generateId: jest.fn(() => 'i-' + (++idCounter)) };
    const scoreService = new ScoreService(mockLogger);
    const debtService = new DebtService(() => {}, null, persistence, mockLogger);
    const suggestionAggregate = new SuggestionAggregate(mockIdGenerator, mockLogger);
    return { scoreService, debtService, suggestionAggregate };
}

const TOLERANCE = 1;
function scoresEqual(a, b) {
    if (Math.abs(a.currentScore - b.currentScore) > TOLERANCE) return false;
    for (const k of ['review', 'blindAcceptance', 'adaptation', 'debt']) {
        if (Math.abs((a.scores[k] || 0) - (b.scores[k] || 0)) > TOLERANCE) return false;
    }
    return true;
}

describe('Persistence serialize reload', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(baseTs); });
    afterEach(() => { jest.useRealTimers(); });

    test('replay serialize load same score', async () => {
        const scenario = scenarios.find((s) => s.name === 'slow_careful_review_then_accept') || scenarios[2];
        const events = scenario.events;
        const persistence = createInMemoryPersistence();
        const services = createServices(persistence);
        const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
        runner.replay(events, null, { setSystemTime: (ts) => jest.setSystemTime(ts) });
        const suggestions = services.suggestionAggregate.getSuggestions();
        const freshScoreBefore = new ScoreService({ debug: jest.fn(), log: jest.fn(), error: jest.fn() });
        const resultBefore = freshScoreBefore.calculateScore({ suggestions, debtService: services.debtService });
        const suggestionsPlain = suggestions.map((s) => s.toPlainObject());
        await services.debtService.saveDebt();
        await persistence.save('test_suggestions', suggestionsPlain);
        const newServices = createServices(persistence);
        newServices.debtService.loadDebt();
        newServices.suggestionAggregate.loadFromPlainArray(persistence.loadSync('test_suggestions') || []);
        const resultAfter = newServices.scoreService.calculateScore({
            suggestions: newServices.suggestionAggregate.getSuggestions(),
            debtService: newServices.debtService
        });
        expect(scoresEqual(resultBefore, resultAfter)).toBe(true);
        expect(Number.isFinite(resultAfter.currentScore)).toBe(true);
    });

    test('blind_accept serialize reload same score', async () => {
        const scenario = scenarios.find((s) => s.name === 'blind_accept_core_file') || scenarios[1];
        const events = scenario.events;
        const persistence = createInMemoryPersistence();
        const services = createServices(persistence);
        const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
        runner.replay(events, null, { setSystemTime: (ts) => jest.setSystemTime(ts) });
        const suggestions = services.suggestionAggregate.getSuggestions();
        const freshScoreBefore = new ScoreService({ debug: jest.fn(), log: jest.fn(), error: jest.fn() });
        const resultBefore = freshScoreBefore.calculateScore({ suggestions, debtService: services.debtService });
        const suggestionsPlain = suggestions.map((s) => s.toPlainObject());
        await services.debtService.saveDebt();
        await persistence.save('test_suggestions', suggestionsPlain);
        const newServices = createServices(persistence);
        newServices.debtService.loadDebt();
        newServices.suggestionAggregate.loadFromPlainArray(persistence.loadSync('test_suggestions') || []);
        const resultAfter = newServices.scoreService.calculateScore({
            suggestions: newServices.suggestionAggregate.getSuggestions(),
            debtService: newServices.debtService
        });
        expect(scoresEqual(resultBefore, resultAfter)).toBe(true);
    });
});
