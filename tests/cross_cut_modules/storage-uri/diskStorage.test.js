/**
 * Unit tests for diskStorage module.
 */

const path = require('path');
const fs = require('fs');
const {
    getStorageDir,
    getGlobalStorageDir,
    ensureDirSync,
    keyToFilename,
    readFromDisk,
    readFromDiskSync,
    writeToDisk,
    writeToDiskSync,
    deleteFromDisk
} = require('../../../cross_cut_modules/storage-uri/diskStorage');

describe('diskStorage', () => {
    const tmpDir = path.join(__dirname, '../../../.tmp-disk-storage-test');
    let mockContext;

    beforeAll(() => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
        fs.mkdirSync(tmpDir, { recursive: true });
        mockContext = {
            storageUri: { fsPath: path.join(tmpDir, 'workspace') },
            globalStorageUri: { fsPath: path.join(tmpDir, 'global') }
        };
    });

    afterAll(() => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    });

    describe('getStorageDir', () => {
        it('returns path under storageUri when available', () => {
            const dir = getStorageDir(mockContext);
            expect(dir).toContain('workspace');
            expect(dir).toContain('vibeswitch-storage');
        });

        it('falls back to globalStorageUri when storageUri is null', () => {
            const ctx = { storageUri: null, globalStorageUri: { fsPath: tmpDir + '/global' } };
            const dir = getStorageDir(ctx);
            expect(dir).toContain('global');
        });

        it('returns null when context is null', () => {
            expect(getStorageDir(null)).toBeNull();
        });
    });

    describe('getGlobalStorageDir', () => {
        it('returns path under globalStorageUri', () => {
            const dir = getGlobalStorageDir(mockContext);
            expect(dir).toContain('global');
            expect(dir).toContain('vibeswitch-storage');
        });

        it('returns null when globalStorageUri is null', () => {
            expect(getGlobalStorageDir({ globalStorageUri: null })).toBeNull();
        });
    });

    describe('keyToFilename', () => {
        it('sanitizes key and adds .json', () => {
            expect(keyToFilename('foo.bar')).toBe('foo.bar.json');
            expect(keyToFilename('a:b:c')).toMatch(/\.json$/);
        });
    });

    describe('read/write/delete', () => {
        const testDir = path.join(tmpDir, 'rw-test');
        beforeAll(() => fs.mkdirSync(testDir, { recursive: true }));

        it('writeToDiskSync and readFromDiskSync round-trip', () => {
            writeToDiskSync(testDir, 'test-key', { a: 1, b: 'x' });
            const out = readFromDiskSync(testDir, 'test-key');
            expect(out).toEqual({ a: 1, b: 'x' });
        });

        it('readFromDiskSync returns undefined for missing key', () => {
            expect(readFromDiskSync(testDir, 'nonexistent')).toBeUndefined();
        });

        it('writeToDisk and readFromDisk round-trip (async)', async () => {
            await writeToDisk(testDir, 'async-key', [1, 2, 3]);
            const out = await readFromDisk(testDir, 'async-key');
            expect(out).toEqual([1, 2, 3]);
        });

        it('deleteFromDisk removes key', async () => {
            writeToDiskSync(testDir, 'to-delete', { x: 1 });
            expect(readFromDiskSync(testDir, 'to-delete')).toEqual({ x: 1 });
            await deleteFromDisk(testDir, 'to-delete');
            expect(readFromDiskSync(testDir, 'to-delete')).toBeUndefined();
        });
    });
});
