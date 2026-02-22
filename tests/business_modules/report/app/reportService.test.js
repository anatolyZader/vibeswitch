/**
 * ReportService unit tests — spec-report.md (TDD Red phase).
 * Covers: Input/Output table, edge cases, error cases. Ports mocked.
 */
const { createReportService } = require('../../../../business_modules/report/app/reportService');

const KNOWN_PLATFORMS = ['x', 'linkedin', 'medium'];

function mockContentSourcePort(readResult) {
    return {
        read: typeof readResult === 'function'
            ? readResult
            : jest.fn().mockResolvedValue(readResult ?? '')
    };
}

function mockPublishAdapter(result) {
    return {
        publish: jest.fn().mockResolvedValue(result ?? { ok: true, publishedId: 'id-1' })
    };
}

function createServiceWithMocks(opts = {}) {
    const contentSourcePort = opts.contentSourcePort ?? mockContentSourcePort('');
    const xAdapter = opts.xAdapter ?? mockPublishAdapter({ ok: true, publishedId: 'x-1' });
    const linkedInAdapter = opts.linkedInAdapter ?? mockPublishAdapter({ ok: true, publishedId: 'li-1' });
    const mediumAdapter = opts.mediumAdapter ?? mockPublishAdapter({ ok: true, publishedId: 'm-1' });
    return createReportService({
        contentSourcePort,
        publishAdapters: { x: xAdapter, linkedin: linkedInAdapter, medium: mediumAdapter }
    });
}

