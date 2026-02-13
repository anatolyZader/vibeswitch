/**
 * ResearchReportBuilder: builds markdown report from analysis results and optional literature summary.
 */

/**
 * @param {Array<{ method: string, design: string, equations: string, findings: string, pValues: object }>} analysisResults
 * @param {{ date?: string, sources?: object[], summary?: string } | null} [literatureSummary]
 * @param {{ sampleSize?: number } | null} [meta]
 * @returns {string}
 */
function buildReport(analysisResults, literatureSummary, meta) {
    const lines = [
        '# Research Report',
        '',
        '**Generated:** ' + new Date().toISOString(),
        '',
        '---',
        '',
        '## Methods Used',
        ''
    ];

    const results = analysisResults || [];
    if (results.length === 0) {
        lines.push('No statistical analysis performed (insufficient data or no valid measure pairs).');
    } else {
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            lines.push('### ' + (i + 1) + '. ' + (r.design || r.method));
            lines.push('');
            if (r.equations) {
                lines.push('**Equations:** ' + r.equations);
                lines.push('');
            }
            lines.push('**Findings:** ' + (r.findings || 'N/A'));
            if (r.pValues && Object.keys(r.pValues).length > 0) {
                lines.push('');
                lines.push('**p-values:** ' + JSON.stringify(r.pValues));
            }
            lines.push('');
        }
    }

    if (meta && meta.sampleSize != null) {
        lines.push('**Sample size:** ' + meta.sampleSize + ' time points');
        lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## Internet Research');
    lines.push('');

    if (literatureSummary && literatureSummary.summary) {
        lines.push(literatureSummary.summary);
        if (literatureSummary.sources && literatureSummary.sources.length > 0) {
            lines.push('');
            lines.push('**Sources:**');
            for (const s of literatureSummary.sources) {
                lines.push('- ' + (typeof s === 'string' ? s : JSON.stringify(s)));
            }
        }
    } else {
        lines.push('Internet research disabled (no API key configured).');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Caveats');
    lines.push('');
    lines.push('- Analysis uses Pearson correlation and simple linear regression.');
    lines.push('- p-values are approximate (two-tailed t-test).');
    lines.push('- Sample size may be limited; interpret with caution.');
    lines.push('- For academic use, validate methodology and replicate results.');

    return lines.join('\n');
}

module.exports = {
    buildReport
};
