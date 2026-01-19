/**
 * VSCodeLLMConfigAdapter
 *
 * Reads LLM config from VS Code settings under `vibeswitch.llm.*`.
 */

const vscode = require('vscode');

class VSCodeLLMConfigAdapter {
    getConfig() {
        const cfg = vscode.workspace.getConfiguration('vibeswitch');
        return {
            enabled: cfg.get('llm.enabled', false),
            provider: cfg.get('llm.provider', 'local'),
            timeoutMs: cfg.get('llm.timeoutMs', 8000),

            // Privacy controls
            sendDiffBullets: cfg.get('llm.sendDiffBullets', true),
            sendSnippets: cfg.get('llm.sendSnippets', false),
            snippetCharLimit: cfg.get('llm.snippetCharLimit', 400),
            maxDiffBullets: cfg.get('llm.maxDiffBullets', 8),

            // Trigger policy
            triggerOnAI: cfg.get('llm.triggerOnAI', true),
            triggerOnLargeBatches: cfg.get('llm.triggerOnLargeBatches', false),
            largeBatchThreshold: cfg.get('llm.largeBatchThreshold', 800),

            // Budgets
            maxPerMinute: cfg.get('llm.maxPerMinute', 6),
            maxPerDay: cfg.get('llm.maxPerDay', 200),

            // Cache
            cacheTtlMs: cfg.get('llm.cacheTtlMs', 24 * 60 * 60 * 1000),

            // Provider-specific
            openai: {
                apiKey: cfg.get('llm.openai.apiKey', ''),
                model: cfg.get('llm.openai.model', 'gpt-4.1-mini')
            }
        };
    }
}

module.exports = VSCodeLLMConfigAdapter;

