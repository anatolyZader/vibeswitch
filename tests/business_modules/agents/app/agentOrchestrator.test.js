const AgentOrchestrator = require('../../../../business_modules/agents/app/agentOrchestrator');

describe('AgentOrchestrator', () => {
    let orchestrator;
    let mockGateway;
    let mockFindingsStore;
    let mockWorkspacePort;
    let mockLog;

    beforeEach(() => {
        jest.clearAllMocks();
        mockLog = jest.fn();
        mockGateway = {
            submitJob: jest.fn(),
            getJobsByCorrelationId: jest.fn()
        };
        mockFindingsStore = {
            storeFindings: jest.fn()
        };
        mockWorkspacePort = {
            getWorkspaceInfo: jest.fn(),
            getChangedFiles: jest.fn(),
            getMetadata: jest.fn().mockResolvedValue({})
        };
        orchestrator = new AgentOrchestrator({
            gateway: mockGateway,
            findingsStore: mockFindingsStore,
            workspacePort: mockWorkspacePort,
            log: mockLog
        });
    });

    test('triggerAgents returns null when not a git repo', async () => {
        mockWorkspacePort.getWorkspaceInfo.mockResolvedValue(null);
        const result = await orchestrator.triggerAgents({ workspaceRoot: '/tmp/not-git', mode: 'dev' });
        expect(result).toBeNull();
        expect(mockLog).toHaveBeenCalledWith('Cannot trigger agents: not a git repository', true);
    });

    test('triggerAgents returns null when no changed files', async () => {
        mockWorkspacePort.getWorkspaceInfo.mockResolvedValue({
            workspaceRoot: '/tmp/repo',
            repoId: 'https://github.com/foo/bar',
            branch: 'main',
            commit: 'abc123'
        });
        mockWorkspacePort.getChangedFiles.mockResolvedValue([]);
        const result = await orchestrator.triggerAgents({ workspaceRoot: '/tmp/repo', mode: 'dev' });
        expect(result).toBeNull();
        expect(mockLog).toHaveBeenCalledWith('No changed files to analyze');
    });

    test('triggerAgents returns correlationId when gateway.submitJob resolves', async () => {
        mockWorkspacePort.getWorkspaceInfo.mockResolvedValue({
            workspaceRoot: '/tmp/repo',
            repoId: 'https://github.com/foo/bar',
            branch: 'main',
            commit: 'abc123'
        });
        mockWorkspacePort.getChangedFiles.mockResolvedValue([
            { path: 'file.js', patch: 'diff output', language: 'js', size: 0 }
        ]);
        mockGateway.submitJob.mockResolvedValue({ jobId: 'job-123' });
        mockGateway.getJobsByCorrelationId.mockResolvedValue([]);

        const result = await orchestrator.triggerAgents({ workspaceRoot: '/tmp/repo', mode: 'dev' });
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
        expect(mockGateway.submitJob).toHaveBeenCalled();
        expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Submitted agent job'), undefined);
    });

    test('triggerAgents throws when gateway.submitJob throws', async () => {
        mockWorkspacePort.getWorkspaceInfo.mockResolvedValue({
            workspaceRoot: '/tmp/repo',
            repoId: 'https://github.com/foo/bar',
            branch: 'main',
            commit: 'abc123'
        });
        mockWorkspacePort.getChangedFiles.mockResolvedValue([
            { path: 'file.js', patch: 'diff output', language: 'js', size: 0 }
        ]);
        mockGateway.submitJob.mockRejectedValue(new Error('network error'));

        await expect(orchestrator.triggerAgents({ workspaceRoot: '/tmp/repo', mode: 'dev' })).rejects.toThrow('network error');
        expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Failed to submit agent job'), true);
    });

    test('dispose clears polling intervals and active jobs', () => {
        orchestrator._activeJobs.set('cid', {});
        orchestrator._pollingIntervals.set('cid', setInterval(() => {}, 99999));
        orchestrator.dispose();
        expect(orchestrator._activeJobs.size).toBe(0);
        expect(orchestrator._pollingIntervals.size).toBe(0);
    });
});
