/**
 * ReportXAdapter - implements IReportPublishPort for X.com. Unit tests with mocked HTTP.
 */
const ReportXAdapter = require('../../../../../business_modules/report/infrastructure/adapters/reportXAdapter');
const IReportPublishPort = require('../../../../../business_modules/report/domain/ports/IReportPublishPort');

describe('ReportXAdapter', () => {
    test('implements IReportPublishPort (has publish method)', () => {
        const adapter = new ReportXAdapter();
        expect(adapter).toBeInstanceOf(IReportPublishPort);
        expect(typeof adapter.publish).toBe('function');
    });

    test('publish with content over 280 chars truncates and returns success true', async () => {
        const longContent = 'a'.repeat(400);
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ data: { id: 'x-1' }, url: 'https://x.com/x-1' })
        });
        const adapter = new ReportXAdapter({ fetch: mockFetch });
        const result = await adapter.publish(longContent, {});
        expect(result).toMatchObject({ success: true });
        expect(result.postId).toBeDefined();
    });
});
