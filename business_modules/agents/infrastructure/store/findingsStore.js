/**
 * Findings Store
 * 
 * Local cache for agent findings, organized by workspace/branch/commit.
 * Persists via IAgentsFindingsPersistencePort (adapter created from context internally).
 */

const { createAgentsWorkspaceStatePersistenceAdapter } = require('../adapters/agentsWorkspaceStatePersistenceAdapter');

const FINDINGS_STATE_KEY = 'vibeswitch.agents.findings';

class FindingsStore {
    /**
     * @param {import('vscode').ExtensionContext} context - VS Code extension context (used to create persistence adapter)
     * @param {Function} [log] - Optional logging function
     */
    constructor(context, log = null) {
        this._persistence = createAgentsWorkspaceStatePersistenceAdapter(context);
        this.log = log || (() => {});
        this._cache = new Map(); // In-memory cache: key -> findings[]
        this._loadFromState();
    }

    /**
     * Store findings for a workspace/branch/commit combination
     * @param {string} workspaceId - Workspace identifier
     * @param {string} branch - Git branch
     * @param {string} commit - Git commit SHA or 'working-tree'
     * @param {string} correlationId - Correlation ID
     * @param {Object[]} findings - Array of findings
     */
    storeFindings(workspaceId, branch, commit, correlationId, findings) {
        const key = this._makeKey(workspaceId, branch, commit);
        
        if (!this._cache.has(key)) {
            this._cache.set(key, []);
        }
        
        const existing = this._cache.get(key);

        // Remove old findings with same correlationId (replace)
        const filtered = existing.filter(f => f.correlationId !== correlationId);

        // Tag new findings with correlationId so they can be replaced in a future store
        const tagged = findings.map(f => ({ ...f, correlationId }));

        // Add new findings
        const updated = [...filtered, ...tagged];
        this._cache.set(key, updated);
        
        this._persistToState();
        this.log(`Stored ${findings.length} findings for ${key} (correlationId: ${correlationId})`);
    }

    /**
     * Get findings for a workspace/branch/commit combination
     * @param {string} workspaceId - Workspace identifier
     * @param {string} branch - Git branch
     * @param {string} commit - Git commit SHA or 'working-tree'
     * @param {Object} [filters] - Optional filters
     * @param {string} [filters.category] - Filter by category
     * @param {string} [filters.severity] - Filter by severity
     * @returns {Object[]} Array of findings
     */
    getFindings(workspaceId, branch, commit, filters = {}) {
        const key = this._makeKey(workspaceId, branch, commit);
        let findings = this._cache.get(key) || [];
        
        if (filters.category) {
            findings = findings.filter(f => f.category === filters.category);
        }
        
        if (filters.severity) {
            findings = findings.filter(f => f.severity === filters.severity);
        }
        
        return findings;
    }

    /**
     * Get all findings for a workspace (across all branches/commits)
     * @param {string} workspaceId - Workspace identifier
     * @returns {Object[]} Array of findings
     */
    getAllFindings(workspaceId) {
        const allFindings = [];
        for (const [key, findings] of this._cache.entries()) {
            if (key.startsWith(`${workspaceId}:`)) {
                allFindings.push(...findings);
            }
        }
        return allFindings;
    }

    /**
     * Clear findings for a specific key
     * @param {string} workspaceId - Workspace identifier
     * @param {string} branch - Git branch
     * @param {string} commit - Git commit SHA or 'working-tree'
     */
    clearFindings(workspaceId, branch, commit) {
        const key = this._makeKey(workspaceId, branch, commit);
        this._cache.delete(key);
        this._persistToState();
    }

    /**
     * Clear all findings for a workspace
     * @param {string} workspaceId - Workspace identifier
     */
    clearAllFindings(workspaceId) {
        const keysToDelete = [];
        for (const key of this._cache.keys()) {
            if (key.startsWith(`${workspaceId}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this._cache.delete(key));
        this._persistToState();
    }

    /**
     * Get findings summary (counts by category and severity)
     * @param {string} workspaceId - Workspace identifier
     * @param {string} branch - Git branch
     * @param {string} commit - Git commit SHA or 'working-tree'
     * @returns {Object} Summary object
     */
    getSummary(workspaceId, branch, commit) {
        const findings = this.getFindings(workspaceId, branch, commit);
        
        const summary = {
            total: findings.length,
            byCategory: { qa: 0, security: 0, architecture: 0 },
            bySeverity: { info: 0, warn: 0, error: 0 }
        };
        
        findings.forEach(finding => {
            summary.byCategory[finding.category] = (summary.byCategory[finding.category] || 0) + 1;
            summary.bySeverity[finding.severity] = (summary.bySeverity[finding.severity] || 0) + 1;
        });
        
        return summary;
    }

    /**
     * Make cache key
     * @private
     */
    _makeKey(workspaceId, branch, commit) {
        return `${workspaceId}:${branch}:${commit}`;
    }

    /**
     * Load findings from persistence
     * @private
     */
    _loadFromState() {
        try {
            const stored = this._persistence.get(FINDINGS_STATE_KEY, {});
            this._cache = new Map(Object.entries(stored));
            this.log(`Loaded ${this._cache.size} finding groups from workspace state`);
        } catch (error) {
            this.log(`Error loading findings from state: ${error.message}`, true);
            this._cache = new Map();
        }
    }

    /**
     * Persist findings via port
     * @private
     */
    _persistToState() {
        try {
            const serializable = Object.fromEntries(this._cache);
            this._persistence.set(FINDINGS_STATE_KEY, serializable);
        } catch (error) {
            this.log(`Error persisting findings to state: ${error.message}`, true);
        }
    }
}

module.exports = FindingsStore;
