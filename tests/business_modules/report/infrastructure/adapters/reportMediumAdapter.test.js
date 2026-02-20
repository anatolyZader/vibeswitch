const ReportMediumAdapter = require('../../../../../business_modules/report/infrastructure/adapters/reportMediumAdapter');
const IReportPublishPort = require('../../../../../business_modules/report/domain/ports/IReportPublishPort');

describe('ReportMediumAdapter', () => {
    test('implements IReportPublishPort (has publish method)', () => {
        const adapter = new ReportMediumAdapter();
        expect(adapter).toBeInstanceOf(IReportPublishPort);
        expect(typeof adapter.publish).toBe('function');
    });

    test('publish with mocked HTTP 200 returns PlatformResult with success true, postId, url', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ id: 'medium-post-1', url: 'https://medium.com/p/medium-post-1' })
        });
        const adapter = new ReportMediumAdapter({ fetch: mockFetch });
        const result = await adapter.publish('## Hello', {});
        expect(result).toMatchObject({ success: true });
        expect(result.postId).toBeDefined();
        expect(result.url).toBeDefined();
    });
});
