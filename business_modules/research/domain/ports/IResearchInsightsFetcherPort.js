/**
 * Port: fetch normalized insight items from all sources (arXiv, Medium, LinkedIn, X).
 * Implemented by composite insights fetcher adapter.
 * @abstract
 */
class IResearchInsightsFetcherPort {
    /**
     * @param {Object} [opts] - fetchFn, getXBearerToken, getLinkedInApiKey, arxivMaxResults, mediumMaxItems, xUsernames, xMaxPerUser, etc.
     * @returns {Promise<Array<{ title?: string, link?: string, summary?: string, source: string, date?: string }>>} NormalizedItem[]
     */
    async fetch(opts) {
        if (new.target === IResearchInsightsFetcherPort) {
            throw new Error('IResearchInsightsFetcherPort is abstract');
        }
        throw new Error('fetch() must be implemented');
    }
}

module.exports = { IResearchInsightsFetcherPort };
