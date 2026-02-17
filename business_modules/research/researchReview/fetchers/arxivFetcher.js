/**
 * Fetches research insights from arXiv (AI-assisted coding, antipatterns).
 * No API key required. Returns normalized items: { title, link, summary, source, date }.
 */

const ARXIV_BASE = 'https://export.arxiv.org/api/query';
const DEFAULT_QUERY = 'all:AI+assisted+coding+OR+all:code+antipattern+OR+all:LLM+software+engineering';
const DEFAULT_MAX_RESULTS = 10;

/**
 * Parse Atom XML response and extract entries.
 * @param {string} xml
 * @returns {Array<{ title: string, link: string, summary: string, date: string }>}
 */
function parseAtomEntries(xml) {
    const items = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    let m;
    while ((m = entryRegex.exec(xml)) !== null) {
        const block = m[1];
        const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block);
        const id = /<id[^>]*>([\s\S]*?)<\/id>/i.exec(block);
        const summary = /<summary[^>]*>([\s\S]*?)<\/summary>/i.exec(block);
        const updated = /<updated[^>]*>([\s\S]*?)<\/updated>/i.exec(block);
        const link = /<link[^>]+href="([^"]+)"[^>]*\/?>/i.exec(block);
        const strip = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        items.push({
            title: strip(title ? title[1] : ''),
            link: (link && link[1]) ? link[1] : (id && id[1]) ? id[1] : '',
            summary: strip(summary ? summary[1] : '').slice(0, 500),
            date: (updated && updated[1]) ? updated[1] : ''
        });
    }
    return items;
}

/**
 * Fetch arXiv results for AI-assisted coding / antipatterns.
 * @param {{ searchQuery?: string, maxResults?: number, fetchFn?: (url: string) => Promise<Response> }} [opts]
 * @returns {Promise<Array<{ title: string, link: string, summary: string, source: string, date: string }>>}
 */
async function fetchArxiv(opts = {}) {
    const searchQuery = (opts && opts.searchQuery) || DEFAULT_QUERY;
    const maxResults = (opts && opts.maxResults) != null ? opts.maxResults : DEFAULT_MAX_RESULTS;
    const fetchFn = (opts && opts.fetchFn) || (typeof fetch === 'function' ? fetch : null);
    if (!fetchFn) {
        return [];
    }
    const url = `${ARXIV_BASE}?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=${maxResults}`;
    try {
        const res = await fetchFn(url);
        if (!res.ok) return [];
        const text = await res.text();
        const entries = parseAtomEntries(text);
        return entries.map((e) => ({ ...e, source: 'arxiv' }));
    } catch (_) {
        return [];
    }
}

module.exports = {
    fetchArxiv,
    parseAtomEntries,
    DEFAULT_QUERY,
    DEFAULT_MAX_RESULTS
};
