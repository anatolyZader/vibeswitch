const { fetchMedium, parseRssItems } = require('../../../../../business_modules/research/researchReview/fetchers/mediumFetcher');

describe('mediumFetcher', () => {
    test('parseRssItems extracts title link date', () => {
        const xml = '<rss><channel><item><title>AI Coding</title><link>https://medium.com/p/123</link><pubDate>2025-01-01</pubDate></item></channel></rss>';
        const items = parseRssItems(xml, 10);
        expect(items).toHaveLength(1);
        expect(items[0].title).toContain('AI Coding');
    });
    test('fetchMedium returns items with source medium when fetch succeeds', async () => {
        const xml = '<rss><channel><item><title>M</title><link>https://m.com/1</link><pubDate>2025-01-01</pubDate></item></channel></rss>';
        const fetchFn = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(xml) });
        const result = await fetchMedium({ fetchFn });
        expect(result).toHaveLength(1);
        expect(result[0].source).toBe('medium');
    });
});
