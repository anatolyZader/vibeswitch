/**
 * Tests: dailyResearchRunner runFetchers and runDailyResearch (mocked fetchers).
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

jest.mock('../../../../business_modules/research/researchReview/fetchers/arxivFetcher', () => ({
    fetchArxiv: jest.fn().mockResolvedValue([{ title: 'Arxiv 1', link: 'https://arxiv.org/1', summary: 'S', source: 'arxiv', date: '2025-01-01' }])
}));
jest.mock('../../../../business_modules/research/researchReview/fetchers/mediumFetcher', () => ({
    fetchMedium: jest.fn().mockResolvedValue([{ title: 'Medium 1', link: 'https://medium.com/1', summary: 'S', source: 'medium', date: '2025-01-01' }])
}));
jest.mock('../../../../business_modules/research/researchReview/fetchers/linkedinFetcher', () => ({
    fetchLinkedIn: jest.fn().mockResolvedValue([])
}));
jest.mock('../../../../business_modules/research/researchReview/fetchers/xFetcher', () => ({
    fetchX: jest.fn().mockResolvedValue([])
}));

const { runFetchers, runDailyResearch, createDailyResearchRunner } = require('../../../../business_modules/research/researchReview/dailyResearchRunner');

describe('dailyResearchRunner', () => {
    test('runFetchers aggregates all sources', async () => {
        const items = await runFetchers({ fetchFn: () => Promise.resolve({ ok: true, text: () => '' }) });
        expect(items.length).toBeGreaterThanOrEqual(1);
        const sources = items.map((i) => i.source);
        expect(sources).toContain('arxiv');
        expect(sources).toContain('medium');
    });

    test('runDailyResearch writes report and returns path and itemCount', async () => {
        const reportsDir = path.join(os.tmpdir(), 'daily-run-' + Date.now());
        const result = await runDailyResearch(reportsDir, {
            dateStr: '2025-02-14',
            fetchFn: () => Promise.resolve({ ok: true, text: () => '' })
        });
        expect(result.reportPath).toBeTruthy();
        expect(result.itemCount).toBeGreaterThanOrEqual(1);
        expect(fs.existsSync(result.reportPath)).toBe(true);
        expect(fs.readFileSync(result.reportPath, 'utf8')).toContain('2025-02-14');
    });

    test('createDailyResearchRunner run uses getReportsDir and returns result', async () => {
        const reportsDir = path.join(os.tmpdir(), 'runner-' + Date.now());
        const runner = createDailyResearchRunner({
            getReportsDir: () => reportsDir,
            fetchFn: () => Promise.resolve({ ok: true, text: () => '' })
        });
        const result = await runner.run();
        expect(result.reportPath).toBeTruthy();
        expect(result.itemCount).toBeDefined();
    });
});
