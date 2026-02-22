/**
 * Generates a daily research report (Markdown) from normalized insight items.
 * Output: researchReview/reports/YYYY-MM-DD.md
 */

const path = require('path');
const fs = require('fs');

/**
 * Normalized insight item shape: { title, link, summary, source, date }
 * @param {Array<{ title: string, link: string, summary: string, source: string, date: string }>} items
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} Markdown content
 */
function generateReportMarkdown(items, dateStr) {
    const lines = [
        `# Daily Research Report: ${dateStr}`,
        '',
        'Insights on AI-assisted coding, antipatterns, and related research from arxiv, Medium, LinkedIn, and X.',
        '',
        '---',
        ''
    ];
    const bySource = {};
    for (const item of items) {
        const src = item.source || 'other';
        if (!bySource[src]) bySource[src] = [];
        bySource[src].push(item);
    }
    const sourceOrder = ['arxiv', 'medium', 'linkedin', 'x'];
    for (const src of sourceOrder) {
        const list = bySource[src];
        if (!list || list.length === 0) continue;
        lines.push(`## ${src.charAt(0).toUpperCase() + src.slice(1)}`, '');
        for (const item of list) {
            lines.push(`- **${(item.title || 'Untitled').replace(/\n/g, ' ')}**`);
            if (item.link) {
                lines.push(`  - [Link](${item.link})`);
            }
            if (item.date) {
                lines.push(`  - ${item.date}`);
            }
            if (item.summary) {
                lines.push(`  - ${(item.summary || '').replace(/\n/g, ' ').slice(0, 300)}${(item.summary || '').length > 300 ? '…' : ''}`);
            }
            lines.push('');
        }
        lines.push('');
    }
    return lines.join('\n');
}

/**
 * Write report to reportsDir/YYYY-MM-DD.md.
 * @param {string} reportsDir - Path to researchReview/reports directory
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} content - Markdown content
 * @param {{ fsSync?: { mkdirSync: Function, writeFileSync: Function } }} [opts] - for testing
 * @returns {string} Full path of written file
 */
function writeReportFile(reportsDir, dateStr, content, opts = {}) {
    const fsSync = (opts && opts.fsSync) || fs;
    if (!fsSync.existsSync(reportsDir)) {
        fsSync.mkdirSync(reportsDir, { recursive: true });
    }
    const filePath = path.join(reportsDir, `${dateStr}.md`);
    fsSync.writeFileSync(filePath, content, 'utf8');
    return filePath;
}

const VALID_DATE_STR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Generate and write daily report.
 * @param {Array<{ title: string, link: string, summary: string, source: string, date: string }>} items
 * @param {string} reportsDir
 * @param {string} [dateStr] - YYYY-MM-DD; defaults to today; invalid format falls back to today
 * @param {{ fsSync?: Object }}} [opts]
 * @returns {string} Path to written file
 */
function generateDailyReport(items, reportsDir, dateStr, opts = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const d = (dateStr && VALID_DATE_STR.test(dateStr)) ? dateStr : today;
    const content = generateReportMarkdown(items, d);
    return writeReportFile(reportsDir, d, content, opts);
}

module.exports = {
    generateReportMarkdown,
    writeReportFile,
    generateDailyReport
};
