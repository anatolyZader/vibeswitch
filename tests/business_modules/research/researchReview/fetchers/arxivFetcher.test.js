const { fetchArxiv, parseAtomEntries } = require('../../../../../business_modules/research/researchReview/fetchers/arxivFetcher');

describe('arxivFetcher', () => {
    test('parseAtomEntries extracts entry fields', () => {
        const xml = '<feed><entry><title>AI Coding</title><id>http://arxiv.org/abs/1234</id><updated>2025-01-15</updated></entry></feed>';
        const entries = parseAtomEntries(xml);
        expect(entries.length).toBe(1);
        expect(entries[0].title).toContain('AI');
        expect(entries[0].date).toContain('2025');
    });
    test('fetchArxiv returns empty when fetchFn is null', async () => {
        const out = await fetchArxiv({ fetchFn: null });
        expect(out).toEqual([]);
    });
    test('fetchArxiv returns items with source arxiv on success', async () => {
        const xml = '<feed><entry><title>T</title><id>https://arxiv.org/abs/1</id><updated>2025-01-01</updated></entry></feed>';
        const fetchFn = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(xml) });
        const out = await fetchArxiv({ fetchFn });
        expect(out.length).toBe(1);
        expect(out[0].source).toBe('arxiv');
    });
});
