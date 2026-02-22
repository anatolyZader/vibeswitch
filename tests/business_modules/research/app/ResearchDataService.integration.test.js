/**
 * Integration: ResearchDataService with real SQLite store (temp dir). Agent client mocked (no real network).
 * Asserts persist then getPayloadForAgent flow.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { createResearchStore } = require('../../../../business_modules/research/infrastructure/ResearchStore');

const mockSend = jest.fn().mockResolvedValue({ ok: true });
jest.mock('../../../../business_modules/research/infrastructure/ResearchAgentClient', () => ({
    createResearchAgentClient: jest.fn().mockReturnValue({ send: mockSend })
}));

const { createResearchDataService } = require('../../../../business_modules/research/app/ResearchDataService');

function tempDbDir() {
    return path.join(os.tmpdir(), `research-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('ResearchDataService integration', () => {
    test('service with real store: persist then getPayloadForAgent returns current and history', async () => {
        const dir = tempDbDir();
        fs.mkdirSync(dir, { recursive: true });
        const dbPath = path.join(dir, 'research.db');
        const getAgentUrl = () => 'https://agent.test.run';
        const service = createResearchDataService({
            state: { getMode: () => 'dev', awarenessEngine: { getScore: () => ({ total: 50 }), getAntipatternBreakdownAsync: async () => null } },
            getAgentUrl,
            getDbPath: () => dbPath,
            pollIntervalMs: 60000
        });
        service.start();
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setTimeout(r, 50));
        service.stop();
        await new Promise((r) => setImmediate(r));

        const store = await createResearchStore(dbPath);
        const { current, history } = await store.getPayloadForAgent({ lastDays: 7, lastN: 50 });
        store.close();

        expect(current).not.toBeNull();
        expect(current).toHaveProperty('timestamp');
        expect(current).toHaveProperty('source', 'vibeswitch-extension');
        expect(current.scoreData).toEqual({ total: 50 });
        expect(Array.isArray(history)).toBe(true);
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ current: expect.any(Object), history: expect.any(Array) }));
    });
});
