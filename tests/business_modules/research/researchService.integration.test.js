/**
 * Integration tests for ResearchService.
 * Mocks DB (temp path), awareness engine, token usage client, and InsightsWriter.
 */

const path = require('path');
const fs = require('fs');
const vscode = require('vscode');

jest.mock('../../../business_modules/dashboard-chat/app/InsightsWriter', () => ({
    writeInsight: jest.fn().mockResolvedValue({ success: true, path: 'insights/research-test.md' })
}));

const tmpDir = path.join(__dirname, '../../../.tmp-research-service-integration-test');
let writeInsightSpy;
let service;

beforeAll(async () => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const InsightsWriter = require('../../../business_modules/dashboard-chat/app/InsightsWriter');
    writeInsightSpy = InsightsWriter.writeInsight;

    const origGetConfig = vscode.workspace?.getConfiguration;
    if (origGetConfig) {
        vscode.workspace.getConfiguration = jest.fn((section) => ({
            get: (key, def) => (section === 'vibeswitch.research' && key === 'scheduleHours' ? 24 : def)
        }));
    }
});

afterAll(async () => {
    if (service && service.dispose) service.dispose();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
});

describe('ResearchService integration', () => {
    it('creates service, samples from awareness engine, and runs research cycle', async () => {
        const mockAwarenessEngine = {
            getScore: jest.fn().mockReturnValue({ total: 55, components: { review: 30, debt: 25 } }),
            getAntipatternBreakdownAsync: jest.fn().mockResolvedValue({ copyPaste: 2, godObject: 1 })
        };
        const mockTokenUsageClient = {
            fetchTokenUsage: jest.fn().mockResolvedValue({ totalInput: 100, totalOutput: 50, totalTokens: 150 })
        };
        const state = {
            awarenessEngine: mockAwarenessEngine,
            tokenUsageClient: mockTokenUsageClient,
            extensionContext: { extensionPath: tmpDir }
        };
        const context = {
            globalState: { get: jest.fn().mockReturnValue(0), update: jest.fn().mockResolvedValue(undefined) }
        };

        const research = require('../../../business_modules/research');
        service = await research.createResearchService({
            context,
            state,
            dbPath: path.join(tmpDir, 'research.db')
        });

        expect(service).toBeDefined();
        expect(service.sample).toBeDefined();
        expect(service.run).toBeDefined();
        expect(service.start).toBeDefined();
        expect(service.dispose).toBeDefined();

        service.sample({
            scoreData: { total: 60, components: { review: 35 } },
            antipatternBreakdown: { copyPaste: 1 },
            tokenUsage: { totalTokens: 200 }
        });

        await service.run();

        const rows = service._db.queryTimeSeries({ limit: 100 });
        expect(rows.length).toBeGreaterThanOrEqual(1);
        expect(rows.some((r) => r.measure_name === 'scoreData.total')).toBe(true);

        if (writeInsightSpy && writeInsightSpy.mock) {
            expect(writeInsightSpy).toHaveBeenCalled();
            const [extPath, filename, content, meta] = writeInsightSpy.mock.calls[0];
            expect(extPath).toBe(tmpDir);
            expect(filename).toMatch(/^research-/);
            expect(typeof content).toBe('string');
            expect(content.length).toBeGreaterThan(0);
            expect(meta).toMatchObject({ provider: 'research-module' });
        }
    });
});
