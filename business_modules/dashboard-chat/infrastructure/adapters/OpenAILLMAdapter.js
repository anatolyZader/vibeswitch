/**
 * OpenAI chat completions adapter. Single port: chat(system, user, opts) -> Promise<string|null>.
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * @param {{ apiKey: string, model?: string, timeoutMs?: number }} opts
 * @returns {{ chat: (system: string, user: string) => Promise<string|null> }}
 */
function createOpenAILLMAdapter(opts = {}) {
    const apiKey = opts.apiKey || '';
    const model = opts.model || 'gpt-4o-mini';
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    async function chat(systemContent, userContent) {
        if (!apiKey) return null;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(OPENAI_CHAT_URL, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    temperature: 0.3,
                    max_tokens: 1024,
                    messages: [
                        { role: 'system', content: systemContent },
                        { role: 'user', content: userContent }
                    ]
                })
            });
            clearTimeout(t);
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 150)}`);
            }
            const data = await res.json();
            const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            return typeof text === 'string' ? text.trim() : null;
        } catch (err) {
            clearTimeout(t);
            throw err;
        }
    }

    return { chat };
}

module.exports = {
    createOpenAILLMAdapter
};
