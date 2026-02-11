/**
 * ContextBuilder: dashboard glossary, structured dashboard summary, and combined user content.
 * Supports enhanced system prompt for Claude with codebase awareness and insights creation.
 */

const READ_ONLY_RULES = `You are a read-only assistant for the VibeSwitch dashboard. You have access to dashboard metrics and optional read-only codebase snippets. You cannot edit files, run commands, or use git.
- Only discuss, explain, and answer questions. Never suggest file edits, terminal commands, or git operations (except creating insight documents via the create_insight tool).
- If the user asks to change source code, explain that you are read-only and they should use the main Cursor editor/agent for that.
- Be concise. Use the provided context to give relevant answers about metrics, code structure, or events.`;

const ENHANCED_CLAUDE_RULES = `You are a codebase-aware assistant with deep understanding of the project. You have extensive context: project structure, git status, package metadata, open files, and key source files.
- Leverage this context to answer architecture questions, trace dependencies, and explain how modules interact.
- You can create markdown insight/review files in the insights directory using the create_insight tool when the user explicitly asks to save, document, or create a review/report/assessment.
- Only use create_insight when the analysis is substantial and worth preserving. Do not create insights for simple Q&A or trivial exchanges.
- You cannot edit source code, run commands, or modify git.`;

const DASHBOARD_GLOSSARY = `
Dashboard glossary (VibeSwitch):
- The dashboard shows awareness metrics and antipatterns for the current workspace. Overall risk is 0-100 (higher = worse).
- Meters (each 0-100 risk): (1) Ownership & Engagement = composite of blind acceptance (bad), review (good), adaptation (good); (2) Silent Drift = debt (unreviewed file changes, pending suggestions); (3) Interaction Quality = flooding, response drill, diff flooding; (4) Context & Resource = context spread, duplication.
- Antipatterns: Boundary violations = cross-boundary edits; Verification debt = accepted suggestions without test/save/navigate signal; Output section lists discrete antipattern messages (labels/details).
- Token usage = Cursor usage API totals (input/output) when available.
- Unopened files and Unreviewed suggestions = file paths that contribute to debt; the model can refer to these when explaining why debt or metrics are high.`;

/**
 * System prompt: read-only rules + optional enhanced rules + dashboard glossary.
 * @param {'openai'|'claude'} [provider]
 * @param {boolean} [useEnhanced]
 * @returns {string}
 */
function getSystemPrompt(provider, useEnhanced) {
    let rules = READ_ONLY_RULES;
    if (provider === 'claude' && useEnhanced) {
        rules = READ_ONLY_RULES + '\n\n' + ENHANCED_CLAUDE_RULES;
    }
    return rules + DASHBOARD_GLOSSARY;
}

/**
 * Build structured dashboard summary from payload.
 * @param {Object} payload
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
 * @param {Object} payload
 * @param {string} codebaseContext
 * @param {string} userMessage
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
