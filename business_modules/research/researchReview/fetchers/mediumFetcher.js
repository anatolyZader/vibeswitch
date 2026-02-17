/**
 * Fetches research insights from Medium (RSS) for AI-assisted coding / antipatterns.
 * No API key required. Returns normalized items: { title, link, summary, source, date }.
 */

const MEDIUM_TAG_RSS = 'https://medium.com/feed/tag/ai-assisted-coding';
const DEFAULT_MAX_ITEMS = 10;

/**
 * Parse RSS XML and extract items.
 * @param {string} xml
 * @param {number} maxItems
 * @returns {Array<{ title: string, link: string, summary: string, date: string }>}
 */
function parseRssItems(xml, maxItems = DEFAULT_MAX_ITEMS) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = itemRegex.exec(xml)) !== null && items.length < maxItems) {
        const block = m[1];
        const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block);
        const link = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(block) || /<link[^>]+href="([^"]+)"[^>]*\/?>/i.exec(block);
        const description = /<description[^>]*>([\s\S]*?)<\/description>/i.exec(block);
        const pubDate = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i.exec(block);
        const strip = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const linkVal = link ? (link[1] || '').trim() : '';
        items.push({
            title: strip(title ? title[1] : ''),
            link: linkVal,
            summary: strip(description ? description[1] : '').slice(0, 500),
            date: (pubDate && pubDate[1]) ? pubDate[1].trim() : ''
        });
    }
    return items;
}

/**
 * Fetch Medium RSS for AI-assisted coding tag.
 * @param {{ feedUrl?: string, maxItems?: number, fetchFn?: (url: string) => Promise<Response> }} [opts]
 * @returns {Promise<Array<{ title: string, link: string, summary: string, source: string, date: string }>>}
 */
async function fetchMedium(opts = {}) {
    const feedUrl = (opts && opts.feedUrl) || MEDIUM_TAG_RSS;
    const maxItems = (opts && opts.maxItems) != null ? opts.maxItems : DEFAULT_MAX_ITEMS;
    const fetchFn = (opts && opts.fetchFn) || (typeof fetch === 'function' ? fetch : null);
    if (!fetchFn) {
        return [];
    }
    try {
        const res = await fetchFn(feedUrl);
        if (!res.ok) return [];
        const text = await res.text();
        const entries = parseRssItems(text, maxItems);
        return entries.map((e) => ({ ...e, source: 'medium' }));
    } catch (_) {
        return [];
    }
}

module.exports = {
    fetchMedium,
    parseRssItems,
    MEDIUM_TAG_RSS,
    DEFAULT_MAX_ITEMS
};
