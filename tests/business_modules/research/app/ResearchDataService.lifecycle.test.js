/**
 * Tests: createResearchDataService start, stop, tick with and without store.
 */
const path = require('path');
const os = require('os');

const mockPersist = jest.fn().mockResolvedValue(undefined);
const mockGetPayloadForAgent = jest.fn().mockResolvedValue({ current: { timestamp: 1 }, history: [] });
const mockClose = jest.fn();
const mockSend = jest.fn().mockResolvedValue({ ok: true });

jest.mock('../../../../business_modules/research/infrastructure/ResearchStore', () => ({
    createResearchStore: jest.fn().mockResolvedValue({
        persist: mockPersist,
        getPayloadForAgent: mockGetPayloadForAgent,
        close: mockClose
    })
}));

jest.mock('../../../../business_modules/research/infrastructure/ResearchAgentClient', () => ({
    createResearchAgentClient: jest.fn().mockReturnValue({ send: mockSend })
}));

const { createResearchDataService } = require('../../../../business_modules/research/app/ResearchDataService');

describe('createResearchDataService lifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSend.mockResolvedValue({ ok: true });
        mockGetPayloadForAgent.mockResolvedValue({ current: { timestamp: 1 }, history: [] });
    });

    test('start calls tick and sets interval; stop clears interval', () => {
        const getAgentUrl = jest.fn().mockReturnValue('');
        const service = createResearchDataService({
            state: {},
            getAgentUrl,
            pollIntervalMs: 100000
        });
        service.start();
        expect(getAgentUrl).toHaveBeenCalled();
        service.stop();
        service.start();
        service.stop();
    });

    test('tick without getDbPath sends current payload and empty history', async () => {
        const getAgentUrl = jest.fn().mockReturnValue('https://agent.run.app');
        const service = createResearchDataService({
            state: { getMode: () => 'dev' },
            getAgentUrl,
            getDbPath: null
        });
        service.start();
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        expect(mockSend).toHaveBeenCalled();
        const sent = mockSend.mock.calls[0][0];
        expect(sent).toHaveProperty('current');
        expect(sent).toHaveProperty('history');
        expect(Array.isArray(sent.history)).toBe(true);
        expect(sent.history).toHaveLength(0);
        service.stop();
    });

    test('tick with getDbPath persists and sends current + history from store', async () => {
        const getAgentUrl = jest.fn().mockReturnValue('https://agent.run.app');
        const dbPath = path.join(os.tmpdir(), `research-lifecycle-${Date.now()}`, 'research.db');
        const { createResearchStore } = require('../../../../business_modules/research/infrastructure/ResearchStore');
        createResearchStore.mockResolvedValue({
            persist: mockPersist,
            getPayloadForAgent: mockGetPayloadForAgent,
            close: mockClose
        });
        mockGetPayloadForAgent.mockResolvedValue({
            current: { timestamp: 100, source: 'test' },
            history: [{ timestamp: 99 }]
        });
        const service = createResearchDataService({
            state: { getMode: () => 'dev' },
            getAgentUrl,
            getDbPath: () => dbPath
        });
        service.start();
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        expect(mockPersist).toHaveBeenCalled();
        expect(mockGetPayloadForAgent).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledWith({
            current: { timestamp: 100, source: 'test' },
            history: [{ timestamp: 99 }]
        });
        service.stop();
    });

    test('stop closes store', async () => {
        const getAgentUrl = jest.fn().mockReturnValue('https://x.run.app');
        const dbPath = path.join(os.tmpdir(), `research-stop-${Date.now()}`, 'research.db');
        const service = createResearchDataService({
            state: { getMode: () => 'dev' },
            getAgentUrl,
            getDbPath: () => dbPath
        });
        service.start();
        await new Promise((r) => setImmediate(r));
        service.stop();
        await new Promise((r) => setImmediate(r));
        expect(mockClose).toHaveBeenCalled();
    });
});
