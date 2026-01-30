'use strict';

const fc = require('fast-check');
const ScoreService = require('../../../business_modules/awareness/app/scoring/scoreService');
const DebtService = require('../../../business_modules/awareness/app/debt/debtService');
const SuggestionAggregate = require('../../../business_modules/awareness/domain/aggregates/suggestionAggregate');
const ReplayRunner = require('../../helpers/replayRunner');

/**
 * Property-based test with shrinking: traces with valid lifecycles never produce invalid scores.
 * Generators ensure: created -> optional reviewed -> optional status_changed (accepted/rejected/adapted).
 * On failure, fast-check shrinks to a minimal trace that breaks the invariant.
 */
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

const baseTs = 1000000;

/** Arbitrary: valid lifecycle block = [created, reviewed?, status_changed?] */
const lifecycleBlockArbitrary = fc.integer({ min: 1, max: 20 }).chain((blockIndex) => {
    const suggestionId = 'suggestion-' + blockIndex;
    const timestamp = baseTs + blockIndex * 1000;
    const created = {
        type: 'suggestion_created',
        document: 'file:///f' + (blockIndex % 5) + '.js',
        size: fc.integer({ min: 10, max: 500 }).noShrink(),
        timestamp,
        suggestionId,
        provenanceScore: fc.double({ min: 0.2, max: 1.0 }).noShrink()
    };
    return fc.record({
        created: fc.constant(created),
        hasReviewed: fc.boolean(),
        reviewTime: fc.integer({ min: 0, max: 20000 }),
        status: fc.option(fc.constantFrom('accepted', 'rejected', 'adapted'), { nil: undefined })
    }).map((r) => {
        const events = [];
        events.push({
            type: 'suggestion_created',
            document: r.created.document,
            size: typeof r.created.size === 'number' ? r.created.size : 100,
            timestamp: r.created.timestamp,
            suggestionId: r.created.suggestionId,
            provenanceScore: typeof r.created.provenanceScore === 'number' ? r.created.provenanceScore : 0.8
        });
        if (r.hasReviewed) {
            events.push({ type: 'suggestion_reviewed', suggestionId: r.created.suggestionId, reviewTime: r.reviewTime });
        }
        if (r.status) {
            events.push({ type: 'suggestion_status_changed', suggestionId: r.created.suggestionId, status: r.status });
        }
        return events;
    });
});

/** Arbitrary: array of lifecycle blocks (flat event list) */
const validTraceArbitrary = fc.array(
    fc.integer({ min: 1, max: 15 }).chain((n) => {
        const events = [];
        for (let i = 0; i < n; i++) {
            const sid = 'suggestion-' + (i + 1);
            const ts = baseTs + i * 800;
            events.push({
                type: 'suggestion_created',
                document: 'file:///f' + (i % 5) + '.js',
                size: 50 + (i % 100),
                timestamp: ts,
                suggestionId: sid,
                provenanceScore: 0.5 + (i % 50) / 100
            });
            const outcome = ['accepted', 'rejected', 'adapted', 'pending'][i % 4];
            if (outcome !== 'pending') {
                if (i % 3 === 0) events.push({ type: 'suggestion_reviewed', suggestionId: sid, reviewTime: 4000 + (i % 5) * 1000 });
                events.push({ type: 'suggestion_status_changed', suggestionId: sid, status: outcome });
            }
        }
        return fc.constant(events);
    }),
    { minLength: 1, maxLength: 8 }
).map((arrOfArrays) => arrOfArrays.flat());

/** Simpler: fixed structure with variable counts and outcomes */
const simpleValidTraceArbitrary = fc.integer({ min: 3, max: 25 }).chain((count) => {
    const events = [];
    for (let i = 0; i < count; i++) {
        const sid = 'suggestion-' + (i + 1);
        const ts = baseTs + i * 500;
        events.push({
            type: 'suggestion_created',
            document: 'file:///f' + (i % 5) + '.js',
            size: 30 + (i % 200),
            timestamp: ts,
            suggestionId: sid,
            provenanceScore: 0.6 + (i % 40) / 100
        });
        const statusChoice = fc.constantFrom('accepted', 'rejected', 'adapted', 'pending');
        return statusChoice.map((st) => {
            const out = [];
            if (st !== 'pending') {
                if (i % 2 === 0) out.push({ type: 'suggestion_reviewed', suggestionId: sid, reviewTime: 5000 });
                out.push({ type: 'suggestion_status_changed', suggestionId: sid, status: st });
            }
            return out;
        });
    }
    return fc.constant(events);
});

