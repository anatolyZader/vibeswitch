const { execSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const { createJobRequest } = require('../domain/contracts/jobRequest');

class AgentOrchestrator {
    constructor(config) {
        this.gateway = config.gateway;
        this.findingsStore = config.findingsStore;
        this.context = config.context;
        this.log = config.log || (() => {});
        this._activeJobs = new Map();
        this._pollingIntervals = new Map();
        this._pollIntervalMs = 2000;
        this._maxPollTimeMs = 5 * 60 * 1000;
    }

    async triggerAgents(options = {}) {
        const { trigger = 'save', workspaceRoot, mode = 'dev' } = options;
        const workspaceInfo = await this._getWorkspaceInfo(workspaceRoot);
        if (!workspaceInfo) {
            this.log('Cannot trigger agents: not a git repository', true);
            return null;
        }

        const changedFiles = await this._getChangedFiles(workspaceInfo.workspaceRoot);
        if (changedFiles.length === 0) {
            this.log('No changed files to analyze');
            return null;
        }

        const correlationId = this._generateCorrelationId();
        const jobRequest = createJobRequest({
            correlationId,
            repoId: workspaceInfo.repoId,
            branch: workspaceInfo.branch,
            commit: workspaceInfo.commit,
            changedFiles,
            context: { mode, riskLevel: 'medium', userSettings: {} },
            capabilities: { canSuggestFixes: mode === 'dev', maxTokens: 4000, timeBudgetMs: 30000 },
            metadata: await this._getMetadata(workspaceInfo.workspaceRoot)
        });

        try {
            const result = await this.gateway.submitJob(jobRequest);
            this.log(`Submitted agent job: correlationId=${correlationId}`);
            this._activeJobs.set(correlationId, {
                jobs: [result.jobId],
                startedAt: Date.now(),
                workspaceId: workspaceInfo.repoId,
                branch: workspaceInfo.branch,
                commit: workspaceInfo.commit
            });
            this._startPolling(correlationId);
            return correlationId;
        } catch (error) {
            this.log(`Failed to submit agent job: ${error.message}`, true);
            throw error;
        }
    }

    async _getWorkspaceInfo(workspaceRoot) {
        try {
            const root = workspaceRoot || this._getWorkspaceRoot();
            if (!root) return null;
            try {
                execSync('git rev-parse --git-dir', { cwd: root, stdio: 'pipe' });
            } catch {
                return null;
            }
            let repoId;
            try {
                const remoteUrl = execSync('git config --get remote.origin.url', { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
                repoId = remoteUrl || this._hashPath(root);
            } catch {
                repoId = this._hashPath(root);
            }
            const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
            let commit;
            try {
                commit = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
                const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
                if (status) commit = 'working-tree';
            } catch {
                commit = 'working-tree';
            }
            return { workspaceRoot: root, repoId, branch, commit };
        } catch (error) {
            this.log(`Error getting workspace info: ${error.message}`, true);
            return null;
        }
    }

    async _getChangedFiles(workspaceRoot) {
        try {
            const statusOutput = execSync('git status --porcelain', { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
            if (!statusOutput) return [];
            const files = [];
            for (const line of statusOutput.split('\n')) {
                const status = line.substring(0, 2).trim();
                const filePath = line.substring(3).trim();
                if (status.includes('D')) continue;
                let patch = '';
                try {
                    if (status.includes('A') || status.includes('?')) {
                        const content = execSync(`git show :${filePath}`, { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
                        patch = this._createUnifiedDiff(filePath, '', content);
                    } else {
                        patch = execSync(`git diff HEAD -- "${filePath}"`, { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
                    }
                } catch (error) {
                    continue;
                }
                const ext = path.extname(filePath).slice(1);
                files.push({ path: filePath, patch, language: ext, size: 0 });
            }
            return files;
        } catch (error) {
            return [];
        }
    }

    _createUnifiedDiff(filePath, oldContent, newContent) {
        const newLines = newContent ? newContent.split('\n') : [];
        let diff = `--- a/${filePath}\n+++ b/${filePath}\n`;
        diff += `@@ -0,0 +1,${newLines.length} @@\n`;
        newLines.forEach(line => { diff += `+${line}\n`; });
        return diff;
    }

    async _getMetadata(workspaceRoot) {
        const metadata = {};
        const fs = require('fs');
        try {
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                metadata.packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            }
        } catch {}
        return metadata;
    }

    _startPolling(correlationId) {
        const jobInfo = this._activeJobs.get(correlationId);
        if (!jobInfo) return;
        let pollCount = 0;
        const maxPolls = Math.ceil(this._maxPollTimeMs / this._pollIntervalMs);
        const poll = async () => {
            pollCount++;
            try {
                const jobs = await this.gateway.getJobsByCorrelationId(correlationId);
                if (jobs.length === 0) {
                    this._stopPolling(correlationId);
                    return;
                }
                const allCompleted = jobs.every(job => job.status === 'completed' || job.status === 'failed');
                if (allCompleted) {
                    const allFindings = [];
                    jobs.forEach(job => {
                        if (job.findings && Array.isArray(job.findings)) {
                            allFindings.push(...job.findings);
                        }
                    });
                    if (allFindings.length > 0) {
                        this.findingsStore.storeFindings(jobInfo.workspaceId, jobInfo.branch, jobInfo.commit, correlationId, allFindings);
                    }
                    this._stopPolling(correlationId);
                } else if (pollCount >= maxPolls) {
                    this._stopPolling(correlationId);
                }
            } catch (error) {
                if (pollCount >= maxPolls) {
                    this._stopPolling(correlationId);
                }
            }
        };
        const intervalId = setInterval(poll, this._pollIntervalMs);
        this._pollingIntervals.set(correlationId, intervalId);
        poll();
    }

    _stopPolling(correlationId) {
        const intervalId = this._pollingIntervals.get(correlationId);
        if (intervalId) {
            clearInterval(intervalId);
            this._pollingIntervals.delete(correlationId);
        }
        this._activeJobs.delete(correlationId);
    }

    _getWorkspaceRoot() {
        const vscode = require('vscode');
        const folders = vscode.workspace.workspaceFolders;
        return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
    }

    _generateCorrelationId() {
        try {
            return crypto.randomUUID();
        } catch {
            return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        }
    }

    _hashPath(path) {
        return crypto.createHash('sha256').update(path).digest('hex').substring(0, 16);
    }

    dispose() {
        for (const [correlationId, intervalId] of this._pollingIntervals.entries()) {
            clearInterval(intervalId);
        }
        this._pollingIntervals.clear();
        this._activeJobs.clear();
    }
}

module.exports = AgentOrchestrator;
