/**
 * OperationValidator: technical enforcement for dashboard chat operations.
 * Tool whitelist, input validation, response content scanning.
 * Does NOT rely on prompts; enforces via code.
 */

const ALLOWED_TOOLS = ['create_insight'];

const UNSAFE_RESPONSE_PATTERNS = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /vbscript:/i
];

/**
 * @param {Array<{ name: string }>} tools
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateToolDefinitions(tools) {
    if (!Array.isArray(tools)) return { valid: false, reason: 'Tools must be an array' };
    for (const t of tools) {
        if (t && t.name && !ALLOWED_TOOLS.includes(t.name)) {
            return { valid: false, reason: `Tool not allowed: ${t.name}` };
        }
    }
    return { valid: true };
}

/**
 * @param {{ tool?: string, name?: string, input?: object }} request
 * @returns {{ allowed: boolean, reason?: string }}
 */
function validateToolRequest(request) {
    const toolName = (request && (request.tool || request.name)) || '';
    if (!toolName) return { allowed: false, reason: 'Missing tool name' };
    if (!ALLOWED_TOOLS.includes(toolName)) {
        return { allowed: false, reason: `Tool not allowed: ${toolName}` };
    }
    if (toolName === 'create_insight') {
        const input = request.input || {};
        if (typeof input.filename !== 'string' && typeof input.content !== 'string') {
            return { allowed: false, reason: 'create_insight requires filename and content' };
        }
        if (input.filename && (input.filename.includes('..') || input.filename.includes('/'))) {
            return { allowed: false, reason: 'Path traversal not allowed' };
        }
    }
    return { allowed: true };
}

/**
 * @param {string} text
 * @returns {{ safe: boolean, reason?: string }}
 */
function validateResponseContent(text) {
    if (typeof text !== 'string') return { safe: true };
    for (const pat of UNSAFE_RESPONSE_PATTERNS) {
        if (pat.test(text)) return { safe: false, reason: 'Unsafe content detected in response' };
    }
    return { safe: true };
}

/**
 * @returns {object}
 */
function getSecurityReport() {
    return {
        enforcement: 'TECHNICAL',
        description: 'Dashboard chat operations are technically restricted, not just prompt-restricted',
        allowedTools: [...ALLOWED_TOOLS],
        restrictions: [
            'Cannot edit source code',
            'Cannot run commands',
            'Cannot access filesystem outside insights directory',
            'Cannot execute scripts',
            'Cannot modify git',
            'Cannot use unauthorized tools'
        ],
        enforcementMechanisms: [
            'Tool whitelist validation (OperationValidator)',
            'Path restriction (InsightsWriter)',
            'Filename validation (InsightsWriter)',
            'Content validation (InsightsWriter)',
            'Response content scanning (OperationValidator)',
            'No access to Write/StrReplace/Shell tools'
        ]
    };
}

module.exports = {
    validateToolDefinitions,
    validateToolRequest,
    validateResponseContent,
    getSecurityReport,
    ALLOWED_TOOLS
};
