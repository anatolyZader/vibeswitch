/**
 * LLMIntegrationSmellsDetector - Optional: scan workspace/extension for model pin, limits, schema, prompt.
 * Only when VibeSwitch can see LLM call sites or config.
 */

/**
 * Compute LLM integration checklist (reproducibility, runtime safety, schema, prompt governance).
 * @param {Object} ctx - { workspaceRoot?: string, filesWithContent?: Array<{ filePath: string, content: string }> }
 * @param {{ cancelled?: boolean, isCancelled?: () => boolean }} [cancelToken]
 * @param {{ maxWorkMsPerTick?: number, maxFilesPerCycle?: number }} [budget]
 * @returns {Promise<{ reproducibilityStatus: string, runtimeSafetyPosture: string, schemaSafety: string, promptGovernance: string }>}
 */
async function compute(ctx, cancelToken, budget) {
    const filesWithContent = ctx.filesWithContent || [];
    const maxFiles = (budget && budget.maxFilesPerCycle) != null ? budget.maxFilesPerCycle : 20;

    let hasModelPin = false;
    let hasMaxTokens = false;
    let hasTimeout = false;
    let hasRetry = false;
    let hasSchema = false;
    let hasSystemPrompt = false;

    for (let i = 0; i < Math.min(filesWithContent.length, maxFiles); i++) {
        const f = filesWithContent[i];
        const content = (f && f.content) || '';
        if (/model\s*[:=]\s*["'][^"']+@\d+|version.*pin|modelId.*gpt-4-\d{4}/i.test(content)) hasModelPin = true;
        if (/maxTokens|max_tokens|maximumTokens/i.test(content)) hasMaxTokens = true;
        if (/timeout|requestTimeout|timeoutMs/i.test(content)) hasTimeout = true;
        if (/retry|retries|backoff/i.test(content)) hasRetry = true;
        if (/schema|z\.|yup\.|validate.*json|parse.*schema/i.test(content)) hasSchema = true;
        if (/systemPrompt|system_prompt|system.*message|role.*system/i.test(content)) hasSystemPrompt = true;
    }

    const reproducibilityStatus = hasModelPin ? 'ok' : 'unknown';
    const runtimeSafetyPosture = (hasMaxTokens && hasTimeout && hasRetry) ? 'ok' : 'partial';
    const schemaSafety = hasSchema ? 'ok' : 'unknown';
    const promptGovernance = hasSystemPrompt ? 'ok' : 'unknown';

    return {
        reproducibilityStatus,
        runtimeSafetyPosture,
        schemaSafety,
        promptGovernance
    };
}

module.exports = {
    compute
};
