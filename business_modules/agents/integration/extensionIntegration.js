/**
 * Extension Integration
 * 
 * Integrates agents into VibeSwitch extension lifecycle.
 */

const vscode = require('vscode');
const {
    AgentGateway,
    FindingsStore,
    AgentOrchestrator,
    FindingsDiagnostics
} = require('../index');

class AgentsExtensionIntegration {
    /**
     * @param {vscode.ExtensionContext} context - VS Code extension context
     * @param {Object} state - Extension state
     * @param {Function} log - Logging function
     */
    constructor(context, state, log) {
        this.context = context;
        this.state = state;
        this.log = log;

        // Initialize components
        this.findingsStore = new FindingsStore(context, log);
        this.diagnostics = new FindingsDiagnostics(this.findingsStore, log);

        // Initialize gateway (will be configured via settings)
        const config = vscode.workspace.getConfiguration('vibeswitch.agents');
        const gatewayUrl = config.get('gatewayUrl', '');
        
        if (gatewayUrl) {
            this.gateway = new AgentGateway({
                gatewayUrl,
                getAuthToken: async () => {
                    // Get auth token from settings or keypair manager
                    const token = config.get('authToken', '');
                    if (token) return token;
                    
                    // Try to get from keypair manager if available
                    if (state.capability && state.capability.keypairManager) {
                        // Generate token using keypair (future implementation)
                        return null;
                    }
                    return null;
                },
                log
            });

            this.orchestrator = new AgentOrchestrator({
                gateway: this.gateway,
                findingsStore: this.findingsStore,
                context,
                log
            });
        } else {
            this.log('Agent gateway URL not configured, agents disabled');
            this.gateway = null;
            this.orchestrator = null;
        }

        this._saveDebounceTimer = null;
        this._saveDebounceMs = 2000;
    }

    /**
     * Start integration - register event listeners
     */
    start() {
        if (!this.orchestrator) {
            this.log('Agents not available (gateway not configured)');
            return;
        }

        // Register save listener (debounced)
        this.context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                this._onFileSave(document);
            })
        );

        // Register diagnostics update on findings change
        // (This would be called when findings are updated)
        
        this.log('Agent integration started');
    }

    /**
     * Handle file save event
     * @private
     */
    _onFileSave(document) {
        if (!this.orchestrator) return;

        const config = vscode.workspace.getConfiguration('vibeswitch.agents');
        const triggerOnSave = config.get('triggerOnSave', false);
        const mode = this.state.getMode();

        // Only trigger in DEV mode or if explicitly enabled
        if (!triggerOnSave && mode !== 'dev') return;

        // Debounce saves
        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
        }

        this._saveDebounceTimer = setTimeout(async () => {
            try {
                const correlationId = await this.orchestrator.triggerAgents({
                    trigger: 'save',
                    mode
                });
                if (correlationId) {
                    this.log(`Triggered agents on save: ${correlationId}`);
                }
            } catch (error) {
                this.log(`Error triggering agents on save: ${error.message}`, true);
            }
        }, this._saveDebounceMs);
    }

    /**
     * Trigger agents before commit
     * Called by git hooks or extension commands
     */
    async triggerBeforeCommit() {
        if (!this.orchestrator) {
            vscode.window.showWarningMessage('Agents not configured');
            return;
        }

        try {
            const mode = this.state.getMode();
            const correlationId = await this.orchestrator.triggerAgents({
                trigger: 'before-commit',
                mode
            });
            
            if (correlationId) {
                vscode.window.showInformationMessage(`Agent analysis started: ${correlationId}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to trigger agents: ${error.message}`);
        }
    }

    /**
     * Update diagnostics from current findings
     */
    updateDiagnostics() {
        if (!this.diagnostics) return;

        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) return;

        // Get workspace identifier (simplified)
        const workspaceRoot = folders[0].uri.fsPath;
        const workspaceId = this._getWorkspaceId(workspaceRoot);

        // Get current branch and commit (simplified)
        const { execSync } = require('child_process');
        try {
            const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
            let commit = 'working-tree';
            try {
                const status = execSync('git status --porcelain', { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
                if (!status) {
                    commit = execSync('git rev-parse HEAD', { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
                }
            } catch {}
            
            this.diagnostics.updateDiagnostics(workspaceId, branch, commit);
        } catch (error) {
            // Not a git repo or git not available
        }
    }

    /**
     * Get workspace ID
     * @private
     */
    _getWorkspaceId(workspaceRoot) {
        const crypto = require('crypto');
        try {
            const { execSync } = require('child_process');
            const remoteUrl = execSync('git config --get remote.origin.url', { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
            return remoteUrl || crypto.createHash('sha256').update(workspaceRoot).digest('hex').substring(0, 16);
        } catch {
            return crypto.createHash('sha256').update(workspaceRoot).digest('hex').substring(0, 16);
        }
    }

    /**
     * Dispose
     */
    dispose() {
        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
        }
        if (this.diagnostics) {
            this.diagnostics.dispose();
        }
        if (this.orchestrator) {
            this.orchestrator.dispose();
        }
    }
}

module.exports = AgentsExtensionIntegration;
