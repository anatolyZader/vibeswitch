/**
 * Claude (Anthropic) chat adapter. Implements Messages API with optional tool use.
 * Compatible interface with OpenAI adapter: chat(system, user, opts) -> Promise<string|null>.
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const DEFAULT_MAX_TOKENS = 4096;

/**
 * @param {{ apiKey: string, model?: string, timeoutMs?: number, maxTokens?: number }} opts
 * @returns {{ chat: (system: string, user: string, opts?: { tools?: Array, toolHandler?: Function }) => Promise<string|null> }}
 */
function createClaudeLLMAdapter(opts = {}) {
    const apiKey = opts.apiKey || '';
    const model = opts.model || DEFAULT_MODEL;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;

    /**
     * @param {string} systemContent
     * @param {string} userContent
     * @param {{ tools?: Array<{ name: string, description: string, input_schema: object }>, toolHandler?: (name: string, input: object) => Promise<string> }} [chatOpts]
     * @returns {Promise<string|null>}
     */
    async function chat(systemContent, userContent, chatOpts) {
        if (!apiKey) return null;
        const tools = (chatOpts && chatOpts.tools) || [];
        const toolHandler = chatOpts && chatOpts.toolHandler;

        const body = {
            model,
            max_tokens: maxTokens,
            system: systemContent,
            messages: [{ role: 'user', content: userContent }]
        };

        if (tools.length > 0) {
            body.tools = tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.input_schema
            }));
        }

        let text = '';
        let toolUseBlocks = [];

        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);

        try {
            let res = await fetch(CLAUDE_API_URL, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(body)
            });
            clearTimeout(t);

            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                throw new Error(`Claude ${res.status}: ${errText.slice(0, 150)}`);
            }

            let data = await res.json();
            const content = data.content || [];
            toolUseBlocks = content.filter((b) => b.type === 'tool_use');
            const textBlocks = content.filter((b) => b.type === 'text');
            text = textBlocks.map((b) => b.text).join('').trim();

            // Tool use loop: if Claude requested tools, execute and iterate
            while (data.stop_reason === 'tool_use' && toolUseBlocks.length > 0 && toolHandler) {
                const toolResults = [];
                for (const block of toolUseBlocks) {
                    const result = await toolHandler(block.name, block.input || {});
                    toolResults.push({
                        type: 'tool_result',
                        tool_use_id: block.id,
                        content: typeof result === 'string' ? result : JSON.stringify(result)
                    });
                }

                // Append assistant message with tool_use and user message with tool_result
                const messages = [
                    ...(body.messages || []),
                    { role: 'assistant', content },
                    {
                        role: 'user',
                        content: [...toolResults]
                    }
                ];

                body.messages = messages;

                const t2 = setTimeout(() => controller.abort(), timeoutMs);
                res = await fetch(CLAUDE_API_URL, {
                    method: 'POST',
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify(body)
                });
                clearTimeout(t2);

                if (!res.ok) {
                    const errText = await res.text().catch(() => '');
                    throw new Error(`Claude ${res.status}: ${errText.slice(0, 150)}`);
                }

                data = await res.json();
                const nextContent = data.content || [];
                toolUseBlocks = nextContent.filter((b) => b.type === 'tool_use');
                const nextTextBlocks = nextContent.filter((b) => b.type === 'text');
                text = nextTextBlocks.map((b) => b.text).join('').trim();
            }
        } catch (err) {
            clearTimeout(t);
            throw err;
        }

        return text || null;
    }

    return { chat };
}

module.exports = {
    createClaudeLLMAdapter
};
