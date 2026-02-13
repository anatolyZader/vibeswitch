/**
 * AwarenessStorageUriAdapter - Disk-backed persistence implementing IAwarenessPersistencePort
 *
 * Uses storageUri/globalStorageUri to store data on disk instead of workspaceState,
 * addressing the "large extension state" warning (747KB+).
 *
 * Migrates existing workspaceState data to disk on first use.
 */

const IAwarenessPersistencePort = require('../../domain/ports/IAwarenessPersistencePort');
const {
    getStorageDir,
    readFromDisk,
    readFromDiskSync,
    writeToDisk,
    writeToDiskSync,
    deleteFromDisk,
    ensureDirSync,
    MIGRATION_MARKER
} = require('../../../../cross_cut_modules/storage-uri/diskStorage');

const AWARENESS_KEYS = [
    'vibeswitch.changeLedger.v1',
    'vibeswitch.changeLedger.checkpoint.v1',
    'debt'
];

class AwarenessStorageUriAdapter extends IAwarenessPersistencePort {
    /**
     * @param {vscode.ExtensionContext} context - Must have storageUri or globalStorageUri
     */
    constructor(context) {
        super();
        if (!context) {
            throw new Error('AwarenessStorageUriAdapter requires context');
        }
        this.context = context;
        this._dir = getStorageDir(context);
        this._fallback = null;
        this._migrated = false;
    }

    /**
     * Get fallback workspaceState adapter (for migration and when storageUri unavailable)
     */
    _getFallback() {
        if (!this._fallback && this.context.workspaceState) {
            const AwarenessWorkspaceStateAdapter = require('./awarenessWorkspaceStateAdapter');
            this._fallback = new AwarenessWorkspaceStateAdapter(this.context);
        }
        return this._fallback;
    }

    /**
     * Migrate data from workspaceState to disk (one-time)
     */
    async _migrateIfNeeded() {
        if (this._migrated) return;
        if (!this._dir) return;
        // Check if already migrated
        const marker = this.context.workspaceState?.get(MIGRATION_MARKER, false);
        if (marker) {
            this._migrated = true;
            return;
        }
        const ws = this.context.workspaceState;
        if (!ws) {
            this._migrated = true;
            return;
        }
        try {
            ensureDirSync(this._dir);
            for (const key of AWARENESS_KEYS) {
                const value = ws.get(key);
                if (value !== undefined && value !== null) {
                    await writeToDisk(this._dir, key, value);
                }
            }
            await ws.update(MIGRATION_MARKER, true);
            // Clear old keys from workspaceState to free space
            for (const key of AWARENESS_KEYS) {
                await ws.update(key, undefined);
            }
            this._migrated = true;
        } catch (err) {
            // Migration failed; will use fallback
        }
    }

    _migrateSync() {
        if (this._migrated) return;
        const marker = this.context.workspaceState?.get(MIGRATION_MARKER, false);
        if (marker) {
            this._migrated = true;
            return;
        }
        const ws = this.context.workspaceState;
        if (!ws || !this._dir) {
            this._migrated = true;
            return;
        }
        try {
            ensureDirSync(this._dir);
            for (const key of AWARENESS_KEYS) {
                const value = ws.get(key);
                if (value !== undefined && value !== null) {
                    writeToDiskSync(this._dir, key, value);
                }
            }
            ws.update(MIGRATION_MARKER, true).catch(() => {});
            this._migrated = true;
        } catch {
            // ignore
        }
    }

    async save(key, value) {
        await this._migrateIfNeeded();
        if (this._dir) {
            await writeToDisk(this._dir, key, value);
            return;
        }
        const fb = this._getFallback();
        if (fb) await fb.save(key, value);
    }

    async load(key) {
        await this._migrateIfNeeded();
        if (this._dir) {
            return readFromDisk(this._dir, key);
        }
        const fb = this._getFallback();
        return fb ? fb.load(key) : undefined;
    }

    async delete(key) {
        await this._migrateIfNeeded();
        if (this._dir) {
            await deleteFromDisk(this._dir, key);
            return;
        }
        const fb = this._getFallback();
        if (fb) await fb.delete(key);
    }

    saveSync(key, value) {
        this._migrateSync();
        if (this._dir) {
            try {
                writeToDiskSync(this._dir, key, value);
            } catch {
                writeToDisk(this._dir, key, value).catch(() => {});
            }
            return;
        }
        const fb = this._getFallback();
        if (fb) fb.saveSync(key, value);
    }

    loadSync(key) {
        this._migrateSync();
        if (this._dir) {
            return readFromDiskSync(this._dir, key);
        }
        const fb = this._getFallback();
        return fb ? fb.loadSync(key) : undefined;
    }
}

module.exports = AwarenessStorageUriAdapter;
