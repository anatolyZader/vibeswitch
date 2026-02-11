/**
 * Unit tests for InsightsWriter.
 */

const path = require('path');
const fs = require('fs');
const InsightsWriter = require('../../../business_modules/dashboard-chat/app/InsightsWriter');

describe('InsightsWriter', () => {
    const tmpDir = path.join(__dirname, '../../../../.tmp-insights-test');
    let extensionPath;

    beforeAll(() => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
        fs.mkdirSync(tmpDir, { recursive: true });
        extensionPath = tmpDir;
    });

    afterAll(() => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    });

    describe('validateFilename', () => {
        it('rejects path traversal', () => {
            expect(InsightsWriter.validateFilename('../../../etc/passwd.md').valid).toBe(false);
        });
        it('accepts valid generated names', () => {
            expect(InsightsWriter.validateFilename('architecture-review_2026-02-11T14-30-45-123Z.md').valid).toBe(true);
        });
    });

    describe('validateContent', () => {
        it('rejects script tags', () => {
            expect(InsightsWriter.validateContent('<script>alert(1)</script>').safe).toBe(false);
        });
        it('accepts plain markdown', () => {
            expect(InsightsWriter.validateContent('# Hello\n\nPlain markdown.').safe).toBe(true);
        });
    });

    describe('writeInsight', () => {
        it('creates file in insights subdir', async () => {
            const result = await InsightsWriter.writeInsight(extensionPath, 'test-insight', '# Test\n\nContent.', { title: 'Test' });
            expect(result.success).toBe(true);
            expect(result.path).toContain('insights');
            expect(result.path).toContain('.md');
            const fullPath = path.join(extensionPath, result.path);
            expect(fs.existsSync(fullPath)).toBe(true);
        });
    });
});
