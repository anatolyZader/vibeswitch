/**
 * Unit tests for AwarenessStorageUriAdapter.
 */

const path = require('path');
const fs = require('fs');
const AwarenessStorageUriAdapter = require('../../../../../business_modules/awareness/infrastructure/adapters/awarenessStorageUriAdapter');

describe('AwarenessStorageUriAdapter', () => {
    const tmpDir = path.join(__dirname, '../../../../../.tmp-awareness-storage-test');
    let adapter;
    let mockContext;

    beforeAll(() => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.mkdirSync(path.join(tmpDir, 'ws'), { recursive: true });
        fs.mkdirSync(path.join(tmpDir, 'global'), { recursive: true });
        mockContext = {
            storageUri: { fsPath: path.join(tmpDir, 'ws') },
            globalStorageUri: { fsPath: path.join(tmpDir, 'global') },
            workspaceState: {
                get: jest.fn().mockReturnValue(false),
                update: jest.fn().mockResolvedValue(undefined)
            }
        };
    });

    afterAll(() => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    });

    beforeEach(() => {
        mockContext.workspaceState.get.mockReturnValue(false);
        adapter = new AwarenessStorageUriAdapter(mockContext);
    });

    it('implements save/load/delete', async () => {
        await adapter.save('test-key', { foo: 42 });
        const loaded = await adapter.load('test-key');
        expect(loaded).toEqual({ foo: 42 });

        await adapter.delete('test-key');
        expect(await adapter.load('test-key')).toBeUndefined();
    });

    it('implements saveSync/loadSync', () => {
        adapter.saveSync('sync-key', [1, 2, 3]);
        const loaded = adapter.loadSync('sync-key');
        expect(loaded).toEqual([1, 2, 3]);
    });

    it('migrates from workspaceState on first use', async () => {
        mockContext.workspaceState.get.mockImplementation((key) => {
            if (key === 'vibeswitch.storage.migrated') return false;
            if (key === 'debt') return { 'file:///a': { uri: 'file:///a', modifiedAt: Date.now() } };
            return undefined;
        });
        const a = new AwarenessStorageUriAdapter(mockContext);
        const loaded = await a.load('debt');
        expect(loaded).toBeDefined();
        expect(loaded['file:///a']).toBeDefined();
    });

    it('falls back to workspaceState when storageUri unavailable', async () => {
        const ctxNoStorage = {
            storageUri: null,
            globalStorageUri: null,
            workspaceState: {
                get: jest.fn().mockReturnValue({ x: 1 }),
                update: jest.fn().mockResolvedValue(undefined)
            }
        };
        const a = new AwarenessStorageUriAdapter(ctxNoStorage);
        const loaded = await a.load('fallback-key');
        expect(ctxNoStorage.workspaceState.get).toHaveBeenCalledWith('fallback-key');
    });
});
