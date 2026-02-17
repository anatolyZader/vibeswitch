/**
 * Tests: gatherResearchPayload - all payload keys, full state, null when client missing or throws.
 */
const { gatherResearchPayload } = require('../../../../business_modules/research/app/ResearchDataService');

describe('gatherResearchPayload payload shape', () => {
    const REQUIRED_KEYS = [
        'timestamp', 'source', 'scoreData', 'antipatternBreakdown', 'tokenUsage',
        'sonarMeasures', 'eslintMeasures', 'projectProgressMeasures', 'currentMode'
    ];

    test('payload has all required keys when state is null', async () => {
        const payload = await gatherResearchPayload(null);
        for (const key of REQUIRED_KEYS) {
            expect(payload).toHaveProperty(key);
        }
        expect(payload.scoreData).toBeNull();
        expect(payload.antipatternBreakdown).toBeNull();
        expect(payload.tokenUsage).toBeNull();
        expect(payload.sonarMeasures).toBeNull();
        expect(payload.eslintMeasures).toBeNull();
        expect(payload.projectProgressMeasures).toBeNull();
        expect(payload.currentMode).toBe('dev');
    });

    test('payload uses getMode() when available', async () => {
        const payload = await gatherResearchPayload({ getMode: () => 'vibe' });
        expect(payload.currentMode).toBe('vibe');
    });

    test('scoreData and antipatternBreakdown from awarenessEngine', async () => {
        const state = {
            getMode: () => 'dev',
            awarenessEngine: {
                getScore: jest.fn().mockReturnValue({ total: 42 }),
                getAntipatternBreakdownAsync: jest.fn().mockResolvedValue({ comprehensionDebt: { risk0To100: 10 } })
            }
        };
        const payload = await gatherResearchPayload(state);
        expect(payload.scoreData).toEqual({ total: 42 });
        expect(payload.antipatternBreakdown).toEqual({ comprehensionDebt: { risk0To100: 10 } });
    });

    test('antipatternBreakdown null when awarenessEngine throws', async () => {
        const state = {
            getMode: () => 'dev',
            awarenessEngine: {
                getScore: jest.fn().mockReturnValue({ total: 1 }),
                getAntipatternBreakdownAsync: jest.fn().mockRejectedValue(new Error('fail'))
            }
        };
        const payload = await gatherResearchPayload(state);
        expect(payload.scoreData).toEqual({ total: 1 });
        expect(payload.antipatternBreakdown).toBeNull();
    });

    test('tokenUsage from tokenUsageClient', async () => {
        const usage = { totalInput: 100, totalOutput: 50, totalTokens: 150 };
        const state = {
            getMode: () => 'dev',
            tokenUsageClient: { fetchTokenUsage: jest.fn().mockResolvedValue(usage) }
        };
        const payload = await gatherResearchPayload(state);
        expect(payload.tokenUsage).toEqual(usage);
    });

    test('sonarMeasures from sonarClient', async () => {
        const measures = { bugs: 2, sonarApiAvailable: true };
        const state = {
            getMode: () => 'dev',
            sonarClient: { fetchMeasures: jest.fn().mockResolvedValue(measures) }
        };
        const payload = await gatherResearchPayload(state);
        expect(payload.sonarMeasures).toEqual(measures);
    });

    test('eslintMeasures from eslintClient', async () => {
        const measures = { errorCount: 1, warningCount: 2, eslintApiAvailable: true };
        const state = {
            getMode: () => 'dev',
            eslintClient: { fetchMeasures: jest.fn().mockResolvedValue(measures) }
        };
        const payload = await gatherResearchPayload(state);
        expect(payload.eslintMeasures).toEqual(measures);
    });

    test('all clients combined', async () => {
        const state = {
            getMode: () => 'dev',
            awarenessEngine: {
                getScore: () => ({ total: 10 }),
                getAntipatternBreakdownAsync: async () => ({ x: 1 })
            },
            tokenUsageClient: { fetchTokenUsage: async () => ({ totalTokens: 100 }) },
            sonarClient: { fetchMeasures: async () => ({ bugs: 0 }) },
            eslintClient: { fetchMeasures: async () => ({ errorCount: 0 }) },
            projectProgressClient: { fetchMeasures: async () => ({ planDeviation: 5 }) }
        };
        const payload = await gatherResearchPayload(state);
        expect(payload.scoreData).toEqual({ total: 10 });
        expect(payload.antipatternBreakdown).toEqual({ x: 1 });
        expect(payload.tokenUsage).toEqual({ totalTokens: 100 });
        expect(payload.sonarMeasures).toEqual({ bugs: 0 });
        expect(payload.eslintMeasures).toEqual({ errorCount: 0 });
        expect(payload.projectProgressMeasures).toEqual({ planDeviation: 5 });
    });
});
