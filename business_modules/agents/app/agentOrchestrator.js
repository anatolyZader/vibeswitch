const { createJobRequest } = require('../domain/value_objects/jobRequest');
const { aggregateFindingsFromJobs, allJobsTerminal } = require('../domain/services/jobCompletion');
const { createAgentsCryptoIdAdapter } = require('../infrastructure/adapters/agentsCryptoIdAdapter');

class AgentOrchestrator {
    constructor(config) {
        this.gateway = config.gateway;
        this.findingsStore = config.findingsStore;
        this.workspacePort = config.workspacePort;
        this.log = config.log || (() => {});
        this.idPort = config.idPort || createAgentsCryptoIdAdapter();
        this._activeJobs = new Map();
        this._pollingIntervals = new Map();
        this._pollIntervalMs = 2000;
        this._maxPollTimeMs = 5 * 60 * 1000;
    }

    async triggerAgents(options = {}) {
        const { trigger = 'save', workspaceRoot, mode = 'dev' } = options;
        const workspaceInfo = await this.workspacePort.getWorkspaceInfo(workspaceRoot);
        if (!workspaceInfo) {
            this.log('Cannot trigger agents: not a git repository', true);
            return null;
        }

        const changedFiles = await this.workspacePort.getChangedFiles(workspaceInfo.workspaceRoot);
        if (changedFiles.length === 0) {
            this.log('No changed files to analyze');
            return null;
        }

        const correlationId = this.idPort.generateCorrelationId();
        const jobRequest = createJobRequest({
            correlationId,
            repoId: workspaceInfo.repoId,
            branch: workspaceInfo.branch,
            commit: workspaceInfo.commit,
            changedFiles,
            context: { mode, riskLevel: 'medium', userSettings: {} },
            capabilities: { canSuggestFixes: mode === 'dev', maxTokens: 4000, timeBudgetMs: 30000 },
            metadata: await this.workspacePort.getMetadata(workspaceInfo.workspaceRoot)
        });

        try {
            const result = await this.gateway.submitJob(jobRequest);
            this.log(`Submitted agent job: correlationId=${correlationId}`, undefined);
            this._activeJobs.set(correlationId, {
                jobs: [result.jobId],
                startedAt: Date.now(),
                workspaceId: workspaceInfo.repoId,
                branch: workspaceInfo.branch,
                commit: workspaceInfo.commit,
                headRev: workspaceInfo.headRev
            });
            this._startPolling(correlationId);
            return correlationId;
        } catch (error) {
            this.log(`Failed to submit agent job: ${error.message}`, true);
            throw error;
        }
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
                if (!jobs || !Array.isArray(jobs)) return;
                if (jobs.length === 0) {
                    this._stopPolling(correlationId);
                    return;
                }
                if (allJobsTerminal(jobs)) {
                    const allFindings = aggregateFindingsFromJobs(jobs);
                    if (allFindings.length > 0) {
                        this.findingsStore.storeFindings(jobInfo.workspaceId, jobInfo.branch, jobInfo.commit, correlationId, allFindings);
                        if (jobInfo.headRev) {
                            this.findingsStore.storeFindings(jobInfo.workspaceId, jobInfo.branch, jobInfo.headRev, correlationId, allFindings);
                        }
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

    dispose() {
        for (const [correlationId, intervalId] of this._pollingIntervals.entries()) {
            clearInterval(intervalId);
        }
        this._pollingIntervals.clear();
        this._activeJobs.clear();
    }
}

module.exports = AgentOrchestrator;
