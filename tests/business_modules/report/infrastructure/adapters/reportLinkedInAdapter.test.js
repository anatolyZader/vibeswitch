const ReportLinkedInAdapter = require('../../../../../business_modules/report/infrastructure/adapters/reportLinkedInAdapter');
const IReportPublishPort = require('../../../../../business_modules/report/domain/ports/IReportPublishPort');

describe('ReportLinkedInAdapter', () => {
    test('implements IReportPublishPort (has publish method)', () => {
        const adapter = new ReportLinkedInAdapter();
        expect(adapter).toBeInstanceOf(IReportPublishPort);
        expect(typeof adapter.publish).toBe('function');
    });

    test('publish with mocked HTTP 201 returns PlatformResult with success true, postId, url', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ id: 'li-1', url: 'https://linkedin.com/feed/li-1' })
        });
        const adapter = new ReportLinkedInAdapter({ fetch: mockFetch });
        const result = await adapter.publish('Hello LinkedIn', {});
        expect(result).toMatchObject({ success: true });
        expect(result.postId).toBeDefined();
        expect(result.url).toBeDefined();
    });
});
