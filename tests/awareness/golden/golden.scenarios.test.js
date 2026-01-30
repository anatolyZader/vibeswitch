'use strict';

const ScoreService = require('../../../business_modules/awareness/app/scoring/scoreService');
const DebtService = require('../../../business_modules/awareness/app/debt/debtService');
const SuggestionAggregate = require('../../../business_modules/awareness/domain/aggregates/suggestionAggregate');
const ReplayRunner = require('../../helpers/replayRunner');
const { getScoreMeter, getScoreEmoji, mapDomainStateToViewModel } = require('../../../ui/awarenessMeterDisplay');
const { scenarios, baseTs } = require('./goldenScenarios');

const CORE_SCENARIOS_FOR_BREAKDOWN = [
    'empty_trace', 'blind_accept_core_file', 'slow_careful_review_then_accept', 'reject_without_review',
    'pending_only', 'two_blind_accepts', 'two_careful_reviews', 'all_rejected', 'all_adapted', 'find_issues_then_reject'
];

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

function assertInRange(value, range, label) {
    const [min, max] = Array.isArray(range) ? range : [range, range];
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
}

function assertScoreComponent(actual, expected, key) {
    if (expected[key] === undefined) return;
    const range = expected[key];
    assertInRange(actual[key], range, key);
}

const TOLERANCE = 1;

function assertExact(actual, exactExpected, label) {
    if (typeof exactExpected !== 'number') return;
    expect(actual).toBeGreaterThanOrEqual(exactExpected - TOLERANCE);
    expect(actual).toBeLessThanOrEqual(exactExpected + TOLERANCE);
}

describe('Golden behavior scenarios', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(baseTs);
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    test.each(scenarios.map((s) => [s.name, s]))('%s', (name, scenario) => {
        const { events, expected } = scenario;
        const services = createServices();
        const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
        const setSystemTime = (ts) => jest.setSystemTime(ts);
        runner.replay(events, null, { setSystemTime });

        const suggestions = services.suggestionAggregate.getSuggestions();
        const result = services.scoreService.calculateScore({
            suggestions,
            debtService: services.debtService
        });

        if (expected.exact) {
            assertExact(result.currentScore, expected.exact.totalScore, 'totalScore');
            if (expected.exact.scores) {
                assertExact(result.scores.review, expected.exact.scores.review, 'review');
                assertExact(result.scores.blindAcceptance, expected.exact.scores.blindAcceptance, 'blindAcceptance');
                assertExact(result.scores.adaptation, expected.exact.scores.adaptation, 'adaptation');
                assertExact(result.scores.debt, expected.exact.scores.debt, 'debt');
            }
        } else {
            assertInRange(result.currentScore, expected.totalScoreRange, 'totalScore');
        }

        if (expected.scores && !expected.exact) {
            if (expected.scores.review !== undefined) assertScoreComponent(result.scores, expected.scores, 'review');
            if (expected.scores.blindAcceptance !== undefined) assertScoreComponent(result.scores, expected.scores, 'blindAcceptance');
            if (expected.scores.adaptation !== undefined) assertScoreComponent(result.scores, expected.scores, 'adaptation');
            if (expected.scores.debt !== undefined) assertScoreComponent(result.scores, expected.scores, 'debt');
        }

        const meterStr = getScoreMeter(result.currentScore);
        const emojiStr = getScoreEmoji(result.currentScore);

        if (typeof expected.meterSegments === 'string') {
            expect(meterStr).toBe(expected.meterSegments);
        } else if (Array.isArray(expected.meterSegments)) {
            const filled = (meterStr.match(/▰/g) || []).length;
            expect(filled).toBeGreaterThanOrEqual(expected.meterSegments[0]);
            expect(filled).toBeLessThanOrEqual(expected.meterSegments[1]);
        }

        if (expected.meterEmoji) {
            expect(emojiStr).toBe(expected.meterEmoji);
        }

        expect(Number.isFinite(result.currentScore)).toBe(true);
        expect(result.scores.review).toBeGreaterThanOrEqual(0);
        expect(result.scores.blindAcceptance).toBeGreaterThanOrEqual(0);
        expect(result.scores.adaptation).toBeGreaterThanOrEqual(0);
        expect(result.scores.debt).toBeGreaterThanOrEqual(0);
    });

    describe('Exact golden (dump helper)', () => {
        test('dump exact expected for CORE scenarios when DUMP_EXACT_GOLDEN=1', () => {
            if (process.env.DUMP_EXACT_GOLDEN !== '1') return;
            const out = [];
            for (const name of CORE_SCENARIOS_FOR_BREAKDOWN) {
                const scenario = scenarios.find((s) => s.name === name);
                if (!scenario) continue;
                const services = createServices();
                const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
                const setSystemTime = (ts) => jest.setSystemTime(ts);
                runner.replay(scenario.events, null, { setSystemTime });
                const suggestions = services.suggestionAggregate.getSuggestions();
                const result = services.scoreService.calculateScore({ suggestions, debtService: services.debtService });
                out.push({ name, exact: { totalScore: result.currentScore, scores: { ...result.scores } } });
            }
            console.log(JSON.stringify(out, null, 2));
        });
    });

    describe('Breakdown snapshots (10 core scenarios)', () => {
        test.each(CORE_SCENARIOS_FOR_BREAKDOWN.map((name) => [name]))('%s has consistent breakdown', (name) => {
            const scenario = scenarios.find((s) => s.name === name);
            expect(scenario).toBeDefined();
            const services = createServices();
            const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
            const setSystemTime = (ts) => jest.setSystemTime(ts);
            runner.replay(scenario.events, null, { setSystemTime });
            const suggestions = services.suggestionAggregate.getSuggestions();
            const breakdown = services.scoreService.getScoreBreakdown({
                suggestions,
                debtService: services.debtService
            });
            expect(breakdown).toBeDefined();
            expect(breakdown.counts).toBeDefined();
            expect(typeof breakdown.counts.total).toBe('number');
            expect(breakdown.counts.total).toBe(suggestions.length);
            expect(breakdown.counts.pending + breakdown.counts.completed).toBe(suggestions.length);
            expect(Array.isArray(breakdown.topFactors)).toBe(true);
            expect(breakdown.contributions).toBeDefined();
            expect(typeof breakdown.contributions.review).toBe('number');
            expect(typeof breakdown.contributions.blindAcceptance).toBe('number');
            expect(typeof breakdown.contributions.adaptation).toBe('number');
            expect(typeof breakdown.contributions.debt).toBe('number');
            const result = services.scoreService.calculateScore({ suggestions, debtService: services.debtService });
            const viewModel = mapDomainStateToViewModel(
                { total: result.currentScore, components: result.scores, suggestions: { total: suggestions.length, pending: breakdown.counts.pending }, debt: { unreviewedFiles: 0 }, debug: {} },
                'dev'
            );
            expect(viewModel.segments.length).toBe(7);
            expect(['\u25B0', '\u25B1'].some((c) => viewModel.segments.includes(c))).toBe(true);
        });
    });
});
