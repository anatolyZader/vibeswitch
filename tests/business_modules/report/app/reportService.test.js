/**
 * ReportService.publishReport - spec-first TDD tests from docs/specs/spec-report.md.
 * Covers input/output table, edge cases, error cases. No implementation in red phase.
 */
const ReportService = require('../../../../business_modules/report/app/reportService');

describe('ReportService.publishReport', () => {
    // --- Input/Output (spec table) ---

    test('content + platforms [medium] calls Medium adapter and returns medium result when adapter succeeds', async () => {
        const mediumAdapter = { publish: jest.fn().mockResolvedValue({ success: true, postId: 'p1', url: 'https://medium.com/p1' }) };
        const service = new ReportService({ publishAdapters: { medium: mediumAdapter } });
        const result = await service.publishReport(
            { content: '## Summary\n\nKey findings...' },
            { platforms: ['medium'] }
        );
        expect(mediumAdapter.publish).toHaveBeenCalledWith('## Summary\n\nKey findings...', expect.anything());
        expect(result).toEqual({ medium: { success: true, postId: 'p1', url: 'https://medium.com/p1' } });
    });

    test('content + platforms [x] calls X adapter and returns x result when adapter succeeds', async () => {
        const xAdapter = { publish: jest.fn().mockResolvedValue({ success: true, postId: 'x1', url: 'https://x.com/x1' }) };
        const service = new ReportService({ publishAdapters: { x: xAdapter } });
        const result = await service.publishReport(
            { content: 'Short post' },
            { platforms: ['x'] }
        );
        expect(xAdapter.publish).toHaveBeenCalledWith('Short post', expect.anything());
        expect(result).toEqual({ x: { success: true, postId: 'x1', url: 'https://x.com/x1' } });
    });

    test('content + platforms [medium, linkedin, x] calls all three adapters and returns object with medium, linkedin, x', async () => {
        const mediumAdapter = { publish: jest.fn().mockResolvedValue({ success: true, postId: 'm1', url: 'https://medium.com/m1' }) };
        const linkedInAdapter = { publish: jest.fn().mockResolvedValue({ success: true, postId: 'l1', url: 'https://linkedin.com/l1' }) };
        const xAdapter = { publish: jest.fn().mockResolvedValue({ success: true, postId: 'x1', url: 'https://x.com/x1' }) };
        const service = new ReportService({
            publishAdapters: { medium: mediumAdapter, linkedin: linkedInAdapter, x: xAdapter }
        });
        const result = await service.publishReport(
            { content: '...' },
            { platforms: ['medium', 'linkedin', 'x'] }
        );
        expect(result).toHaveProperty('medium');
        expect(result).toHaveProperty('linkedin');
        expect(result).toHaveProperty('x');
        expect(result.medium.success).toBe(true);
        expect(result.linkedin.success).toBe(true);
        expect(result.x.success).toBe(true);
    });

    test('reportPath option reads file content then same behavior as content', async () => {
        const readReportPathPort = { read: jest.fn().mockResolvedValue('file content here') };
        const mediumAdapter = { publish: jest.fn().mockResolvedValue({ success: true, postId: 'p1', url: 'https://medium.com/p1' }) };
        const service = new ReportService({
            publishAdapters: { medium: mediumAdapter },
            readReportPathPort
        });
        const result = await service.publishReport(
            { reportPath: '/path/to/2025-02-20.md' },
            { platforms: ['medium'] }
        );
        expect(readReportPathPort.read).toHaveBeenCalledWith('/path/to/2025-02-20.md');
        expect(mediumAdapter.publish).toHaveBeenCalledWith('file content here', expect.anything());
        expect(result.medium.success).toBe(true);
    });

    test('empty content returns per-platform failure with error (no throw)', async () => {
        const mediumAdapter = { publish: jest.fn() };
        const service = new ReportService({ publishAdapters: { medium: mediumAdapter } });
        const result = await service.publishReport({ content: '' }, { platforms: ['medium'] });
        expect(result).toHaveProperty('medium');
        expect(result.medium.success).toBe(false);
        expect(result.medium.error).toBeDefined();
        expect(typeof result.medium.error).toBe('string');
    });

    test('very long content for X truncates or succeeds (X adapter or service truncates)', async () => {
        const longText = 'a'.repeat(400);
        const xAdapter = { publish: jest.fn().mockResolvedValue({ success: true, postId: 'x1', url: 'https://x.com/x1' }) };
        const service = new ReportService({ publishAdapters: { x: xAdapter } });
        const result = await service.publishReport(
            { content: longText },
            { platforms: ['x'] }
        );
        expect(result.x.success).toBe(true);
        const calledContent = xAdapter.publish.mock.calls[0][0];
        expect(calledContent.length).toBeLessThanOrEqual(280 + 10);
    });

    test('missing credentials for a platform returns success false and error for that platform (no throw)', async () => {
        const mediumAdapter = { publish: jest.fn().mockResolvedValue({ success: false, error: 'Missing credentials' }) };
        const service = new ReportService({ publishAdapters: { medium: mediumAdapter } });
        const result = await service.publishReport(
            { content: 'Hello' },
            { platforms: ['medium'] }
        );
        expect(result.medium.success).toBe(false);
        expect(result.medium.error).toMatch(/missing credentials/i);
    });

    test('adapter throw is caught and returned as success false with error (publishReport does not throw)', async () => {
        const mediumAdapter = { publish: jest.fn().mockRejectedValue(new Error('Network error')) };
        const service = new ReportService({ publishAdapters: { medium: mediumAdapter } });
        const result = await service.publishReport(
            { content: 'Hello' },
            { platforms: ['medium'] }
        );
        expect(result.medium.success).toBe(false);
        expect(result.medium.error).toBeDefined();
        expect(typeof result.medium.error).toBe('string');
    });

    // --- Edge cases ---

    test('content undefined when using content input returns failure or throws clear message', async () => {
        const service = new ReportService({ publishAdapters: {} });
        try {
            const result = await service.publishReport({}, { platforms: ['medium'] });
            expect(result.medium).toBeDefined();
            expect(result.medium.success).toBe(false);
            expect(result.medium.error).toBeDefined();
        } catch (e) {
            expect(e.message).toBeDefined();
        }
    });

    test('reportPath provided but file does not exist returns error (no platform calls)', async () => {
        const readReportPathPort = { read: jest.fn().mockRejectedValue(new Error('ENOENT')) };
        const mediumAdapter = { publish: jest.fn() };
        const service = new ReportService({
            publishAdapters: { medium: mediumAdapter },
            readReportPathPort
        });
        const result = await service.publishReport(
            { reportPath: '/nonexistent.md' },
            { platforms: ['medium'] }
        );
        expect(mediumAdapter.publish).not.toHaveBeenCalled();
        expect(result.error != null || result.reportPath != null).toBe(true);
    });

    // --- Error cases ---

    test('content not a string when using content input returns or throws clear message', async () => {
        const service = new ReportService({ publishAdapters: {} });
        try {
            const result = await service.publishReport({ content: 123 }, { platforms: ['medium'] });
            expect(result.medium).toBeDefined();
            expect(result.medium.success).toBe(false);
            expect(result.medium.error).toMatch(/content|string|invalid/i);
        } catch (e) {
            expect(e.message).toMatch(/content|string|invalid/i);
        }
    });

    test('reportPath not a string returns or throws clear message', async () => {
        const service = new ReportService({ publishAdapters: {}, readReportPathPort: {} });
        try {
            const result = await service.publishReport({ reportPath: 999 }, { platforms: ['medium'] });
            expect(result.medium).toBeDefined();
            expect(result.medium.success).toBe(false);
        } catch (e) {
            expect(e.message).toMatch(/reportPath|path|invalid/i);
        }
    });

    test('unknown platform in platforms array returns success false for that key with error Unknown platform', async () => {
        const service = new ReportService({ publishAdapters: {} });
        const result = await service.publishReport(
            { content: 'Hi' },
            { platforms: ['medium', 'unknownPlatform'] }
        );
        expect(result.medium).toBeDefined();
        expect(result.unknownPlatform).toBeDefined();
        expect(result.unknownPlatform.success).toBe(false);
        expect(result.unknownPlatform.error).toMatch(/unknown platform/i);
    });

    test('result shape: plain object with only requested platform keys; each value has success and optional postId, url, error', async () => {
        const mediumAdapter = { publish: jest.fn().mockResolvedValue({ success: true, postId: 'p1', url: 'https://m.com/p1' }) };
        const service = new ReportService({ publishAdapters: { medium: mediumAdapter } });
        const result = await service.publishReport({ content: 'x' }, { platforms: ['medium'] });
        expect(result).toEqual({ medium: { success: true, postId: 'p1', url: 'https://m.com/p1' } });
        expect(Object.keys(result)).toEqual(['medium']);
    });

    test('Unicode and special characters in content are passed to adapter', async () => {
        const content = 'Summary \u{1F4CA} emoji and café naïve';
        const mediumAdapter = { publish: jest.fn().mockResolvedValue({ success: true, postId: 'p1', url: 'https://m.com/p1' }) };
        const service = new ReportService({ publishAdapters: { medium: mediumAdapter } });
        await service.publishReport({ content }, { platforms: ['medium'] });
        expect(mediumAdapter.publish).toHaveBeenCalledWith(content, expect.anything());
    });
});