describe('ReportService.publishReport', () => {
    describe('Input/Output — content only', () => {
        test('{ content: "Hello world" } returns ok true and results for x, linkedin, medium', async () => {
            const service = createServiceWithMocks();
            const result = await service.publishReport({ content: 'Hello world' });
            expect(result).toHaveProperty('ok', true);
            expect(result).toHaveProperty('results');
            expect(Array.isArray(result.results)).toBe(true);
            expect(result.results).toHaveLength(3);
            const platforms = result.results.map((r) => r.platform).sort();
            expect(platforms).toEqual(['linkedin', 'medium', 'x']);
            result.results.forEach((r) => {
                expect(r).toHaveProperty('platform');
                expect(r).toHaveProperty('ok', true);
            });
        });

        test('{ content: "Hello", platforms: ["x"] } invokes only X adapter', async () => {
            const xAdapter = mockPublishAdapter({ ok: true, publishedId: 'x-only' });
            const service = createServiceWithMocks({ xAdapter });
            const result = await service.publishReport({ content: 'Hello', platforms: ['x'] });
            expect(result.ok).toBe(true);
            expect(result.results).toHaveLength(1);
            expect(result.results[0].platform).toBe('x');
            expect(result.results[0].ok).toBe(true);
            expect(xAdapter.publish).toHaveBeenCalledWith('Hello', expect.any(Object));
        });
    });

    describe('Input/Output — contentPath', () => {
        test('{ contentPath: "/path/to/report.md" } resolves content via contentSourcePort then publishes to all three', async () => {
            const contentSourcePort = mockContentSourcePort('# Report');
            const xAdapter = mockPublishAdapter({ ok: true });
            const service = createServiceWithMocks({ contentSourcePort, xAdapter });
            const result = await service.publishReport({ contentPath: '/path/to/report.md' });
            expect(contentSourcePort.read).toHaveBeenCalledWith('/path/to/report.md');
            expect(result.ok).toBe(true);
            expect(result.results).toHaveLength(3);
            expect(xAdapter.publish).toHaveBeenCalledWith('# Report', expect.any(Object));
        });

        test('{ contentPath } when content source throws returns ok false, results [], error set', async () => {
            const contentSourcePort = mockContentSourcePort(() => Promise.reject(new Error('File not found')));
            const xAdapter = mockPublishAdapter({ ok: true });
            const service = createServiceWithMocks({ contentSourcePort, xAdapter });
            const result = await service.publishReport({ contentPath: '/missing.md' });
            expect(result.ok).toBe(false);
            expect(result.results).toEqual([]);
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
            expect(xAdapter.publish).not.toHaveBeenCalled();
        });
    });

    describe('Input/Output — partial failure', () => {
        test('one adapter (e.g. LinkedIn) fails: ok false, per-platform results reflect success/failure', async () => {
            const linkedInAdapter = mockPublishAdapter({ ok: false, error: 'Rate limited' });
            const service = createServiceWithMocks({ linkedInAdapter });
            const result = await service.publishReport({ content: 'Hello' });
            expect(result.ok).toBe(false);
            expect(result.results).toHaveLength(3);
            const xResult = result.results.find((r) => r.platform === 'x');
            const liResult = result.results.find((r) => r.platform === 'linkedin');
            const mResult = result.results.find((r) => r.platform === 'medium');
            expect(xResult.ok).toBe(true);
            expect(liResult.ok).toBe(false);
            expect(liResult.error).toBe('Rate limited');
            expect(mResult.ok).toBe(true);
        });
    });

    describe('Validation — missing content and contentPath', () => {
        test('{} returns ok false, results [], error message (no throw)', async () => {
            const service = createServiceWithMocks();
            const result = await service.publishReport({});
            expect(result.ok).toBe(false);
            expect(result.results).toEqual([]);
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
            expect(result.error.toLowerCase()).toMatch(/content|contentpath|missing/);
        });

        test('{ content: null, contentPath: undefined } returns validation error', async () => {
            const service = createServiceWithMocks();
            const result = await service.publishReport({ content: null, contentPath: undefined });
            expect(result.ok).toBe(false);
            expect(result.results).toEqual([]);
            expect(result.error).toBeDefined();
        });
    });

    describe('Edge — empty content', () => {
        test('{ content: "", platforms: ["x"] } is accepted; result per platform', async () => {
            const xAdapter = mockPublishAdapter({ ok: true });
            const service = createServiceWithMocks({ xAdapter });
            const result = await service.publishReport({ content: '', platforms: ['x'] });
            expect(result.results).toHaveLength(1);
            expect(xAdapter.publish).toHaveBeenCalledWith('', expect.any(Object));
        });
    });

    describe('Edge — empty platforms', () => {
        test('platforms: [] returns ok true, results [] (no-op)', async () => {
            const service = createServiceWithMocks();
            const result = await service.publishReport({ content: 'Hi', platforms: [] });
            expect(result.ok).toBe(true);
            expect(result.results).toEqual([]);
        });
    });

    describe('Edge — duplicate platforms', () => {
        test('platforms: ["x", "x", "linkedin"] dedupes and publishes once per platform', async () => {
            const xAdapter = mockPublishAdapter({ ok: true });
            const linkedInAdapter = mockPublishAdapter({ ok: true });
            const service = createServiceWithMocks({ xAdapter, linkedInAdapter });
            const result = await service.publishReport({ content: 'Hi', platforms: ['x', 'x', 'linkedin'] });
            expect(result.ok).toBe(true);
            expect(result.results).toHaveLength(2);
            expect(xAdapter.publish).toHaveBeenCalledTimes(1);
            expect(linkedInAdapter.publish).toHaveBeenCalledTimes(1);
        });
    });

    describe('Edge — both content and contentPath set', () => {
        test('prefer content and ignore contentPath', async () => {
            const contentSourcePort = mockContentSourcePort('# From file');
            const xAdapter = mockPublishAdapter({ ok: true });
            const service = createServiceWithMocks({ contentSourcePort, xAdapter });
            const result = await service.publishReport({
                content: 'In-memory text',
                contentPath: '/path/to/file.md'
            });
            expect(result.ok).toBe(true);
            expect(contentSourcePort.read).not.toHaveBeenCalled();
            expect(xAdapter.publish).toHaveBeenCalledWith('In-memory text', expect.any(Object));
        });
    });

    describe('Error — invalid types', () => {
        test('content not a string when provided returns validation error', async () => {
            const service = createServiceWithMocks();
            const result = await service.publishReport({ content: 123 });
            expect(result.ok).toBe(false);
            expect(result.results).toEqual([]);
            expect(result.error).toBeDefined();
        });
    });

    describe('Error — unknown platform', () => {
        test('platforms including unknown value (e.g. "twitter") skips unknown, invokes only known adapters', async () => {
            const xAdapter = mockPublishAdapter({ ok: true });
            const service = createServiceWithMocks({ xAdapter });
            const result = await service.publishReport({ content: 'Hi', platforms: ['x', 'twitter', 'linkedin'] });
            expect(result.results.length).toBeLessThanOrEqual(3);
            const platforms = result.results.map((r) => r.platform);
            expect(platforms).toContain('x');
            expect(platforms).toContain('linkedin');
            expect(platforms).not.toContain('twitter');
        });
    });

    describe('Invariants', () => {
        test('result has deterministic shape: ok, results array', async () => {
            const service = createServiceWithMocks();
            const result = await service.publishReport({ content: 'Hi' });
            expect(result).toHaveProperty('ok');
            expect(typeof result.ok).toBe('boolean');
            expect(Array.isArray(result.results)).toBe(true);
            result.results.forEach((r) => {
                expect(r).toHaveProperty('platform');
                expect(r).toHaveProperty('ok');
                expect(KNOWN_PLATFORMS).toContain(r.platform);
            });
        });
    });
});
