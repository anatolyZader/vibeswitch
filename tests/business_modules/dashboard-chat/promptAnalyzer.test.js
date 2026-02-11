/**
 * Tests for PromptAnalyzer - automatic provider selection
 */

const { analyzePrompt, explainProviderChoice } = require('../../../business_modules/dashboard-chat/app/PromptAnalyzer');

describe('PromptAnalyzer', () => {
    describe('Simple Questions (OpenAI)', () => {
        it('should classify simple score question as simple', () => {
            const result = analyzePrompt("What is my current risk score?");
            expect(result.complexity).toBe('simple');
            expect(result.recommendedProvider).toBe('openai');
            expect(result.score).toBeLessThanOrEqual(10);
        });

        it('should classify metric query as simple', () => {
            const result = analyzePrompt("Show me my recent events");
            expect(result.complexity).toBe('simple');
            expect(result.recommendedProvider).toBe('openai');
        });

        it('should classify antipattern question as simple', () => {
            const result = analyzePrompt("What antipatterns do I have?");
            expect(result.complexity).toBe('simple');
            expect(result.recommendedProvider).toBe('openai');
        });

        it('should classify short definition question as simple', () => {
            const result = analyzePrompt("What does blind acceptance mean?");
            expect(result.complexity).toBe('simple');
            expect(result.recommendedProvider).toBe('openai');
        });

        it('should handle very short questions', () => {
            const result = analyzePrompt("What's my score?");
            expect(result.complexity).toBe('simple');
            expect(result.recommendedProvider).toBe('openai');
        });
    });

    describe('Complex Questions (Claude)', () => {
        it('should classify architecture question as complex', () => {
            const result = analyzePrompt("What is the architecture of this project?");
            expect(result.complexity).toBe('complex');
            expect(result.recommendedProvider).toBe('claude');
            expect(result.score).toBeGreaterThan(10);
        });

        it('should classify implementation question as complex', () => {
            const result = analyzePrompt("Explain how the awareness engine works and how it calculates the risk score");
            expect(result.complexity).toBe('complex');
            expect(result.recommendedProvider).toBe('claude');
        });

        it('should classify multi-file question as complex', () => {
            const result = analyzePrompt("How do the dashboard-chat and llm modules interact with each other?");
            expect(result.complexity).toBe('complex');
            expect(result.recommendedProvider).toBe('claude');
        });

        it('should classify analysis question as complex', () => {
            const result = analyzePrompt("Analyze the relationship between the awareness module and mode enforcement");
            expect(result.complexity).toBe('complex');
            expect(result.recommendedProvider).toBe('claude');
        });

        it('should classify why/cause question as complex', () => {
            const result = analyzePrompt("Why might my boundary violations be high? Look at the code structure.");
            expect(result.complexity).toBe('complex');
            expect(result.recommendedProvider).toBe('claude');
        });

        it('should classify multiple file references as complex', () => {
            const result = analyzePrompt("Compare DashboardChatService.js with ContextBuilder.js and explain their relationship");
            expect(result.complexity).toBe('complex');
            expect(result.recommendedProvider).toBe('claude');
        });

        it('should classify design pattern question as complex', () => {
            const result = analyzePrompt("What design patterns are used in the awareness module?");
            expect(result.complexity).toBe('complex');
            expect(result.recommendedProvider).toBe('claude');
        });
    });

    describe('Context-Aware Analysis', () => {
        it('should consider open file count', () => {
            const simpleResult = analyzePrompt("What is my score?", { openFileCount: 2 });
            const complexResult = analyzePrompt("What is my score?", { openFileCount: 10 });
            
            // More open files should increase complexity slightly
            expect(complexResult.score).toBeGreaterThan(simpleResult.score);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty prompt', () => {
            const result = analyzePrompt("");
            expect(result.complexity).toBe('simple');
            expect(result.recommendedProvider).toBe('openai');
        });

        it('should handle null prompt', () => {
            const result = analyzePrompt(null);
            expect(result.complexity).toBe('simple');
            expect(result.recommendedProvider).toBe('openai');
        });

        it('should handle undefined prompt', () => {
            const result = analyzePrompt(undefined);
            expect(result.complexity).toBe('simple');
            expect(result.recommendedProvider).toBe('openai');
        });
    });

    describe('explainProviderChoice', () => {
        it('should provide human-readable explanation', () => {
            const explanation = explainProviderChoice("What is the architecture of this project?");
            expect(explanation).toContain('CLAUDE');
            expect(explanation).toContain('complex');
            expect(explanation).toContain('Reasons:');
        });

        it('should explain simple choice', () => {
            const explanation = explainProviderChoice("What's my score?");
            expect(explanation).toContain('OPENAI');
            expect(explanation).toContain('simple');
        });
    });

    describe('Real-World Examples', () => {
        const testCases = [
            // Simple cases
            { prompt: "Show me my token usage", expected: 'openai' },
            { prompt: "List recent antipatterns", expected: 'openai' },
            { prompt: "What's my blind acceptance score?", expected: 'openai' },
            { prompt: "How many files are unopened?", expected: 'openai' },
            
            // Complex cases
            { prompt: "Explain the complete data flow from user input to dashboard display", expected: 'claude' },
            { prompt: "How does the enhanced context adapter integrate with the git extension?", expected: 'claude' },
            { prompt: "Compare the OpenAI and Claude adapters - what are the key differences?", expected: 'claude' },
            { prompt: "Walk me through how the awareness score is calculated across all components", expected: 'claude' },
            { prompt: "Why might my debt score correlate with recent git changes?", expected: 'claude' },
            { prompt: "Trace the dependency chain from extension.js to the dashboard", expected: 'claude' }
        ];

        testCases.forEach(({ prompt, expected }) => {
            it(`should recommend ${expected} for: "${prompt}"`, () => {
                const result = analyzePrompt(prompt);
                expect(result.recommendedProvider).toBe(expected);
            });
        });
    });

    describe('Scoring Consistency', () => {
        it('should score similar simple questions consistently', () => {
            const scores = [
                analyzePrompt("What is my score?").score,
                analyzePrompt("What's my risk score?").score,
                analyzePrompt("Show me my score").score
            ];
            
            const variance = Math.max(...scores) - Math.min(...scores);
            expect(variance).toBeLessThan(20); // Scores should be similar
        });

        it('should score similar complex questions consistently', () => {
            const scores = [
                analyzePrompt("Explain the architecture").score,
                analyzePrompt("Describe the architecture").score,
                analyzePrompt("What is the architecture?").score
            ];
            
            scores.forEach(score => {
                expect(score).toBeGreaterThan(15); // All should be complex
            });
        });
    });
});
