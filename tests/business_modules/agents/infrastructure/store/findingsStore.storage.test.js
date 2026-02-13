/**
 * Tests for FindingsStore disk storage and migration.
 */

const path = require('path');
const fs = require('fs');
const FindingsStore = require('../../../../../business_modules/agents/infrastructure/store/findingsStore');

describe('FindingsStore disk storage', () => {
    const tmpDir = path.join(__dirname, '../../../../../.tmp-findings-store-test');
    let mockContext;

    beforeAll(() => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.mkdirSync(path.join(tmpDir, 'ws'), { recursive: true });
        mockContext = {
            storageUri: { fsPath: path.join(tmpDir, 'ws') },
            globalStorageUri: { fsPath: path.join(tmpDir, 'global') },
            workspaceState: {
                get: jest.fn().mockReturnValue(undefined),
                update: jest.fn().mockResolvedValue(undefined)
            }
        };
    });

    afterAll(() => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    });

    beforeEach(() => {
        mockContext.workspaceState.get.mockImplementation((key) => {
            if (key === 'vibeswitch.agents.findings.migrated') return false;
            return undefined;
        });
    });

    it('stores and retrieves findings', () => {
        const store = new FindingsStore(mockContext);
        store.storeFindings('ws1', 'main', 'abc123', 'corr-1', [
            { category: 'qa', severity: 'info', correlationId: 'corr-1' }
        ]);
        const found = store.getFindings('ws1', 'main', 'abc123');
        expect(found).toHaveLength(1);
        expect(found[0].category).toBe('qa');
    });

    it('persists to disk and survives reload', () => {
        const store1 = new FindingsStore(mockContext);
        store1.storeFindings('ws1', 'main', 'c1', 'corr-1', [{ category: 'security' }]);
        const store2 = new FindingsStore(mockContext);
        const found = store2.getFindings('ws1', 'main', 'c1');
        expect(found).toHaveLength(1);
        expect(found[0].category).toBe('security');
    });

    it('migrates from workspaceState when disk empty', () => {
        const existingData = {
            'ws1:main:abc': [{ category: 'qa', severity: 'info', correlationId: 'x' }]
        };
        mockContext.workspaceState.get.mockImplementation((key) => {
            if (key === 'vibeswitch.agents.findings.migrated') return false;
            if (key === 'vibeswitch.agents.findings') return existingData;
            return undefined;
        });
        const store = new FindingsStore(mockContext);
        const found = store.getFindings('ws1', 'main', 'abc');
        expect(found).toHaveLength(1);
        expect(found[0].category).toBe('qa');
    });
});
