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

    test('returns empty shape when suggestionAggregate is null', () => {
        expect(engine.suggestionAggregate).toBeNull();
        const out = engine.getAntipatternBreakdown();
        expect(out).toMatchObject({
            flooding: { count: 0, risk0To100: 0 },
            responseDrill: { count: 0, risk0To100: 0 },
            contextSpread: { maxBatchSize: 0, distinctFiles: 0, risk0To100: 0 },
            diffFlooding: { maxBurstInWindow: 0, risk0To100: 0 },
            comprehensionDebt: { risk0To100: 0 },
            verificationDebt: { acceptedWithoutVerification: 0, acceptedTotal: 0, risk0To100: 0 },
            testTheater: { risk0To100: 0 },
            boundaryViolations: { risk0To100: 0 },
            observabilityNeglect: { risk0To100: 0 }
        });
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
        expect(out.flooding).toHaveProperty('count');
        expect(out.flooding).toHaveProperty('risk0To100');
        expect(out.responseDrill).toHaveProperty('count');
        expect(out.responseDrill).toHaveProperty('risk0To100');
        expect(out.contextSpread).toHaveProperty('maxBatchSize');
        expect(out.contextSpread).toHaveProperty('distinctFiles');
        expect(out.contextSpread).toHaveProperty('risk0To100');
        expect(out.diffFlooding).toHaveProperty('maxBurstInWindow');
        expect(out.diffFlooding).toHaveProperty('risk0To100');
        expect(out.comprehensionDebt).toHaveProperty('risk0To100');
        expect(out.verificationDebt).toHaveProperty('acceptedWithoutVerification');
        expect(out.verificationDebt).toHaveProperty('acceptedTotal');
        expect(out.verificationDebt).toHaveProperty('risk0To100');
        expect(out.testTheater).toHaveProperty('risk0To100');
        expect(out.boundaryViolations).toEqual({ risk0To100: 0 });
        expect(out.observabilityNeglect).toEqual({ risk0To100: 0 });

        expect(batch.suggestionIds.length).toBe(12);
        expect(batch.totalSize).toBe(400);
        expect(batch.isKeepAllPattern()).toBe(true);
        expect(out.diffFlooding.maxBurstInWindow).toBeGreaterThanOrEqual(35 + 40 + 30);
        expect(out.diffFlooding.risk0To100).toBeGreaterThan(0);
        expect(out.diffFlooding.risk0To100).toBeLessThanOrEqual(100);
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
        expect(out.diffFlooding.risk0To100).toBe(0);
        expect(out.diffFlooding.maxBurstInWindow).toBe(0);
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
        expect(out.testTheater).toHaveProperty('risk0To100');
        expect(out.testTheater).toHaveProperty('snapshotRatio');
        expect(out.testTheater).toHaveProperty('trivialAssertRatio');
        expect(out).toHaveProperty('duplication');
        expect(out.duplication).toHaveProperty('risk0To100');
        expect(out.testTheater.risk0To100).toBeGreaterThan(0);
    });
});
