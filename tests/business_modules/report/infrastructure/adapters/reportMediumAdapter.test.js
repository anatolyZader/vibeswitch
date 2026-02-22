/**
 * ReportMediumAdapter unit tests — publish to Medium. Mocked HTTP/secrets (TDD Red phase).
 */
const { ReportMediumAdapter } = require('../../../../../business_modules/report/infrastructure/adapters/reportMediumAdapter');

describe('ReportMediumAdapter', () => {
    test('publish(content) returns shape { ok, publishedId?, error? }', async () => {
        const getIntegrationToken = jest.fn().mockResolvedValue('token');
        const fetchFn = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ data: { id: 'medium-post-1' } })
        });
        const adapter = new ReportMediumAdapter({ getIntegrationToken, fetchFn });
        const result = await adapter.publish('Hello world');
        expect(result).toHaveProperty('ok');
        expect(typeof result.ok).toBe('boolean');
        if (result.ok) {
            expect(result).toHaveProperty('publishedId');
        } else {
            expect(result).toHaveProperty('error');
            expect(typeof result.error).toBe('string');
        }
    });

    test('when getIntegrationToken returns null, publish returns ok false with error', async () => {
        const getIntegrationToken = jest.fn().mockResolvedValue(null);
        const adapter = new ReportMediumAdapter({ getIntegrationToken });
        const result = await adapter.publish('Hello');
        expect(result.ok).toBe(false);
        expect(result.error).toBeDefined();
    });
});
