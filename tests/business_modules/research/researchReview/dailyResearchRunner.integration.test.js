/**
 * Integration: Daily research runner with real report writer (temp dir). Fetchers mocked (no real network).
 * Asserts run() writes file and returns reportPath and itemCount.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

jest.mock('../../../../business_modules/research/researchReview/fetchers/arxivFetcher', () => ({
    fetchArxiv: jest.fn().mockResolvedValue([{ title: 'A', link: 'https://a.org', summary: 'S', source: 'arxiv', date: '2025-01-01' }])
}));
jest.mock('../../../../business_modules/research/researchReview/fetchers/mediumFetcher', () => ({
    fetchMedium: jest.fn().mockResolvedValue([])
}));
jest.mock('../../../../business_modules/research/researchReview/fetchers/linkedinFetcher', () => ({
    fetchLinkedIn: jest.fn().mockResolvedValue([])
}));
jest.mock('../../../../business_modules/research/researchReview/fetchers/xFetcher', () => ({
    fetchX: jest.fn().mockResolvedValue([])
}));

const { createDailyResearchRunner } = require('../../../../business_modules/research/researchReview/dailyResearchRunner');

describe('dailyResearchRunner integration', () => {
    test('run with real report writer: file created at reportsDir with content', async () => {
        const reportsDir = path.join(os.tmpdir(), `daily-integration-${Date.now()}`);
        const runner = createDailyResearchRunner({
            getReportsDir: () => reportsDir,
            fetchFn: () => Promise.resolve({ ok: true, text: () => '' })
        });
        const result = await runner.run();
        expect(result.reportPath).toBeTruthy();
        expect(result.itemCount).toBe(1);
        expect(fs.existsSync(result.reportPath)).toBe(true);
        expect(result.reportPath).toMatch(/\.md$/);
        expect(result.reportPath).toContain(reportsDir);
        const content = fs.readFileSync(result.reportPath, 'utf8');
        expect(content).toContain('Daily Research Report');
        expect(content).toContain('A');
    });
});
