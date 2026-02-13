/**
 * Unit tests for TimeSeriesCollector.
 */

const path = require('path');
const fs = require('fs');
const { createResearchDbAdapter } = require('../../../business_modules/research/infrastructure/ResearchDbAdapter');
const { createTimeSeriesCollector, flattenPayload } = require('../../../business_modules/research/app/TimeSeriesCollector');

describe('TimeSeriesCollector', () => {
    const tmpDir = path.join(__dirname, '../../../../.tmp-research-collector-test');
    let adapter;
    let collector;

    beforeAll(async () => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
        fs.mkdirSync(tmpDir, { recursive: true });
        adapter = await createResearchDbAdapter(path.join(tmpDir, 'test.db'));
        collector = createTimeSeriesCollector(adapter);
    });

    afterAll(() => {
        if (adapter && adapter.close) adapter.close();
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    });

    describe('flattenPayload', () => {
        it('extracts measure names and values', () => {
            const payload = {
                scoreData: { total: 50, components: { review: 30, blindAcceptance: 10 } },
                tokenUsage: { totalInput: 100, totalOutput: 50, totalTokens: 150 }
            };
            const measures = flattenPayload(payload);
            expect(measures.length).toBeGreaterThan(0);
            expect(measures.some((m) => m.measureName === 'scoreData.total' && m.value === 50)).toBe(true);
        });

        it('ignores missing or non-numeric values', () => {
            const payload = { scoreData: {} };
            const measures = flattenPayload(payload);
            expect(measures.filter((m) => m.measureName.startsWith('scoreData'))).toHaveLength(0);
        });
    });

    describe('sample', () => {
        it('writes to database', () => {
            const payload = {
                scoreData: { total: 42, components: { review: 25, debt: 15 } },
                tokenUsage: { totalTokens: 500 }
            };
            collector.sample(payload);

            const rows = adapter.queryTimeSeries({ limit: 20 });
            expect(rows.some((r) => r.measure_name === 'scoreData.total' && r.value === 42)).toBe(true);
        });
    });
});
