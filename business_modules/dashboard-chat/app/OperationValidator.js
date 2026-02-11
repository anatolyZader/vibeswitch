/**
 * OperationValidator: Technical enforcement layer for dashboard chat operations.
 * This is NOT just prompt-based security - it's hard technical validation.
 * 
 * Dashboard chat is TECHNICALLY restricted to:
 * - Reading codebase (always allowed)
 * - Creating insights in designated directory (create_insight tool only)
 * - Nothing else
 */

// Whitelist of allowed tools/operations
const ALLOWED_TOOLS = ['create_insight'];

// Whitelist of allowed tool names that can be passed to LLM
const ALLOWED_TOOL_DEFINITIONS = ['create_insight'];

/**
 * Validate that a tool request is allowed
 * @param {Object} toolRequest - Tool use request from LLM
 * @returns {{ allowed: boolean, reason?: string }}
 */
function validateToolRequest(toolRequest) {
    if (!toolRequest || typeof toolRequest !== 'object') {
        return { allowed: false, reason: 'Invalid tool request format' };
    }

    const toolName = toolRequest.tool || toolRequest.name;
    
    if (!toolName) {
        return { allowed: false, reason: 'No tool name specified' };
    }

    if (!ALLOWED_TOOLS.includes(toolName)) {
        return { 
            allowed: false, 
            reason: `Tool '${toolName}' is not allowed. Dashboard chat can only use: ${ALLOWED_TOOLS.join(', ')}` 
        };
    }

    // Additional validation for create_insight
    if (toolName === 'create_insight') {
        const input = toolRequest.input || {};
        
        if (!input.content || typeof input.content !== 'string') {
            return { allowed: false, reason: 'create_insight requires content parameter' };
        }

        if (!input.title || typeof input.title !== 'string') {
            return { allowed: false, reason: 'create_insight requires title parameter' };
        }

        // Validate filename if provided
        if (input.filename && typeof input.filename === 'string') {
            const validFilename = /^[a-zA-Z0-9_-]+\.md$/;
            if (!validFilename.test(input.filename)) {
                return { 
                    allowed: false, 
                    reason: 'Invalid filename. Must be alphanumeric with dash/underscore and .md extension' 
                };
            }
        }
    }

    return { allowed: true };
}

/**
 * Validate that tool definitions passed to LLM are on whitelist
 * @param {Array} tools - Array of tool definitions
 * @returns {{ valid: boolean, invalidTools: Array<string> }}
 */
function validateToolDefinitions(tools) {
    if (!tools || !Array.isArray(tools)) {
        return { valid: true, invalidTools: [] };
    }

    const invalidTools = [];
    
    for (const tool of tools) {
        const toolName = tool.name;
        if (toolName && !ALLOWED_TOOL_DEFINITIONS.includes(toolName)) {
            invalidTools.push(toolName);
        }
    }

    return {
        valid: invalidTools.length === 0,
        invalidTools
    };
}

/**
 * Validate that an LLM response doesn't contain unauthorized operations
 * This is a defense-in-depth check in case LLM tries to return malicious content
 * @param {string} responseText
 * @returns {{ safe: boolean, issues: Array<string> }}
 */
function validateResponseContent(responseText) {
    if (!responseText || typeof responseText !== 'string') {
        return { safe: true, issues: [] };
    }

    const issues = [];
    
    // Check for attempts to include executable code
    const dangerousPatterns = [
        /<script[\s>]/i,
        /javascript:/i,
        /on\w+\s*=/i,  // onclick=, onerror=, etc.
        /eval\s*\(/i,
        /Function\s*\(/i,
        /<iframe/i,
        /<embed/i,
        /<object/i
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(responseText)) {
            issues.push(`Response contains potentially dangerous pattern: ${pattern}`);
        }
    }

    // Check for attempts to include shell commands (shouldn't happen, but defense in depth)
    const shellPatterns = [
        /`.*(?:rm|curl|wget|bash|sh|eval).*`/i,
        /\$\(.*\)/,  // Command substitution
        /exec\s*\(/i
    ];

    for (const pattern of shellPatterns) {
        if (pattern.test(responseText)) {
            issues.push(`Response contains potential shell command pattern: ${pattern}`);
        }
    }

    return {
        safe: issues.length === 0,
        issues
    };
}

/**
 * Get list of allowed operations for dashboard chat
 * @returns {Array<string>}
 */
function getAllowedOperations() {
    return [
        'read_codebase',  // Implicit - always allowed via context building
        'read_dashboard_metrics',  // Implicit - always allowed via payload
        'create_insight'  // Explicit tool
    ];
}

/**
 * Get comprehensive security report
 * @returns {Object}
 */
function getSecurityReport() {
    return {
        enforcement: 'TECHNICAL',
        description: 'Dashboard chat operations are technically restricted, not just prompt-restricted',
        allowedTools: ALLOWED_TOOLS,
        allowedOperations: getAllowedOperations(),
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
    validateToolRequest,
    validateToolDefinitions,
    validateResponseContent,
    getAllowedOperations,
    getSecurityReport,
    ALLOWED_TOOLS
};
