/**
 * Integration: AgentOrchestrator + real workspace adapter + mock gateway + in-memory store.
 */

const FindingsStore = require('../../../../business_modules/agents/infrastructure/store/findingsStore');
const AgentOrchestrator = require('../../../../business_modules/agents/app/agentOrchestrator');
const AgentsGitWorkspaceAdapter = require('../../../../business_modules/agents/infrastructure/adapters/agentsGitWorkspaceAdapter');
const { execSync } = require('child_process');

jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

describe('AgentOrchestrator integration', () => {
    let store;
    let orchestrator;
    let submitJob;
    let getJobsByCorrelationId;

    beforeEach(() => {
        jest.clearAllMocks();
        const mockContext = { workspaceState: { get: jest.fn().mockReturnValue({}), update: jest.fn() } };
        store = new FindingsStore(mockContext, () => {});

        submitJob = jest.fn();
        getJobsByCorrelationId = jest.fn();
        const mockGateway = {
            submitJob,
            getJobsByCorrelationId
        };

        const workspacePort = new AgentsGitWorkspaceAdapter({ getWorkspaceRoot: () => '/tmp/repo' });
        orchestrator = new AgentOrchestrator({
            gateway: mockGateway,
            findingsStore: store,
            workspacePort,
            log: () => {}
        });

        execSync
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce('https://github.com/foo/repo')
            .mockReturnValueOnce('main')
            .mockReturnValueOnce('abc123')
            .mockReturnValueOnce(' M src/foo.js')
            .mockReturnValueOnce('diff content');
        submitJob.mockResolvedValue({ jobId: 'job-1' });
        getJobsByCorrelationId.mockResolvedValue([
            { status: 'completed', findings: [{ category: 'qa', severity: 'warn', message: 'f1', ruleId: 'r1', evidence: { file: 'a.js' } }] }
        ]);
    });

    test('triggerAgents submits job with correct shape and polling calls storeFindings when jobs complete', async () => {
        const correlationId = await orchestrator.triggerAgents({ workspaceRoot: '/tmp/repo', mode: 'dev' });
        expect(correlationId).not.toBeNull();
        expect(submitJob).toHaveBeenCalledTimes(1);
        const jobRequest = submitJob.mock.calls[0][0];
        expect(jobRequest.schemaVersion).toBe('1.0.0');
        expect(jobRequest.correlationId).toBe(correlationId);
        expect(jobRequest.repoId).toBe('https://github.com/foo/repo');
        expect(jobRequest.branch).toBe('main');
        expect(Array.isArray(jobRequest.changedFiles)).toBe(true);

        await Promise.resolve();
        await Promise.resolve();
        expect(store.getFindings('https://github.com/foo/repo', 'main', 'abc123')).toHaveLength(1);
        orchestrator.dispose();
    });
});
