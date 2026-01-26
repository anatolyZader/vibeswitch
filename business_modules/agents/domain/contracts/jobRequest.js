/**
 * Job Request Contract
 * 
 * Schema for agent job requests sent from extension to Cloud Run gateway.
 * Versioned for backward compatibility.
 */

/**
 * @typedef {Object} ChangedFile
 * @property {string} path - Relative file path
 * @property {string} patch - Unified diff format
 * @property {string} language - File language (js, ts, py, etc.)
 * @property {number} size - File size in bytes
 */

/**
 * @typedef {Object} JobContext
 * @property {'dev'|'vibe'} mode - Current VibeSwitch mode
 * @property {string} riskLevel - Risk assessment level
 * @property {Object} userSettings - User configuration settings
 */

/**
 * @typedef {Object} AgentCapabilities
 * @property {boolean} canSuggestFixes - Whether agent can provide autofix patches
 * @property {number} maxTokens - Maximum tokens for LLM processing
 * @property {number} timeBudgetMs - Time budget in milliseconds
 */

/**
 * @typedef {Object} JobRequest
 * @property {string} schemaVersion - Schema version (e.g., "1.0.0")
 * @property {string} correlationId - UUID for tracking this job
 * @property {string} repoId - Repository identifier
 * @property {string} branch - Git branch name
 * @property {string} commit - Git commit SHA (or "working-tree" for uncommitted)
 * @property {ChangedFile[]} changedFiles - List of changed files with diffs
 * @property {JobContext} context - Execution context
 * @property {AgentCapabilities} capabilities - Agent capabilities configuration
 * @property {Object} [metadata] - Optional metadata (package.json, tsconfig, etc.)
 */

/**
 * Creates a job request object
 * @param {Object} params
 * @param {string} params.correlationId
 * @param {string} params.repoId
 * @param {string} params.branch
 * @param {string} params.commit
 * @param {ChangedFile[]} params.changedFiles
 * @param {JobContext} params.context
 * @param {AgentCapabilities} params.capabilities
 * @param {Object} [params.metadata]
 * @returns {JobRequest}
 */
function createJobRequest(params) {
    return {
        schemaVersion: '1.0.0',
        correlationId: params.correlationId,
        repoId: params.repoId,
        branch: params.branch,
        commit: params.commit,
        changedFiles: params.changedFiles,
        context: params.context,
        capabilities: params.capabilities,
        metadata: params.metadata || {}
    };
}

module.exports = {
    createJobRequest
};
