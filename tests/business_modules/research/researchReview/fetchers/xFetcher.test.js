const { fetchX, getUserIdByUsername, getUserTweets } = require('../../../../../business_modules/research/researchReview/fetchers/xFetcher');

describe('xFetcher', () => {
    test('fetchX returns empty when getBearerToken returns null', async () => {
        const result = await fetchX({ getBearerToken: async () => null });
        expect(result).toEqual([]);
    });
    test('getUserIdByUsername returns id from API', async () => {
        const fetchFn = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { id: '123' } }) });
        const id = await getUserIdByUsername('karpathy', fetchFn, 'token');
        expect(id).toBe('123');
    });
    test('fetchX returns normalized items when token and fetch succeed', async () => {
        const fetchFn = jest.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: { id: 'uid' } }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [{ id: 't1', text: 'Tweet', created_at: '2025-01-01' }] }) });
        const result = await fetchX({ getBearerToken: async () => 'bearer', fetchFn, usernames: ['karpathy'] });
        expect(result).toHaveLength(1);
        expect(result[0].source).toBe('x');
    });
});
