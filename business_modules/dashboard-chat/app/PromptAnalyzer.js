/**
 * PromptAnalyzer: Analyzes user prompts to determine complexity and recommend optimal LLM provider.
 * Uses heuristics to classify questions as "simple" (OpenAI) or "complex" (Claude).
 */

// Keywords that indicate complex architectural/deep analysis questions
const COMPLEX_KEYWORDS = [
    'architecture', 'design', 'pattern', 'structure', 'organize', 'organized',
    'how does', 'how do', 'explain how', 'walk me through', 'walk through',
    'why was', 'why is this implemented', 'implementation',
    'relationship', 'relate', 'interact', 'connection', 'depend', 'dependencies',
    'across', 'between', 'among', 'multiple files', 'several files',
    'analyze', 'analysis', 'deep dive', 'detailed', 'comprehensive',
    'trace', 'flow', 'data flow', 'control flow',
    'entire', 'whole', 'all of', 'complete',
    'compare', 'comparison', 'versus', 'vs', 'difference between',
    'refactor', 'improve', 'optimize', 'better way',
    'debug', 'why might', 'what could cause', 'potential',
    'integrate', 'integration', 'work together'
];

// Keywords that indicate simple metric/status questions
const SIMPLE_KEYWORDS = [
    'what is my', 'what\'s my', 'whats my',
    'current score', 'risk score', 'awareness score',
    'show me', 'list', 'display',
    'recent', 'latest', 'last',
    'antipattern', 'metric', 'token usage',
    'mean', 'means', 'definition', 'define',
    'count', 'number of', 'how many'
];

// File/code reference patterns
const FILE_REFERENCE_PATTERNS = [
    /\b\w+\.js\b/,
    /\b\w+\.ts\b/,
    /\b\w+\.jsx\b/,
    /\b\w+\.tsx\b/,
    /\bmodule\b/,
    /\bfunction\b/,
    /\bclass\b/,
    /\bcomponent\b/
];

/**
 * Analyze prompt and return complexity score and recommendation
 * @param {string} prompt - User's question
 * @param {Object} [context] - Optional context (dashboard state, open files)
 * @returns {{ 
 *   complexity: 'simple'|'complex', 
 *   score: number, 
 *   recommendedProvider: 'openai'|'claude',
 *   reasons: string[]
 * }}
 */
function analyzePrompt(prompt, context = {}) {
    if (!prompt || typeof prompt !== 'string') {
        return {
            complexity: 'simple',
            score: 0,
            recommendedProvider: 'openai',
            reasons: ['Empty or invalid prompt']
        };
    }

    const lowerPrompt = prompt.toLowerCase().trim();
    const reasons = [];
    let complexityScore = 0;

    // 1. Length analysis (longer questions tend to be more complex)
    const wordCount = lowerPrompt.split(/\s+/).length;
    if (wordCount > 20) {
        complexityScore += 20;
        reasons.push(`Long question (${wordCount} words) suggests complexity`);
    } else if (wordCount > 12) {
        complexityScore += 10;
        reasons.push(`Medium-length question (${wordCount} words) may need context`);
    } else if (wordCount < 6) {
        complexityScore -= 15;
        reasons.push(`Very short question (${wordCount} words) suggests simple query`);
    }

    // 2. Complex keyword detection
    let complexKeywordCount = 0;
    for (const keyword of COMPLEX_KEYWORDS) {
        if (lowerPrompt.includes(keyword)) {
            complexKeywordCount++;
            complexityScore += 15;
        }
    }
    if (complexKeywordCount > 0) {
        reasons.push(`Found ${complexKeywordCount} complex keyword(s): suggests deep analysis needed`);
    }
    if (complexKeywordCount >= 3) {
        complexityScore += 15;
        reasons.push(`Multiple complex keywords: definitely needs comprehensive analysis`);
    }

    // 3. Simple keyword detection
    let simpleKeywordCount = 0;
    for (const keyword of SIMPLE_KEYWORDS) {
        if (lowerPrompt.includes(keyword)) {
            simpleKeywordCount++;
            complexityScore -= 8;
        }
    }
    if (simpleKeywordCount > 0) {
        reasons.push(`Found ${simpleKeywordCount} simple keyword(s): suggests quick answer`);
    }

    // 4. File/code reference detection
    let fileReferenceCount = 0;
    for (const pattern of FILE_REFERENCE_PATTERNS) {
        const matches = lowerPrompt.match(pattern);
        if (matches) {
            fileReferenceCount += matches.length;
        }
    }
    if (fileReferenceCount > 2) {
        complexityScore += 20;
        reasons.push(`Multiple file references (${fileReferenceCount}): needs cross-file analysis`);
    } else if (fileReferenceCount === 1) {
        complexityScore += 5;
        reasons.push(`Single file reference: may need code context`);
    }

    // 5. Question structure analysis
    if (lowerPrompt.includes('?') && lowerPrompt.split('?').length > 2) {
        complexityScore += 10;
        reasons.push('Multiple questions: suggests complex inquiry');
    }

    // 6. Comparative/analytical patterns
    if (lowerPrompt.match(/why.*(?:high|low|bad|good)/)) {
        complexityScore += 15;
        reasons.push('Causal analysis question: needs metric correlation');
    }

    // 7. Architecture/design patterns
    if (lowerPrompt.match(/(?:how|what).*(?:work|works|working|designed|implemented)/)) {
        complexityScore += 15;
        reasons.push('Implementation/design question: needs code understanding');
    }

    // 8. Multi-file/cross-cutting concerns
    if (lowerPrompt.match(/(?:all|multiple|several|various|different).*(?:files|modules|components)/)) {
        complexityScore += 20;
        reasons.push('Multi-file question: needs enhanced context');
    }

    // 9. Context-based analysis
    if (context.openFileCount && context.openFileCount > 5) {
        complexityScore += 5;
        reasons.push(`Many open files (${context.openFileCount}): likely complex work session`);
    }

    // 10. Dashboard-specific simple patterns
    if (lowerPrompt.match(/^(?:what|show|list|display).*(?:score|metric|event|antipattern)/)) {
        complexityScore -= 15;
        reasons.push('Dashboard status query: simple lookup');
    }

    // Final classification (lower threshold for better sensitivity)
    const complexity = complexityScore > 10 ? 'complex' : 'simple';
    const recommendedProvider = complexity === 'complex' ? 'claude' : 'openai';

    // Add final summary reason
    if (complexity === 'complex') {
        reasons.push(`Total complexity score: ${complexityScore} → Using Claude for deep analysis`);
    } else {
        reasons.push(`Total complexity score: ${complexityScore} → Using OpenAI for quick response`);
    }

    return {
        complexity,
        score: complexityScore,
        recommendedProvider,
        reasons
    };
}

/**
 * Get human-readable explanation of provider choice
 * @param {string} prompt
 * @param {Object} context
 * @returns {string}
 */
function explainProviderChoice(prompt, context = {}) {
    const analysis = analyzePrompt(prompt, context);
    const lines = [
        `Provider: ${analysis.recommendedProvider.toUpperCase()} (${analysis.complexity})`,
        `Complexity Score: ${analysis.score}`,
        'Reasons:'
    ];
    
    analysis.reasons.forEach((reason, idx) => {
        lines.push(`  ${idx + 1}. ${reason}`);
    });
    
    return lines.join('\n');
}

module.exports = {
    analyzePrompt,
    explainProviderChoice
};
