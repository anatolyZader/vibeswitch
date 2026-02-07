/**
 * Unit tests for getAntipatternBreakdown(): return shape, diff flooding burst, placeholders.
 * Uses minimal engine with mocked suggestionAggregate (no full start).
 */

const AwarenessEngine = require('../../../../../business_modules/awareness/app/awarenessEngine');
const SuggestionBatch = require('../../../../../business_modules/awareness/domain/entities/suggestionBatch');

function noop() {}

describe('getAntipatternBreakdown', () => {
    let engine;

    beforeEach(() => {
        engine = new AwarenessEngine({
            vscodeAdapter: {},
            persistenceAdapter: { loadSync: jest.fn(() => new Map()), save: jest.fn(() => Promise.resolve()) },
            loggerAdapter: { log: noop, debug: noop, error: noop },
            idGeneratorAdapter: { generateId: jest.fn(() => 'id'), generateUUID: jest.fn(() => 'uuid') },
            hashGeneratorAdapter: { hash: jest.fn(() => 'h') },
            rangeOperationServiceD: {},
            uriPathOperationServiceD: {}
        });
    });

    test('returns empty shape when suggestionAggregate is null (Contract A envelope)', () => {
        expect(engine.suggestionAggregate).toBeNull();
        const out = engine.getAntipatternBreakdown();
        expect(out.flooding).toHaveProperty('value');
        expect(out.flooding).toHaveProperty('meta');
        expect(out.flooding).toHaveProperty('updatedTs');
        expect(out.flooding.value).toMatchObject({ count: 0, risk0To100: 0 });
        expect(out.verificationDebt.value).toMatchObject({ acceptedWithoutVerification: 0, acceptedTotal: 0, risk0To100: 0 });
        expect(out.boundaryViolations.value).toMatchObject({ risk0To100: 0, violations: [] });
    });

    test('returns full shape with diffFlooding when aggregate has one large keep-all batch', () => {
        const now = Date.now();
        const batch = new SuggestionBatch('b1', 'file:///a.js', now - 60 * 1000); // 1 min ago
        for (let i = 0; i < 12; i++) batch.addSuggestion(`s${i}`, 30);
        batch.totalSize = 400;
        batch.status = 'fully_accepted';
        batch.acceptedCount = 12;
        batch.rejectedCount = 0;
        batch.modifiedCount = 0;

        engine.suggestionAggregate = {
            getBatches: () => [batch],
            getSuggestions: () => []
        };

        const out = engine.getAntipatternBreakdown();
        expect(out.flooding.value).toHaveProperty('count');
        expect(out.flooding.value).toHaveProperty('risk0To100');
        expect(out.responseDrill.value).toHaveProperty('count');
        expect(out.responseDrill.value).toHaveProperty('risk0To100');
        expect(out.contextSpread.value).toHaveProperty('maxBatchSize');
        expect(out.contextSpread.value).toHaveProperty('distinctFiles');
        expect(out.diffFlooding.value).toHaveProperty('maxBurstInWindow');
        expect(out.diffFlooding.value).toHaveProperty('risk0To100');
        expect(out.verificationDebt.value).toHaveProperty('acceptedWithoutVerification');
        expect(out.verificationDebt.value).toHaveProperty('acceptedTotal');
        expect(out.boundaryViolations.value).toHaveProperty('risk0To100');
        expect(out.boundaryViolations.value).toHaveProperty('violations');

        expect(batch.suggestionIds.length).toBe(12);
        expect(batch.totalSize).toBe(400);
        expect(batch.isKeepAllPattern()).toBe(true);
        expect(out.diffFlooding.value.maxBurstInWindow).toBeGreaterThanOrEqual(35 + 40 + 30);
        expect(out.diffFlooding.value.risk0To100).toBeGreaterThan(0);
        expect(out.diffFlooding.value.risk0To100).toBeLessThanOrEqual(100);
    });

    test('diffFlooding is 0 when batches are small and old', () => {
        const batch = new SuggestionBatch('b1', 'file:///a.js', Date.now() - 20 * 60 * 1000); // 20 min ago
        batch.addSuggestion('s1', 50);
        batch.addSuggestion('s2', 50);

        engine.suggestionAggregate = {
            getBatches: () => [batch],
            getSuggestions: () => []
        };

        const out = engine.getAntipatternBreakdown();
        expect(out.diffFlooding.value.risk0To100).toBe(0);
        expect(out.diffFlooding.value.maxBurstInWindow).toBe(0);
    });

    test('verification debt: counts accepted and adapted (not only fully_accepted/partially_accepted)', () => {
        const Suggestion = require('../../../../../business_modules/awareness/domain/entities/suggestion');
        const now = Date.now();
        const recent = now - 5 * 60 * 1000;
        const s1 = new Suggestion('s1', 'file:///a.js', { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } }, 'x', 10, { timestamp: recent });
        s1.status = 'accepted';
        s1.verificationSignals = { testFileModified: false, navigationAfterInsert: false, saveAfterInsert: false, timeToVerify: null };
        const s2 = new Suggestion('s2', 'file:///b.js', { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } }, 'y', 10, { timestamp: recent });
        s2.status = 'adapted';
        s2.verificationSignals = { testFileModified: false, navigationAfterInsert: false, saveAfterInsert: false, timeToVerify: null };
        engine.suggestionAggregate = {
            getBatches: () => [],
            getSuggestions: () => [s1, s2]
        };
        const out = engine.getAntipatternBreakdown();
        expect(out.verificationDebt.value.acceptedTotal).toBe(2);
        expect(out.verificationDebt.value.acceptedWithoutVerification).toBe(2);
        expect(out.verificationDebt.value.risk0To100).toBe(100);
    });

    test('verification debt: old statuses fully_accepted/partially_accepted still counted (backward compat)', () => {
        const Suggestion = require('../../../../../business_modules/awareness/domain/entities/suggestion');
        const now = Date.now();
        const recent = now - 5 * 60 * 1000;
        const s1 = new Suggestion('s1', 'file:///a.js', { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } }, 'x', 10, { timestamp: recent });
        s1.status = 'fully_accepted';
        s1.verificationSignals = { testFileModified: false, navigationAfterInsert: false, saveAfterInsert: false, timeToVerify: null };
        engine.suggestionAggregate = {
            getBatches: () => [],
            getSuggestions: () => [s1]
        };
        const out = engine.getAntipatternBreakdown();
        expect(out.verificationDebt.value.acceptedTotal).toBe(1);
        expect(out.verificationDebt.value.acceptedWithoutVerification).toBe(1);
    });
});

