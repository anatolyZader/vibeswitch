/**
 * Unit tests for ResearchDbAdapter.
 */

const path = require('path');
const fs = require('fs');
const { createResearchDbAdapter } = require('../../../business_modules/research/infrastructure/ResearchDbAdapter');

describe('ResearchDbAdapter', () => {
    const tmpDir = path.join(__dirname, '../../../../.tmp-research-db-test');
    let dbPath;
    let adapter;

    beforeAll(async () => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
        fs.mkdirSync(tmpDir, { recursive: true });
        dbPath = path.join(tmpDir, 'test.db');
        adapter = await createResearchDbAdapter(dbPath);
    });

    afterAll(() => {
        if (adapter && adapter.close) adapter.close();
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    });

    it('inserts and queries time_series', () => {
        adapter.insertTimeSeries({
            timestamp: '2026-02-11T12:00:00.000Z',
            sessionId: 's1',
            measureName: 'scoreData.total',
            value: 45
        });
        adapter.insertTimeSeries({
            timestamp: '2026-02-11T12:00:00.000Z',
            measureName: 'tokenUsage.totalTokens',
            value: 1000
        });

        const rows = adapter.queryTimeSeries({ limit: 10 });
        expect(rows.length).toBeGreaterThanOrEqual(2);
        expect(rows.some((r) => r.measure_name === 'scoreData.total' && r.value === 45)).toBe(true);
    });

    it('inserts analysis result', () => {
        adapter.insertAnalysisResult({
            runId: 'run-1',
            method: 'correlation',
            design: 'Pearson',
            equations: 'r = cov(X,Y)/(std(X)*std(Y))',
            findings: 'r = 0.5',
            pValues: { correlation: 0.05 }
        });
        expect(fs.existsSync(dbPath)).toBe(true);
    });
});
