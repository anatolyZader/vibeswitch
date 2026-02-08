/**
 * Unit tests for dashboard-chat ContextBuilder: glossary, dashboard summary shape, user content.
 */
const ContextBuilder = require('../../../business_modules/dashboard-chat/app/ContextBuilder');

describe('ContextBuilder', () => {
    describe('getSystemPrompt', () => {
        test('returns string with read-only rules and dashboard glossary', () => {
            const prompt = ContextBuilder.getSystemPrompt();
            expect(typeof prompt).toBe('string');
            expect(prompt).toContain('read-only');
            expect(prompt).toContain('VibeSwitch');
            expect(prompt).toContain('Ownership');
            expect(prompt).toContain('Silent Drift');
            expect(prompt).toContain('Boundary violations');
        });
    });

    describe('buildDashboardSummary', () => {
        test('includes mode, risk, components for valid payload', () => {
            const payload = {
                currentMode: 'dev',
                scoreData: { total: 45, components: { review: 20, blindAcceptance: 5, adaptation: 15, debt: 10 } },
                events: [],
                antipatternBreakdown: { boundaryViolations: { risk0To100: 10 }, verificationDebt: { risk0To100: 5 } },
                tokenUsage: { totalInput: 100, totalOutput: 50, totalTokens: 150, usageApiAvailable: true },
                capabilities: { git: true, ast: true }
            };
            const summary = ContextBuilder.buildDashboardSummary(payload);
            expect(summary).toContain('dev');
            expect(summary).toContain('45');
            expect(summary).toContain('review');
            expect(summary).toContain('debt');
        });

        test('includes file-level references when unopened/unreviewed present', () => {
            const payload = {
                scoreData: {
                    total: 20,
                    components: {},
                    unopenedFiles: { count: 2, files: [{ path: 'src/foo.js' }, { path: 'lib/bar.js' }] },
                    unreviewedSuggestions: { count: 1, files: [{ path: 'test/baz.js' }] }
                },
                events: [],
                antipatternBreakdown: {},
                tokenUsage: {},
                capabilities: {}
            };
            const summary = ContextBuilder.buildDashboardSummary(payload);
            expect(summary).toContain('src/foo.js');
            expect(summary).toContain('lib/bar.js');
            expect(summary).toContain('test/baz.js');
        });

        test('handles empty payload', () => {
            const summary = ContextBuilder.buildDashboardSummary({});
            expect(summary).toContain('risk');
            expect(summary).toContain('none');
        });
    });

    describe('buildUserContent', () => {
        test('combines summary, codebase context, and user question', () => {
            const payload = { currentMode: 'dev', scoreData: { total: 0 }, events: [] };
            const codebase = '// snippet from foo.js';
            const question = 'What does the debt meter mean?';
            const content = ContextBuilder.buildUserContent(payload, codebase, question);
            expect(content).toContain('dev');
            expect(content).toContain('Codebase context');
            expect(content).toContain('snippet from foo.js');
            expect(content).toContain('User question:');
            expect(content).toContain(question);
        });

        test('works with empty codebase context', () => {
            const payload = { scoreData: { total: 10 } };
            const content = ContextBuilder.buildUserContent(payload, '', 'Hello');
            expect(content).toContain('User question: Hello');
        });
    });
});