describe('getAntipatternBreakdownAsync', () => {
    let engine;

    beforeEach(() => {
        engine = new AwarenessEngine({
            vscodeAdapter: {
                Uri: { file: (p) => ({ fsPath: p }) },
                workspaceFolders: [{ uri: { fsPath: '/root' } }],
                openTextDocument: jest.fn()
            },
            persistenceAdapter: { loadSync: jest.fn(() => new Map()), save: jest.fn(() => Promise.resolve()) },
            loggerAdapter: { log: () => {}, debug: () => {}, error: () => {} },
            idGeneratorAdapter: { generateId: jest.fn(() => 'id'), generateUUID: jest.fn(() => 'uuid') },
            hashGeneratorAdapter: { hash: jest.fn(() => 'h') },
            rangeOperationServiceD: {},
            uriPathOperationServiceD: {}
        });
    });

    test('return shape includes testTheater and duplication; testTheater risk > 0 when test file has snapshot + trivial asserts', async () => {
        const now = Date.now();
        const batch = new SuggestionBatch('b1', 'src/foo.test.js', now - 60 * 1000);
        batch.addSuggestion('s1', 50);
        engine.suggestionAggregate = {
            getBatches: () => [batch],
            getSuggestions: () => []
        };
        const snapshotHeavyContent = `
            expect(x).toBeTruthy();
            expect(y).toBeDefined();
            expect(z).toMatchSnapshot();
            expect(a).toMatchSnapshot();
            expect(b).toMatchInlineSnapshot();
        `;
        engine.vscodeAdapter.openTextDocument = jest.fn(() => Promise.resolve({
            getText: () => snapshotHeavyContent
        }));

        const out = await engine.getAntipatternBreakdownAsync();
        expect(out).toHaveProperty('testTheater');
        expect(out.testTheater.value).toHaveProperty('risk0To100');
        expect(out.testTheater.value).toHaveProperty('snapshotRatio');
        expect(out.testTheater.value).toHaveProperty('trivialAssertRatio');
        expect(out).toHaveProperty('duplication');
        expect(out.duplication.value).toHaveProperty('risk0To100');
        expect(out.testTheater.value.risk0To100).toBeGreaterThan(0);
    });
});