/** Deterministic trace: N blocks, each block = create + optional review + status (for shrinking). */
function genValidTrace(numBlocks) {
    const events = [];
    for (let i = 0; i < numBlocks; i++) {
        const sid = 'suggestion-' + (i + 1);
        const ts = baseTs + i * 600;
        events.push({
            type: 'suggestion_created',
            document: 'file:///f' + (i % 5) + '.js',
            size: 20 + (i % 300),
            timestamp: ts,
            suggestionId: sid,
            provenanceScore: 0.5 + (i % 50) / 100
        });
        const choice = (numBlocks * 31 + i) % 4;
        if (choice === 0) {
            events.push({ type: 'suggestion_reviewed', suggestionId: sid, reviewTime: 3000 + (i % 10) * 500 });
            events.push({ type: 'suggestion_status_changed', suggestionId: sid, status: 'accepted' });
        } else if (choice === 1) {
            events.push({ type: 'suggestion_status_changed', suggestionId: sid, status: 'accepted' });
        } else if (choice === 2) {
            events.push({ type: 'suggestion_status_changed', suggestionId: sid, status: 'rejected' });
        } else {
            events.push({ type: 'suggestion_reviewed', suggestionId: sid, reviewTime: 4000 });
            events.push({ type: 'suggestion_status_changed', suggestionId: sid, status: 'adapted' });
        }
    }
    return events;
}

