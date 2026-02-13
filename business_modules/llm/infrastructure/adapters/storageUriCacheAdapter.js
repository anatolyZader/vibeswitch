/**
 * StorageUriCacheAdapter - Disk-backed cache using storageUri/globalStorageUri
 *
 * Replaces WorkspaceStateCacheAdapter to avoid large extension state.
 * Stores cached insight bundles as JSON files on disk.
 */

const {
    getStorageDir,
    readFromDisk,
    writeToDisk,
    deleteFromDisk,
    ensureDirSync
} = require('../../../../cross_cut_modules/storage-uri/diskStorage');

const CACHE_PREFIX = 'llm.cache.';

class StorageUriCacheAdapter {
    /**
     * @param {vscode.ExtensionContext} context
     */
    constructor(context) {
        this.context = context;
        this._dir = context ? getStorageDir(context) : null;
    }

    async get(key) {
        if (!this._dir) return null;
        try {
            const raw = await readFromDisk(this._dir, CACHE_PREFIX + key);
            if (!raw || typeof raw !== 'object' || !('value' in raw)) return null;
            const ts = typeof raw.ts === 'number' ? raw.ts : 0;
            const ttlMs = typeof raw.ttlMs === 'number' ? raw.ttlMs : null;
            if (ttlMs && ts && (Date.now() - ts) > ttlMs) {
                await deleteFromDisk(this._dir, CACHE_PREFIX + key);
                return null;
            }
            return raw.value;
        } catch {
            return null;
        }
    }

    async set(key, value, options = {}) {
        if (!this._dir) return;
        const ttlMs = options.ttlMs;
        const payload = {
            value,
            ts: Date.now(),
            ttlMs: typeof ttlMs === 'number' ? ttlMs : null
        };
        try {
            ensureDirSync(this._dir);
            await writeToDisk(this._dir, CACHE_PREFIX + key, payload);
        } catch {
            // ignore
        }
    }
}

module.exports = StorageUriCacheAdapter;
