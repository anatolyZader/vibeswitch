/**
 * ContextBuilder: dashboard glossary (meter meanings), structured dashboard summary with file references,
 * and combined user content for the LLM.
 */

const READ_ONLY_RULES = `You are a read-only assistant for the VibeSwitch dashboard. You have access to dashboard metrics and optional read-only codebase snippets. You cannot edit files, run commands, or use git.
- Only discuss, explain, and answer questions. Never suggest file edits, terminal commands, or git operations.
- If the user asks to change something, explain that you are read-only and they should use the main Cursor editor/agent for that.
- Be concise. Use the provided context to give relevant answers about metrics, code structure, or events.`;

const READ_ONLY_RULES_ENHANCED = `You are a code assistant for the VibeSwitch dashboard with deep codebase awareness. You have access to:
- Complete dashboard metrics and awareness scores
- Full project structure and file organization
- Git status and recent changes
- Project metadata and dependencies
- Open files and key source files
- Codebase context up to 150K characters

You are ALMOST read-only with ONE exception:
- You CAN create markdown insight/review files in the insights/ directory using the create_insight tool
- You CANNOT edit existing files, run commands, or use git

Your role:
- Analyze and explain code patterns, architecture, and relationships
- Answer questions about metrics, antipatterns, and code quality
- Help users understand their codebase structure and organization
- Identify potential issues or areas of concern based on the metrics
- Explain how different parts of the codebase relate to each other
- Reference specific files, functions, and code snippets in your responses

SPECIAL CAPABILITY - Creating Insights:
When you've completed a comprehensive analysis (architecture review, code quality assessment, technical debt analysis, etc.), you can offer to save it as a markdown file using the create_insight tool.

Use create_insight when:
- User explicitly asks you to "save this", "create a file", "document this"
- You've completed a detailed analysis that would be valuable to preserve
- You've identified important findings about code quality, architecture, or technical debt
- User asks for a "review", "report", or "assessment"

Do NOT use create_insight for:
- Simple question/answer exchanges
- Quick metric lookups
- Casual conversation
- Unless the user specifically requests it

When using create_insight:
- Use a descriptive title
- Write comprehensive, well-structured markdown
- Include specific file references and code examples where relevant
- Organize with headers, lists, and sections
- Be professional and actionable

If the user asks to edit existing files, explain that you can only create new insight files, and they should use the main Cursor editor/agent for code edits.

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
