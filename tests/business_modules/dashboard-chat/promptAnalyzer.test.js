/**
 * Unit tests for PromptAnalyzer.
 */

const { analyzePrompt, explainProviderChoice } = require('../../../business_modules/dashboard-chat/app/PromptAnalyzer');

describe('PromptAnalyzer', () => {
    describe('analyzePrompt', () => {
        it('routes simple questions to openai', () => {
            expect(analyzePrompt('What is my score?').provider).toBe('openai');
            expect(analyzePrompt('Show recent events').provider).toBe('openai');
            expect(analyzePrompt('List antipatterns').provider).toBe('openai');
        });

        it('routes complex questions to claude', () => {
            expect(analyzePrompt('Explain the architecture of this project').provider).toBe('claude');
            expect(analyzePrompt('How do these modules interact with each other?').provider).toBe('claude');
            expect(analyzePrompt('Compare file1.js and file2.js and explain the differences').provider).toBe('claude');
        });

        it('returns score and reason', () => {
            const r = analyzePrompt('What is my score?');
            expect(r.provider).toBe('openai');
            expect(typeof r.score).toBe('number');
            expect(r.reason).toBe('simple question');
        });
    });

    describe('explainProviderChoice', () => {
        it('returns explanation string', () => {
            const s = explainProviderChoice('Explain the architecture of this project');
            expect(s).toMatch(/CLAUDE|OPENAI/);
            expect(s).toMatch(/complex|simple/);
        });
    });
});
