/**
 * Tests for InsightsWriter - safe markdown file creation
 */

const { createInsight, listInsights, generateFilename, getInsightsDir } = require('../../../business_modules/dashboard-chat/app/InsightsWriter');
const fs = require('fs');
const path = require('path');

describe('InsightsWriter', () => {
    const testExtensionPath = '/tmp/vibeswitch-test';
    const testInsightsDir = path.join(testExtensionPath, 'business_modules', 'dashboard-chat', 'insights');

    beforeEach(() => {
        // Clean up test directory
        if (fs.existsSync(testInsightsDir)) {
            fs.rmSync(testInsightsDir, { recursive: true, force: true });
        }
    });

    afterEach(() => {
        // Clean up after tests
        if (fs.existsSync(testExtensionPath)) {
            fs.rmSync(testExtensionPath, { recursive: true, force: true });
        }
    });

    describe('generateFilename', () => {
        it('should generate filename with default prefix', () => {
            const filename = generateFilename();
            expect(filename).toMatch(/^insight_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.md$/);
        });

        it('should generate filename with custom prefix', () => {
            const filename = generateFilename('review');
            expect(filename).toMatch(/^review_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.md$/);
        });
    });

    describe('getInsightsDir', () => {
        it('should construct correct path', () => {
            const dir = getInsightsDir(testExtensionPath);
            expect(dir).toBe(testInsightsDir);
        });

        it('should throw when no extension path provided', () => {
            expect(() => getInsightsDir(null)).toThrow();
        });
    });

    describe('createInsight', () => {
        it('should create insight with auto-generated filename', async () => {
            const result = await createInsight(testExtensionPath, {
                title: 'Test Insight',
                content: '# Test Content\n\nThis is a test.'
            });

            expect(result.success).toBe(true);
            expect(result.filename).toMatch(/^insight_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.md$/);
            expect(fs.existsSync(result.path)).toBe(true);

            const fileContent = fs.readFileSync(result.path, 'utf8');
            expect(fileContent).toContain('title: Test Insight');
            expect(fileContent).toContain('# Test Content');
        });

        it('should create insight with custom filename', async () => {
            const result = await createInsight(testExtensionPath, {
                title: 'Custom Test',
                content: 'Custom content',
                filename: 'my-custom-insight.md'
            });

            expect(result.success).toBe(true);
            expect(result.filename).toBe('my-custom-insight.md');
            expect(fs.existsSync(result.path)).toBe(true);
        });

        it('should reject invalid filename', async () => {
            const result = await createInsight(testExtensionPath, {
                content: 'Test',
                filename: '../../../etc/passwd'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid filename');
        });

        it('should reject empty content', async () => {
            const result = await createInsight(testExtensionPath, {
                content: ''
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('non-empty string');
        });

        it('should reject oversized content', async () => {
            const largeContent = 'x'.repeat(600000);
            const result = await createInsight(testExtensionPath, {
                content: largeContent
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('too large');
        });

        it('should reject potentially malicious content', async () => {
            const result = await createInsight(testExtensionPath, {
                content: 'Test <script>alert("xss")</script>'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('unsafe');
        });

        it('should not overwrite existing file', async () => {
            const filename = 'test-insight.md';
            
            // Create first file
            await createInsight(testExtensionPath, {
                content: 'First',
                filename
            });

            // Try to create again with same filename
            const result = await createInsight(testExtensionPath, {
                content: 'Second',
                filename
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('already exists');
        });

        it('should include metadata in frontmatter', async () => {
            const result = await createInsight(testExtensionPath, {
                title: 'Test',
                content: 'Content',
                metadata: {
                    provider: 'claude',
                    complexity: 'high'
                }
            });

            const fileContent = fs.readFileSync(result.path, 'utf8');
            expect(fileContent).toContain('provider: claude');
            expect(fileContent).toContain('complexity: high');
            expect(fileContent).toContain('created:');
        });
    });

    describe('listInsights', () => {
        it('should return empty array when no insights exist', async () => {
            const result = await listInsights(testExtensionPath);
            expect(result.files).toEqual([]);
        });

        it('should list created insights', async () => {
            // Create two insights
            await createInsight(testExtensionPath, {
                content: 'First',
                filename: 'first.md'
            });

            await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps

            await createInsight(testExtensionPath, {
                content: 'Second',
                filename: 'second.md'
            });

            const result = await listInsights(testExtensionPath);
            expect(result.files).toHaveLength(2);
            expect(result.files[0].name).toBe('second.md'); // Newest first
            expect(result.files[1].name).toBe('first.md');
        });

        it('should include file metadata', async () => {
            await createInsight(testExtensionPath, {
                content: 'Test content',
                filename: 'test.md'
            });

            const result = await listInsights(testExtensionPath);
            expect(result.files[0]).toHaveProperty('name');
            expect(result.files[0]).toHaveProperty('path');
            expect(result.files[0]).toHaveProperty('created');
            expect(result.files[0]).toHaveProperty('size');
        });
    });
});
