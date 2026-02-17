/**
 * Placeholder for LinkedIn-sourced research insights (e.g. professional posts on AI-assisted coding).
 * LinkedIn API requires OAuth and approved app; use getApiKey() when configured.
 * Returns normalized items: { title, link, summary, source, date }.
 */

/**
 * Fetch LinkedIn insights. Currently returns empty array; extend when API key is configured.
 * @param {{ getApiKey?: () => Promise<string|null>, fetchFn?: (url: string, opts?: RequestInit) => Promise<Response> }} [opts]
 * @returns {Promise<Array<{ title: string, link: string, summary: string, source: string, date: string }>>}
 */
async function fetchLinkedIn(opts = {}) {
    const getApiKey = (opts && opts.getApiKey) || (async () => null);
    const apiKey = await getApiKey().catch(() => null);
    if (!apiKey || typeof apiKey !== 'string') {
        return [];
    }
    // TODO: when LinkedIn API is enabled, call their API and normalize to { title, link, summary, source: 'linkedin', date }
    return [];
}

module.exports = {
    fetchLinkedIn
};
