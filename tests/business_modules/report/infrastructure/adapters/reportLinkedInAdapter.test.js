/**
 * ReportLinkedInAdapter unit tests — publish to LinkedIn. Mocked HTTP/secrets (TDD Red phase).
 */
const { ReportLinkedInAdapter } = require('../../../../../business_modules/report/infrastructure/adapters/reportLinkedInAdapter');

describe('ReportLinkedInAdapter', () => {
    test('publish(content) returns shape { ok, publishedId?, error? }', async () => {
        const getAccessToken = jest.fn().mockResolvedValue('token');
        const fetchFn = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ id: 'urn:li:share:1' })
        });
        const adapter = new ReportLinkedInAdapter({ getAccessToken, fetchFn });
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

    test('when getAccessToken returns null, publish returns ok false with error', async () => {
        const getAccessToken = jest.fn().mockResolvedValue(null);
        const adapter = new ReportLinkedInAdapter({ getAccessToken });
        const result = await adapter.publish('Hello');
        expect(result.ok).toBe(false);
        expect(result.error).toBeDefined();
    });
});