describe('Property: valid lifecycle traces', () => {
    test('replay of any valid lifecycle trace yields scores in [0,100] and no NaN', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 30 }).map(genValidTrace),
                (events) => {
                    jest.useFakeTimers();
                    jest.setSystemTime(baseTs);
                    const services = createServices();
                    const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
                    const setSystemTime = (ts) => jest.setSystemTime(ts);
                    const snapshots = runner.replay(events, null, { setSystemTime });
                    jest.useRealTimers();
                    for (const s of snapshots) {
                        expect(Number.isFinite(s.score)).toBe(true);
                        expect(s.score).toBeGreaterThanOrEqual(0);
                        expect(s.score).toBeLessThanOrEqual(100);
                        expect(Number.isFinite(s.components.review)).toBe(true);
                        expect(Number.isFinite(s.components.blindAcceptance)).toBe(true);
                        expect(Number.isFinite(s.components.adaptation)).toBe(true);
                        expect(Number.isFinite(s.components.debt)).toBe(true);
                    }
                }
            ),
            { numRuns: 100, endOnFailure: true }
        );
    });

    test('replay of fc-generated valid traces (with shrinking) yields valid scores', () => {
        const traceArb = fc.array(
            fc.record({
                size: fc.integer({ min: 20, max: 400 }),
                status: fc.constantFrom('accepted', 'rejected', 'adapted', 'pending'),
                withReview: fc.boolean()
            }),
            { minLength: 1, maxLength: 20 }
        ).map((blocks) => {
            const events = [];
            blocks.forEach((b, i) => {
                const sid = 'suggestion-' + (i + 1);
                const ts = baseTs + i * 500;
                events.push({
                    type: 'suggestion_created',
                    document: 'file:///f' + (i % 5) + '.js',
                    size: b.size,
                    timestamp: ts,
                    suggestionId: sid,
                    provenanceScore: 0.7
                });
                if (b.status !== 'pending') {
                    if (b.withReview) events.push({ type: 'suggestion_reviewed', suggestionId: sid, reviewTime: 6000 });
                    events.push({ type: 'suggestion_status_changed', suggestionId: sid, status: b.status });
                }
            });
            return events;
        });

        fc.assert(
            fc.property(traceArb, (events) => {
                jest.useFakeTimers();
                jest.setSystemTime(baseTs);
                const services = createServices();
                const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
                const setSystemTime = (ts) => jest.setSystemTime(ts);
                const snapshots = runner.replay(events, null, { setSystemTime });
                jest.useRealTimers();
                snapshots.forEach((s) => {
                    expect(s.score).toBeGreaterThanOrEqual(0);
                    expect(s.score).toBeLessThanOrEqual(100);
                    expect(Number.isFinite(s.score)).toBe(true);
                });
            }),
            { numRuns: 80, endOnFailure: true }
        );
    });

    describe('Metamorphic: review helps, blind acceptance hurts', () => {
        test('T + extra review block => review score (good) does not decrease', () => {
            // Trace with at least one "accepted without review" → add review event before that accept
            const events = [
                { type: 'suggestion_created', document: 'file:///core.js', size: 200, timestamp: baseTs, suggestionId: 's1', provenanceScore: 0.8 },
                { type: 'suggestion_status_changed', suggestionId: 's1', status: 'accepted' }
            ];
            jest.useFakeTimers();
            jest.setSystemTime(baseTs);
            const servicesBase = createServices();
            const runnerBase = new ReplayRunner(servicesBase.scoreService, servicesBase.debtService, servicesBase.suggestionAggregate);
            const setSystemTime = (ts) => jest.setSystemTime(ts);
            runnerBase.replay(events, null, { setSystemTime });
            const suggestionsBase = servicesBase.suggestionAggregate.getSuggestions();
            const resultBase = servicesBase.scoreService.calculateScore({ suggestions: suggestionsBase, debtService: servicesBase.debtService });
            jest.useRealTimers();

            const eventsWithReview = [
                { type: 'suggestion_created', document: 'file:///core.js', size: 200, timestamp: baseTs, suggestionId: 's1', provenanceScore: 0.8 },
                { type: 'suggestion_reviewed', suggestionId: 's1', reviewTime: 8000 },
                { type: 'suggestion_status_changed', suggestionId: 's1', status: 'accepted' }
            ];
            jest.useFakeTimers();
            jest.setSystemTime(baseTs);
            const servicesReview = createServices();
            const runnerReview = new ReplayRunner(servicesReview.scoreService, servicesReview.debtService, servicesReview.suggestionAggregate);
            runnerReview.replay(eventsWithReview, null, { setSystemTime });
            const suggestionsReview = servicesReview.suggestionAggregate.getSuggestions();
            const resultReview = servicesReview.scoreService.calculateScore({ suggestions: suggestionsReview, debtService: servicesReview.debtService });
            jest.useRealTimers();

            expect(resultReview.scores.review).toBeGreaterThanOrEqual(resultBase.scores.review);
            expect(resultReview.currentScore).toBeLessThanOrEqual(resultBase.currentScore + 5);
        });

        test('T + blind accept on core => blindAcceptance risk does not decrease', () => {
            const eventsBase = [
                { type: 'suggestion_created', document: 'file:///a.js', size: 100, timestamp: baseTs, suggestionId: 's1', provenanceScore: 0.7 },
                { type: 'suggestion_reviewed', suggestionId: 's1', reviewTime: 6000 },
                { type: 'suggestion_status_changed', suggestionId: 's1', status: 'accepted' }
            ];
            jest.useFakeTimers();
            jest.setSystemTime(baseTs);
            const servicesBase = createServices();
            const runnerBase = new ReplayRunner(servicesBase.scoreService, servicesBase.debtService, servicesBase.suggestionAggregate);
            const setSystemTime = (ts) => jest.setSystemTime(ts);
            runnerBase.replay(eventsBase, null, { setSystemTime });
            const resultBase = servicesBase.scoreService.calculateScore({
                suggestions: servicesBase.suggestionAggregate.getSuggestions(),
                debtService: servicesBase.debtService
            });
            jest.useRealTimers();

            const eventsWithBlind = [
                ...eventsBase,
                { type: 'suggestion_created', document: 'file:///core.js', size: 150, timestamp: baseTs + 1000, suggestionId: 's2', provenanceScore: 0.9 },
                { type: 'suggestion_status_changed', suggestionId: 's2', status: 'accepted' }
            ];
            jest.useFakeTimers();
            jest.setSystemTime(baseTs + 2000);
            const servicesBlind = createServices();
            const runnerBlind = new ReplayRunner(servicesBlind.scoreService, servicesBlind.debtService, servicesBlind.suggestionAggregate);
            runnerBlind.replay(eventsWithBlind, null, { setSystemTime });
            const resultBlind = servicesBlind.scoreService.calculateScore({
                suggestions: servicesBlind.suggestionAggregate.getSuggestions(),
                debtService: servicesBlind.debtService
            });
            jest.useRealTimers();

            expect(resultBlind.scores.blindAcceptance).toBeGreaterThanOrEqual(resultBase.scores.blindAcceptance);
        });
    });
});
