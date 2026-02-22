/**
 * ReportXAdapter unit tests — publish to X (Twitter). Mocked HTTP/secrets (TDD Red phase).
 */
const { ReportXAdapter } = require('../../../../../business_modules/report/infrastructure/adapters/reportXAdapter');

describe('ReportXAdapter', () => {
    test('publish(content) returns shape { ok, publishedId?, error? }', async () => {
        const getBearerToken = jest.fn().mockResolvedValue('token');
        const fetchFn = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ data: { id: '123' } })
        });
        const adapter = new ReportXAdapter({ getBearerToken, fetchFn });
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

    test('when getBearerToken returns null, publish returns ok false with error', async () => {
        const getBearerToken = jest.fn().mockResolvedValue(null);
        const adapter = new ReportXAdapter({ getBearerToken });
        const result = await adapter.publish('Hello');
        expect(result.ok).toBe(false);
        expect(result.error).toBeDefined();
    });
});
