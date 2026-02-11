/**
 * PromptAnalyzer: analyzes user prompts to determine complexity for auto provider selection.
 * Score > 10 -> Claude (complex), <= 10 -> OpenAI (simple).
 */

const COMPLEX_KEYWORDS = [
    'architecture', 'explain how', 'explain the', 'analyze', 'design', 'relationship', 'interact',
    'compare', 'trace', 'debug', 'correlation', 'pattern', 'module', 'dependency',
    'refactor', 'review', 'assessment', 'comprehensive', 'detailed', 'in-depth', 'why is'
];

const SIMPLE_KEYWORDS = [
    'what is my', 'show me', 'current', 'list', 'events', 'antipattern',
    'metric', 'simple', 'quick', 'brief', 'summary'
];

const DASHBOARD_QUERY_PATTERNS = [
    /what'?s?\s+my\s+score/i,
    /what\s+is\s+my\s+score/i,
    /show\s+(?:me\s+)?(?:recent\s+)?events/i,
    /list\s+antipatterns/i,
    /current\s+risk/i,
    /my\s+debt/i
];

const CAUSAL_PATTERNS = [
    /why\s+is\s+\w+\s+(?:high|low|bad|good)/i,
    /why\s+does/i,
    /what\s+caused/i,
    /how\s+does\s+\w+\s+affect/i
];

/**
 * @param {string} userMessage
 * @param {{ openFileCount?: number }} [opts]
 * @returns {{ provider: 'claude'|'openai', score: number, reason?: string }}
 */
function analyzePrompt(userMessage, opts) {
    const msg = (userMessage || '').trim();
    const openFileCount = (opts && opts.openFileCount) || 0;

    let score = 0;

    // Complex keywords
    const lower = msg.toLowerCase();
    for (const kw of COMPLEX_KEYWORDS) {
        if (lower.includes(kw)) score += 15;
    }

    // Simple keywords
    for (const kw of SIMPLE_KEYWORDS) {
        if (lower.includes(kw)) score -= 8;
    }

    // Dashboard query patterns -> simple
    if (DASHBOARD_QUERY_PATTERNS.some((p) => p.test(msg))) score -= 15;

    // Causal analysis -> complex
    if (CAUSAL_PATTERNS.some((p) => p.test(msg))) score += 15;

    // Length: long -> complex
    const words = msg.split(/\s+/).length;
    if (words >= 20) score += 20;
    else if (words < 6) score -= 15;

    // Multiple file references
    const fileRefs = (msg.match(/[\w\-./]+\.(js|ts|jsx|tsx|json|md)/gi) || []).length;
    if (fileRefs >= 2) score += 20;

    // Open file count: more context -> lean complex
    if (openFileCount >= 5) score += 5;

    const provider = score > 10 ? 'claude' : 'openai';
    const reason = score > 10 ? 'complex question' : 'simple question';

    return { provider, score, reason };
}

/**
 * @param {string} userMessage
 * @param {{ openFileCount?: number }} [opts]
 * @returns {string}
 */
function explainProviderChoice(userMessage, opts) {
    const { provider, score, reason } = analyzePrompt(userMessage, opts);
    return `Auto-selected: ${provider.toUpperCase()} (${reason})`;
}

module.exports = {
    analyzePrompt,
    explainProviderChoice
};
