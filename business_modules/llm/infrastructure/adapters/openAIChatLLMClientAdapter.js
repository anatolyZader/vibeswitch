/**
 * OpenAIChatLLMClientAdapter
 *
 * Minimal adapter using OpenAI Responses API-compatible chat endpoint.
 * - Requires explicit opt-in via settings.
 * - Sends only the prompt produced by AwarenessLLMInsightService.
 *
 * Note: This adapter is intentionally minimal; error handling returns null-like failures upward.
 */

class OpenAIChatLLMClientAdapter {
    constructor({ apiKey, model = 'gpt-4.1-mini' } = {}) {
        this.apiKey = apiKey;
        this.model = model;
    }

    async analyzeBatch({ prompt, timeoutMs = 8000 }) {
        if (!this.apiKey) {
            throw new Error('OpenAI adapter missing apiKey');
        }

        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
            // Use Chat Completions for broad compatibility.
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    temperature: 0.2,
                    messages: [
                        { role: 'system', content: 'Return JSON only. Do not wrap in markdown.' },
                        { role: 'user', content: prompt }
                    ]
                })
            });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 200)}`);
            }

            const data = await res.json();
            const content = data?.choices?.[0]?.message?.content;
            if (!content) return null;

            // Must be JSON-only. Parse strictly.
            return JSON.parse(content);
        } finally {
            clearTimeout(t);
        }
    }
}

module.exports = OpenAIChatLLMClientAdapter;

