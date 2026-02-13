/**
 * Unit tests for ResearchReportBuilder.
 */

const { buildReport } = require('../../../business_modules/research/app/ResearchReportBuilder');

describe('ResearchReportBuilder', () => {
    it('builds report with analysis results', () => {
        const results = [
            {
                method: 'correlation_regression',
                design: 'Pearson: x vs y',
                equations: 'y = 1 + 2*x',
                findings: 'r = 0.95 (p = 0.01); n = 10',
                pValues: { correlation: 0.01, regression: 0.02 }
            }
        ];
        const report = buildReport(results, null, { sampleSize: 10 });
        expect(report).toContain('# Research Report');
        expect(report).toContain('Pearson: x vs y');
        expect(report).toContain('y = 1 + 2*x');
        expect(report).toContain('r = 0.95');
        expect(report).toMatch(/Sample size.*10.*time points/);
    });

    it('includes internet research stub when no summary', () => {
        const report = buildReport([], null, {});
        expect(report).toContain('Internet research disabled');
    });

    it('includes literature summary when provided', () => {
        const report = buildReport([], { summary: 'Recent papers show...', sources: ['url1'] }, {});
        expect(report).toContain('Recent papers show');
        expect(report).toContain('url1');
    });
});
