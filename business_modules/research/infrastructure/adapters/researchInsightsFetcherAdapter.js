/**
 * Adapter: implements IResearchInsightsFetcherPort by running all fetchers (arXiv, Medium, LinkedIn, X) and concatenating.
 */
const { runFetchers } = require('../../researchReview/dailyResearchRunner');

/**
 * Create an insights fetcher adapter that implements IResearchInsightsFetcherPort.
 * @returns {{ fetch: (opts?: Object) => Promise<Array<{ title?: string, link?: string, summary?: string, source: string, date?: string }>> }}
 */
function createResearchInsightsFetcherAdapter() {
    return {
        async fetch(opts = {}) {
            return runFetchers(opts);
        }
    };
}

module.exports = {
    createResearchInsightsFetcherAdapter
};
