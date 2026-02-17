/**
 * Daily research runner: runs fetchers (arXiv, Medium, LinkedIn, X), aggregates results,
 * and writes one report per day to researchReview/reports/YYYY-MM-DD.md.
 * Schedule: once per day (extension or Cloud Run).
 */

const path = require('path');
const { fetchArxiv } = require('./fetchers/arxivFetcher');
const { fetchMedium } = require('./fetchers/mediumFetcher');
const { fetchLinkedIn } = require('./fetchers/linkedinFetcher');
const { fetchX } = require('./fetchers/xFetcher');
const { generateDailyReport } = require('./reportGenerator');

/**
 * Run all fetchers and return combined normalized items.
 * @param {Object} opts - fetch options (fetchFn, getBearerToken, getApiKey, usernames, etc.)
 * @returns {Promise<Array<{ title: string, link: string, summary: string, source: string, date: string }>>}
 */
async function runFetchers(opts = {}) {
    const fetchFn = opts.fetchFn || (typeof fetch === 'function' ? fetch : null);
    const arxivOpts = { fetchFn, maxResults: (opts.arxivMaxResults) != null ? opts.arxivMaxResults : 10 };
    const mediumOpts = { fetchFn, maxItems: (opts.mediumMaxItems) != null ? opts.mediumMaxItems : 10 };
    const linkedInOpts = { getApiKey: opts.getLinkedInApiKey, fetchFn };
    const xOpts = {
        fetchFn,
        getBearerToken: opts.getXBearerToken,
        usernames: opts.xUsernames || ['karpathy'],
        maxPerUser: opts.xMaxPerUser != null ? opts.xMaxPerUser : 5
    };

    const [arxiv, medium, linkedIn, x] = await Promise.all([
        fetchArxiv(arxivOpts),
        fetchMedium(mediumOpts),
        fetchLinkedIn(linkedInOpts),
        fetchX(xOpts)
    ]);

    return [...arxiv, ...medium, ...linkedIn, ...x];
}

/**
 * Run daily research: fetch from all sources and write report to reportsDir.
 * @param {string} reportsDir - Absolute path to researchReview/reports
 * @param {{ dateStr?: string, fetchFn?: Function, getXBearerToken?: Function, getLinkedInApiKey?: Function, xUsernames?: string[], loggerPort?: { error?: Function } }}} [opts]
 * @returns {Promise<{ reportPath: string, itemCount: number }>}
 */
async function runDailyResearch(reportsDir, opts = {}) {
    const logger = opts && opts.loggerPort;
    try {
        const items = await runFetchers({
            fetchFn: opts.fetchFn,
            getXBearerToken: opts.getXBearerToken,
            getLinkedInApiKey: opts.getLinkedInApiKey,
            xUsernames: opts.xUsernames
        });
        const dateStr = opts.dateStr || new Date().toISOString().slice(0, 10);
        const reportPath = generateDailyReport(items, reportsDir, dateStr, opts);
        return { reportPath, itemCount: items.length };
    } catch (err) {
        if (logger && logger.error) logger.error('Daily research run failed', err);
        throw err;
    }
}

/**
 * Create a scheduler that runs daily research once per calendar day when run() is called.
 * Call run() from a daily timer (e.g. extension setInterval 24h or cron).
 * @param {Object} opts - { getReportsDir: () => string, getXBearerToken?: () => Promise<string|null>, getLinkedInApiKey?: () => Promise<string|null>, xUsernames?: string[], loggerPort?, fetchFn? }
 * @returns {{ run: () => Promise<{ reportPath?: string, itemCount?: number }>, runFetchers: typeof runFetchers }}
 */
function createDailyResearchRunner(opts) {
    const getReportsDir = (opts && opts.getReportsDir) || (() => path.join(__dirname, 'reports'));

    async function run() {
        const reportsDir = getReportsDir();
        return runDailyResearch(reportsDir, {
            getXBearerToken: opts && opts.getXBearerToken,
            getLinkedInApiKey: opts && opts.getLinkedInApiKey,
            xUsernames: opts && opts.xUsernames,
            loggerPort: opts && opts.loggerPort,
            fetchFn: opts && opts.fetchFn
        });
    }

    return { run, runFetchers };
}

module.exports = {
    runFetchers,
    runDailyResearch,
    createDailyResearchRunner
};
