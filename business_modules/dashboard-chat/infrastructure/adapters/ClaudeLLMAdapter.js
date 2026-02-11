/**
 * Claude (Anthropic) chat completions adapter with tool/function calling support.
 * Supports both simple chat and tool use for creating insights.
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * @param {{ apiKey: string, model?: string, timeoutMs?: number }} opts
 * @returns {{ chat: (system: string, user: string, tools?: Array) => Promise<string|object|null> }}
 */
function createClaudeLLMAdapter(opts = {}) {
    const apiKey = opts.apiKey || '';
    const model = opts.model || 'claude-3-5-sonnet-20241022';
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    async function chat(systemContent, userContent, tools) {
        if (!apiKey) return null;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const requestBody = {
                model,
                max_tokens: 4096,  // Higher token limit for more detailed responses
                temperature: 0.3,
                system: systemContent,
                messages: [
                    { role: 'user', content: userContent }
                ]
            };
            
            // Add tools if provided
            if (tools && Array.isArray(tools) && tools.length > 0) {
                requestBody.tools = tools;
            }
            
            const res = await fetch(CLAUDE_API_URL, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });
            clearTimeout(t);
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                throw new Error(`Claude ${res.status}: ${errText.slice(0, 150)}`);
            }
            const data = await res.json();
            
            // Check if Claude wants to use a tool
            if (data.stop_reason === 'tool_use' && data.content) {
                // Find tool use in content
                const toolUse = data.content.find(c => c.type === 'tool_use');
                if (toolUse) {
                    return {
                        type: 'tool_use',
                        tool: toolUse.name,
                        input: toolUse.input,
                        id: toolUse.id,
                        fullResponse: data
                    };
                }
            }
            
            // Regular text response
            const textContent = data && data.content && data.content.find(c => c.type === 'text');
            const text = textContent && textContent.text;
            return typeof text === 'string' ? text.trim() : null;
        } catch (err) {
            clearTimeout(t);
            throw err;
        }
    }

    return { chat };
}

module.exports = {
    createClaudeLLMAdapter
};
