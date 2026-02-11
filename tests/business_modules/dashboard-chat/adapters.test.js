/**
 * Tests for dashboard chat LLM adapters (OpenAI and Claude)
 */

const { createOpenAILLMAdapter } = require('../../../business_modules/dashboard-chat/infrastructure/adapters/OpenAILLMAdapter');
const { createClaudeLLMAdapter } = require('../../../business_modules/dashboard-chat/infrastructure/adapters/ClaudeLLMAdapter');

describe('Dashboard Chat LLM Adapters', () => {
    describe('OpenAI Adapter', () => {
        it('should return null when no API key is provided', async () => {
            const adapter = createOpenAILLMAdapter({ apiKey: '' });
            const result = await adapter.chat('system prompt', 'user message');
            expect(result).toBeNull();
        });

        it('should be created with default model', () => {
            const adapter = createOpenAILLMAdapter({ apiKey: 'test-key' });
            expect(adapter).toBeDefined();
            expect(adapter.chat).toBeInstanceOf(Function);
        });

        it('should accept custom model and timeout', () => {
            const adapter = createOpenAILLMAdapter({
                apiKey: 'test-key',
                model: 'gpt-4',
                timeoutMs: 30000
            });
            expect(adapter).toBeDefined();
        });
    });

    describe('Claude Adapter', () => {
        it('should return null when no API key is provided', async () => {
            const adapter = createClaudeLLMAdapter({ apiKey: '' });
            const result = await adapter.chat('system prompt', 'user message');
            expect(result).toBeNull();
        });

        it('should be created with default model', () => {
            const adapter = createClaudeLLMAdapter({ apiKey: 'test-key' });
            expect(adapter).toBeDefined();
            expect(adapter.chat).toBeInstanceOf(Function);
        });

        it('should accept custom model and timeout', () => {
            const adapter = createClaudeLLMAdapter({
                apiKey: 'test-key',
                model: 'claude-3-opus-20240229',
                timeoutMs: 30000
            });
            expect(adapter).toBeDefined();
        });
    });

    describe('Adapter interface compatibility', () => {
        it('both adapters should have the same interface', () => {
            const openaiAdapter = createOpenAILLMAdapter({ apiKey: 'test' });
            const claudeAdapter = createClaudeLLMAdapter({ apiKey: 'test' });
            
            expect(openaiAdapter.chat).toBeInstanceOf(Function);
            expect(claudeAdapter.chat).toBeInstanceOf(Function);
            
            // Both should have the same chat function signature
            expect(openaiAdapter.chat.length).toBe(claudeAdapter.chat.length);
        });
    });
});
