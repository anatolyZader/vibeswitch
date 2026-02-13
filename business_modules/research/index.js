/**
 * Research module: time-series collection, statistical analysis, and report generation.
 * Public API: createResearchService(opts) -> Promise<ResearchService>
 */

const { createResearchService } = require('./app/ResearchService');
const { createResearchDbAdapter } = require('./infrastructure/ResearchDbAdapter');
const { createTimeSeriesCollector } = require('./app/TimeSeriesCollector');
const { analyze } = require('./app/StatisticalAnalyzer');
const { buildReport } = require('./app/ResearchReportBuilder');

module.exports = {
    createResearchService,
    createResearchDbAdapter,
    createTimeSeriesCollector,
    analyze,
    buildReport
};
