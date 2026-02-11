/**
 * ContextBuilder: dashboard glossary (meter meanings), structured dashboard summary with file references,
 * and combined user content for the LLM.
 */

const READ_ONLY_RULES = `You are a read-only assistant for the VibeSwitch dashboard. You have access to dashboard metrics and optional read-only codebase snippets. You cannot edit files, run commands, or use git.
- Only discuss, explain, and answer questions. Never suggest file edits, terminal commands, or git operations.
- If the user asks to change something, explain that you are read-only and they should use the main Cursor editor/agent for that.
- Be concise. Use the provided context to give relevant answers about metrics, code structure, or events.`;

const READ_ONLY_RULES_ENHANCED = `You are a read-only code assistant for the VibeSwitch dashboard with deep codebase awareness. You have access to:
- Complete dashboard metrics and awareness scores
- Full project structure and file organization
- Git status and recent changes
- Project metadata and dependencies
- Open files and key source files
- Codebase context up to 150K characters

You CANNOT edit files, run commands, or use git. You are read-only.

Your role:
- Analyze and explain code patterns, architecture, and relationships
- Answer questions about metrics, antipatterns, and code quality
- Help users understand their codebase structure and organization
- Identify potential issues or areas of concern based on the metrics
- Explain how different parts of the codebase relate to each other
- Reference specific files, functions, and code snippets in your responses

If the user asks to change something, explain that you are read-only and they should use the main Cursor editor/agent for that.

Be thorough but concise. Use the extensive context provided to give detailed, accurate answers with specific file and code references.`;

const DASHBOARD_GLOSSARY = `
Dashboard glossary (VibeSwitch):
- The dashboard shows awareness metrics and antipatterns for the current workspace. Overall risk is 0-100 (higher = worse).
- Meters (each 0-100 risk): (1) Ownership & Engagement = composite of blind acceptance (bad), review (good), adaptation (good); (2) Silent Drift = debt (unreviewed file changes, pending suggestions); (3) Interaction Quality = flooding, response drill, diff flooding; (4) Context & Resource = context spread, duplication.
- Antipatterns: Boundary violations = cross-boundary edits; Verification debt = accepted suggestions without test/save/navigate signal; Output section lists discrete antipattern messages (labels/details).
- Token usage = Cursor usage API totals (input/output) when available.
- Unopened files and Unreviewed suggestions = file paths that contribute to debt; the model can refer to these when explaining why debt or metrics are high.`;

/**
 * System prompt: read-only rules + dashboard glossary.
 * @param {string} provider - LLM provider ('openai' or 'claude')
 * @returns {string}
 */
function getSystemPrompt(provider) {
    const rules = provider === 'claude' ? READ_ONLY_RULES_ENHANCED : READ_ONLY_RULES;
    return rules + DASHBOARD_GLOSSARY;
}

/**
 * Build structured dashboard summary from payload, including file-level references.
 * @param {Object} payload - Dashboard payload (scoreData, events, antipatternBreakdown, tokenUsage, capabilities)
 * @returns {string}
 */
function buildDashboardSummary(payload) {
    const p = payload || {};
    const scoreData = p.scoreData || {};
    const score = typeof scoreData.total === 'number' ? scoreData.total : 0;
    const mode = p.currentMode || 'dev';
    const components = scoreData.components || {};
    const events = p.events || [];
    const breakdown = p.antipatternBreakdown || {};
    const tokenUsage = p.tokenUsage || {};
    const capabilities = p.capabilities || {};

    const lines = [
        `[Dashboard state]`,
        `Mode: ${mode}, Overall risk: ${score}/100`,
        `Components: review ${components.review ?? 0}/40, blindAcceptance ${components.blindAcceptance ?? 0}/30, adaptation ${components.adaptation ?? 0}/30, debt ${components.debt ?? 0}/30`,
        `Boundary violations risk: ${breakdown.boundaryViolations && breakdown.boundaryViolations.risk0To100 != null ? breakdown.boundaryViolations.risk0To100 : 0}`,
        `Verification debt risk: ${breakdown.verificationDebt && breakdown.verificationDebt.risk0To100 != null ? breakdown.verificationDebt.risk0To100 : 0}`,
        `Token usage: ${tokenUsage.totalInput ?? 0} input, ${tokenUsage.totalOutput ?? 0} output, ${tokenUsage.totalTokens ?? 0} total (usage API: ${tokenUsage.usageApiAvailable ? 'on' : 'off'})`,
        `Capabilities: git ${capabilities.git ? 'on' : 'off'}, ast ${capabilities.ast ? 'on' : 'off'}`
    ];

    const unopened = scoreData.unopenedFiles || { count: 0, files: [] };
    const unreviewed = scoreData.unreviewedSuggestions || { count: 0, files: [] };
    const unopenedPaths = (unopened.files || []).slice(0, 15).map((f) => f.path || f.fullPath).filter(Boolean);
    const unreviewedPaths = (unreviewed.files || []).slice(0, 15).map((f) => f.path || f.fullPath).filter(Boolean);
    if (unopenedPaths.length > 0) {
        lines.push(`Files contributing to debt (unopened): ${unopenedPaths.join(', ')}`);
    }
    if (unreviewedPaths.length > 0) {
        lines.push(`Files with unreviewed suggestions: ${unreviewedPaths.join(', ')}`);
    }

    const eventSummaries = events.slice(0, 10).map((e) => {
        const label = e.label || e.type || 'event';
        const detail = e.detail ? ` — ${e.detail}` : '';
        const path = e.path || e.file ? ` (${e.path || e.file})` : '';
        return `${label}${detail}${path}`;
    });
    if (eventSummaries.length > 0) {
        lines.push(`Recent output/events: ${eventSummaries.join('; ')}`);
    } else if (events.length === 0) {
        lines.push('Recent output/events: none');
    }

    return lines.join('\n');
}

/**
 * Build full user message: dashboard summary + codebase context + user question.
 * @param {Object} payload - Dashboard payload
 * @param {string} codebaseContext - Read-only workspace/codebase context string (can be empty)
 * @param {string} userMessage - User's question
 * @returns {string}
 */
function buildUserContent(payload, codebaseContext, userMessage) {
    const summary = buildDashboardSummary(payload);
    const parts = [summary];
    if (codebaseContext && codebaseContext.trim()) {
        parts.push('\n[Codebase context]\n' + codebaseContext.trim());
    }
    parts.push('\nUser question: ' + (userMessage || '').trim());
    return parts.join('\n');
}

module.exports = {
    getSystemPrompt,
    buildDashboardSummary,
    buildUserContent
};
