const { fetchLinkedIn } = require('../../../../../business_modules/research/researchReview/fetchers/linkedinFetcher');

describe('linkedinFetcher', () => {
    test('returns empty when getApiKey returns null', async () => {
        const result = await fetchLinkedIn({ getApiKey: async () => null });
        expect(result).toEqual([]);
    });
});
