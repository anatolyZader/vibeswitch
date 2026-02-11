/**
 * Tests for OperationValidator - technical security enforcement
 */

const { 
    validateToolRequest, 
    validateToolDefinitions, 
    validateResponseContent,
    getAllowedOperations,
    getSecurityReport,
    ALLOWED_TOOLS
} = require('../../../business_modules/dashboard-chat/app/OperationValidator');

describe('OperationValidator - Security Enforcement', () => {
    describe('validateToolRequest', () => {
        it('should allow create_insight tool', () => {
            const request = {
                tool: 'create_insight',
                input: {
                    title: 'Test',
                    content: 'Content'
                }
            };
            const result = validateToolRequest(request);
            expect(result.allowed).toBe(true);
        });

        it('should reject unauthorized tools', () => {
            const request = {
                tool: 'execute_command',
                input: { command: 'ls' }
            };
            const result = validateToolRequest(request);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not allowed');
        });

        it('should reject create_insight without content', () => {
            const request = {
                tool: 'create_insight',
                input: { title: 'Test' }
            };
            const result = validateToolRequest(request);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('content');
        });

        it('should reject create_insight without title', () => {
            const request = {
                tool: 'create_insight',
                input: { content: 'Test' }
            };
            const result = validateToolRequest(request);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('title');
        });

        it('should reject invalid filename', () => {
            const request = {
                tool: 'create_insight',
                input: {
                    title: 'Test',
                    content: 'Content',
                    filename: '../../../etc/passwd'
                }
            };
            const result = validateToolRequest(request);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Invalid filename');
        });

        it('should allow valid custom filename', () => {
            const request = {
                tool: 'create_insight',
                input: {
                    title: 'Test',
                    content: 'Content',
                    filename: 'my-review.md'
                }
            };
            const result = validateToolRequest(request);
            expect(result.allowed).toBe(true);
        });

        it('should reject null/undefined request', () => {
            expect(validateToolRequest(null).allowed).toBe(false);
            expect(validateToolRequest(undefined).allowed).toBe(false);
        });
    });

    describe('validateToolDefinitions', () => {
        it('should allow whitelisted tools', () => {
            const tools = [
                { name: 'create_insight', description: 'test' }
            ];
            const result = validateToolDefinitions(tools);
            expect(result.valid).toBe(true);
            expect(result.invalidTools).toEqual([]);
        });

        it('should reject non-whitelisted tools', () => {
            const tools = [
                { name: 'create_insight', description: 'test' },
                { name: 'execute_shell', description: 'bad' },
                { name: 'write_file', description: 'bad' }
            ];
            const result = validateToolDefinitions(tools);
            expect(result.valid).toBe(false);
            expect(result.invalidTools).toContain('execute_shell');
            expect(result.invalidTools).toContain('write_file');
        });

        it('should handle empty tool list', () => {
            const result = validateToolDefinitions([]);
            expect(result.valid).toBe(true);
        });

        it('should handle null/undefined', () => {
            expect(validateToolDefinitions(null).valid).toBe(true);
            expect(validateToolDefinitions(undefined).valid).toBe(true);
        });
    });

    describe('validateResponseContent', () => {
        it('should allow safe markdown content', () => {
            const content = '# Title\n\nSafe **markdown** content with `code`.';
            const result = validateResponseContent(content);
            expect(result.safe).toBe(true);
            expect(result.issues).toEqual([]);
        });

        it('should reject <script> tags', () => {
            const content = 'Hello <script>alert("xss")</script>';
            const result = validateResponseContent(content);
            expect(result.safe).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
        });

        it('should reject javascript: URLs', () => {
            const content = '[link](javascript:alert(1))';
            const result = validateResponseContent(content);
            expect(result.safe).toBe(false);
        });

        it('should reject event handlers', () => {
            const content = '<img onerror="alert(1)" src=x>';
            const result = validateResponseContent(content);
            expect(result.safe).toBe(false);
        });

        it('should reject eval', () => {
            const content = 'Code: eval("malicious")';
            const result = validateResponseContent(content);
            expect(result.safe).toBe(false);
        });

        it('should reject iframe', () => {
            const content = '<iframe src="bad"></iframe>';
            const result = validateResponseContent(content);
            expect(result.safe).toBe(false);
        });

        it('should reject shell commands in backticks', () => {
            const content = '`rm -rf /`';
            const result = validateResponseContent(content);
            expect(result.safe).toBe(false);
        });

        it('should reject command substitution', () => {
            const content = 'Test $(cat /etc/passwd)';
            const result = validateResponseContent(content);
            expect(result.safe).toBe(false);
        });

        it('should allow safe code blocks', () => {
            const content = '```javascript\nconst x = 10;\nconsole.log(x);\n```';
            const result = validateResponseContent(content);
            expect(result.safe).toBe(true);
        });

        it('should handle null/undefined', () => {
            expect(validateResponseContent(null).safe).toBe(true);
            expect(validateResponseContent(undefined).safe).toBe(true);
        });
    });

    describe('getAllowedOperations', () => {
        it('should return list of allowed operations', () => {
            const ops = getAllowedOperations();
            expect(Array.isArray(ops)).toBe(true);
            expect(ops).toContain('create_insight');
            expect(ops).toContain('read_codebase');
            expect(ops).toContain('read_dashboard_metrics');
        });
    });

    describe('getSecurityReport', () => {
        it('should return comprehensive security report', () => {
            const report = getSecurityReport();
            expect(report.enforcement).toBe('TECHNICAL');
            expect(report.allowedTools).toBeDefined();
            expect(report.restrictions).toBeDefined();
            expect(report.enforcementMechanisms).toBeDefined();
        });

        it('should list create_insight as allowed', () => {
            const report = getSecurityReport();
            expect(report.allowedTools).toContain('create_insight');
        });

        it('should list restrictions', () => {
            const report = getSecurityReport();
            expect(report.restrictions).toContain('Cannot edit source code');
            expect(report.restrictions).toContain('Cannot run commands');
        });
    });

    describe('ALLOWED_TOOLS constant', () => {
        it('should only contain create_insight', () => {
            expect(ALLOWED_TOOLS).toEqual(['create_insight']);
        });
    });
});
