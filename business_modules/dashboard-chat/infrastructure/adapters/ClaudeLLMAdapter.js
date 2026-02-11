/**
 * Claude (Anthropic) chat completions adapter. Single port: chat(system, user, opts) -> Promise<string|null>.
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * @param {{ apiKey: string, model?: string, timeoutMs?: number }} opts
 * @returns {{ chat: (system: string, user: string) => Promise<string|null> }}
 */
function createClaudeLLMAdapter(opts = {}) {
    const apiKey = opts.apiKey || '';
    const model = opts.model || 'claude-3-5-sonnet-20241022';
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    async function chat(systemContent, userContent) {
        if (!apiKey) return null;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(CLAUDE_API_URL, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model,
                    max_tokens: 1024,
                    temperature: 0.3,
                    system: systemContent,
                    messages: [
                        { role: 'user', content: userContent }
                    ]
                })
            });
            clearTimeout(t);
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                throw new Error(`Claude ${res.status}: ${errText.slice(0, 150)}`);
            }
            const data = await res.json();
            const text = data && data.content && data.content[0] && data.content[0].text;
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
