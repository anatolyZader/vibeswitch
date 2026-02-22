/**
 * Tests: reportGenerator - generateReportMarkdown, writeReportFile, generateDailyReport.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const {
    generateReportMarkdown,
    writeReportFile,
    generateDailyReport
} = require('../../../../business_modules/research/researchReview/reportGenerator');

describe('reportGenerator', () => {
    test('generateReportMarkdown includes date and groups by source', () => {
        const items = [
            { title: 'A', link: 'https://a.com', summary: 'Sum A', source: 'arxiv', date: '2025-01-01' },
            { title: 'B', link: 'https://b.com', summary: 'Sum B', source: 'arxiv', date: '2025-01-02' },
            { title: 'C', link: 'https://c.com', summary: 'Sum C', source: 'medium', date: '2025-01-03' }
        ];
        const md = generateReportMarkdown(items, '2025-01-15');
        expect(md).toContain('Daily Research Report: 2025-01-15');
        expect(md).toContain('## Arxiv');
        expect(md).toContain('## Medium');
        expect(md).toContain('A');
        expect(md).toContain('B');
        expect(md).toContain('C');
    });

    test('writeReportFile creates dir and file', () => {
        const dir = path.join(os.tmpdir(), 'report-test-' + Date.now());
        const filePath = writeReportFile(dir, '2025-01-01', '# Test\n\nContent');
        expect(fs.existsSync(dir)).toBe(true);
        expect(fs.existsSync(filePath)).toBe(true);
        expect(filePath).toContain('2025-01-01.md');
    });

    test('generateDailyReport writes file and returns path', () => {
        const dir = path.join(os.tmpdir(), 'daily-report-' + Date.now());
        const items = [{ title: 'T', link: 'https://x.com', summary: 'S', source: 'arxiv', date: '2025-02-01' }];
        const filePath = generateDailyReport(items, dir, '2025-02-01');
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf8')).toContain('2025-02-01');
    });

    test('generateDailyReport with empty items still writes file with header only', () => {
        const dir = path.join(os.tmpdir(), 'daily-report-empty-' + Date.now());
        const filePath = generateDailyReport([], dir, '2025-03-01');
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toContain('Daily Research Report: 2025-03-01');
        expect(content).toContain('---');
        expect(content).not.toContain('## Arxiv');
    });

    test('generateDailyReport with invalid dateStr uses today for path and content', () => {
        const dir = path.join(os.tmpdir(), 'daily-report-invalid-date-' + Date.now());
        const today = new Date().toISOString().slice(0, 10);
        const filePath = generateDailyReport([], dir, 'not-a-date', {});
        expect(fs.existsSync(filePath)).toBe(true);
        expect(filePath).toContain(today + '.md');
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toContain('Daily Research Report: ' + today);
    });
});
