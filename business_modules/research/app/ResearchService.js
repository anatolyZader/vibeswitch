/**
 * ResearchService: orchestrates time-series collection, scheduled research runs, and report output.
 */

const path = require('path');
const { getGlobalKey, setGlobalKey } = require('../../../cross_cut_modules/storage-uri/globalKeysStorage');
const { createResearchDbAdapter } = require('../infrastructure/ResearchDbAdapter');
const { createTimeSeriesCollector } = require('./TimeSeriesCollector');
const { analyze } = require('./StatisticalAnalyzer');
const { buildReport } = require('./ResearchReportBuilder');

/**
 * @param {Object} opts
 * @param {import('vscode').ExtensionContext} [opts.context]
 * @param {Object} [opts.state] - Extension state (awarenessEngine, tokenUsageClient, extensionContext)
 * @param {Object} [opts.loggerPort]
 * @returns {Promise<ResearchService>}
 */
async function createResearchService(opts) {
    const { context, state, loggerPort, dbPath: dbPathOverride } = opts || {};
    const vscode = require('vscode');

    const dbPath = dbPathOverride || path.join(require('os').homedir(), '.vibeswitch', 'research', 'research.db');
    const dbAdapter = await createResearchDbAdapter(dbPath);
    const collector = createTimeSeriesCollector(dbAdapter, { loggerPort });

    const scheduleHours = (vscode.workspace && vscode.workspace.getConfiguration('vibeswitch.research').get('scheduleHours', 24)) || 24;
    const intervalMs = scheduleHours * 60 * 60 * 1000;

    let pollTimer = null;
    let researchTimer = null;

    const service = {
        _db: dbAdapter,
        _collector: collector,
        _state: state,

        /**
         * Sample payload for time-series (call from meter update or onScoreUpdate).
         */
        sample(payload) {
            if (collector && collector.sample) {
                collector.sample(payload);
            }
        },

        /**
         * Run one research cycle: analyze, build report, write to insights.
         */
        async run() {
            try {
                const rows = dbAdapter.queryTimeSeries({ since: null, limit: 10000 });
                const analysisResults = analyze(rows);

                const literatureSummary = null;
                const meta = { sampleSize: rows.length };
                const reportContent = buildReport(analysisResults, literatureSummary, meta);

                const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                for (const r of analysisResults) {
                    if (r.method !== 'none') {
                        dbAdapter.insertAnalysisResult({
                            runId,
                            method: r.method,
                            design: r.design,
                            equations: r.equations,
                            findings: r.findings,
                            pValues: r.pValues
                        });
                    }
                }

                const extensionPath = state && state.extensionContext && state.extensionContext.extensionPath;
                if (extensionPath) {
                    const InsightsWriter = require('../../dashboard-chat/app/InsightsWriter');
                    const filename = 'research-' + runId;
                    await InsightsWriter.writeInsight(extensionPath, filename, reportContent, {
                        title: 'Research Report ' + runId,
                        provider: 'research-module'
                    });
                }
            } catch (err) {
                if (loggerPort && loggerPort.error) {
                    loggerPort.error('ResearchService: run failed', err);
                }
            }
        },

        start() {
            const pollIntervalMs = 5 * 60 * 1000;
            pollTimer = setInterval(() => {
                this._pollAndSample();
            }, pollIntervalMs);
            this._pollAndSample();

            researchTimer = setInterval(() => {
                this.run();
            }, intervalMs);

            const lastRunKey = 'vibeswitch.research.lastRun';
            if (context) {
                const lastRun = getGlobalKey(context, lastRunKey, 0);
                const now = Date.now();
                if (now - lastRun > intervalMs) {
                    this.run().then(() => setGlobalKey(context, lastRunKey, now));
                }
            }
        },

        async _pollAndSample() {
            const state = this._state;
            if (!state || !state.awarenessEngine) return;

            try {
                let scoreData = null;
                let antipatternBreakdown = null;
                let tokenUsage = null;

                if (typeof state.awarenessEngine.getScore === 'function') {
                    scoreData = state.awarenessEngine.getScore();
                }
                if (typeof state.awarenessEngine.getAntipatternBreakdownAsync === 'function') {
                    antipatternBreakdown = await state.awarenessEngine.getAntipatternBreakdownAsync();
                } else if (typeof state.awarenessEngine.getAntipatternBreakdown === 'function') {
                    antipatternBreakdown = state.awarenessEngine.getAntipatternBreakdown();
                }
                if (state.tokenUsageClient && typeof state.tokenUsageClient.fetchTokenUsage === 'function') {
                    tokenUsage = await state.tokenUsageClient.fetchTokenUsage().catch(() => null);
                }

                const payload = {
                    scoreData: scoreData || {},
                    antipatternBreakdown: antipatternBreakdown || {},
                    tokenUsage: tokenUsage || { totalInput: 0, totalOutput: 0, totalTokens: 0 }
                };
                this.sample(payload);
            } catch (_) {
                // ignore
            }
        },

        dispose() {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
            if (researchTimer) {
                clearInterval(researchTimer);
                researchTimer = null;
            }
            if (this._db && this._db.close) {
                this._db.close();
            }
        }
    };

    return service;
}

module.exports = {
    createResearchService
};
