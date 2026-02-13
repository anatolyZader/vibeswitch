/**
 * Unified disk-backed storage for global keys (mode, setupPromptShown, research lastRun).
 * Migrates from globalState on first use. All extension persistent data in one place.
 */

const {
    getGlobalStorageDir,
    readFromDiskSync,
    writeToDiskSync,
    ensureDirSync
} = require('./diskStorage');

const GLOBAL_KEYS = [
    'vibeswitch.mode',
    'vibeswitch.setupPromptShown',
    'vibeswitch.research.lastRun'
];
const MIGRATION_MARKER = 'vibeswitch.globalKeys.migrated';

/**
 * Migrate global keys from globalState to disk (one-time).
 * @param {vscode.ExtensionContext} context
 */
function migrateGlobalKeys(context) {
    if (!context?.globalState) return;
    if (context.globalState.get(MIGRATION_MARKER, false)) return;
    const dir = getGlobalStorageDir(context);
    if (!dir) return;
    try {
        ensureDirSync(dir);
        for (const key of GLOBAL_KEYS) {
            const value = context.globalState.get(key);
            if (value !== undefined) {
                writeToDiskSync(dir, key, value);
            }
        }
        context.globalState.update(MIGRATION_MARKER, true).catch(() => {});
        for (const key of GLOBAL_KEYS) {
            context.globalState.update(key, undefined).catch(() => {});
        }
    } catch { /* ignore */ }
}

/**
 * Get a global key (sync). Uses disk; falls back to globalState if disk unavailable.
 * @param {vscode.ExtensionContext} context
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
function getGlobalKey(context, key, defaultValue = undefined) {
    migrateGlobalKeys(context);
    const dir = getGlobalStorageDir(context);
    if (dir) {
        const value = readFromDiskSync(dir, key);
        if (value !== undefined) return value;
    }
    return context?.globalState?.get(key, defaultValue) ?? defaultValue;
}

/**
 * Set a global key (async). Uses disk; falls back to globalState if disk unavailable.
 * @param {vscode.ExtensionContext} context
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
async function setGlobalKey(context, key, value) {
    migrateGlobalKeys(context);
    const dir = getGlobalStorageDir(context);
    if (dir) {
        try {
            ensureDirSync(dir);
            writeToDiskSync(dir, key, value);
            return;
        } catch { /* fall through */ }
    }
    if (context?.globalState) {
        await context.globalState.update(key, value);
    }
}

/**
 * Set a global key (sync, fire-and-forget). Uses disk.
 * @param {vscode.ExtensionContext} context
 * @param {string} key
 * @param {*} value
 */
function setGlobalKeySync(context, key, value) {
    migrateGlobalKeys(context);
    const dir = getGlobalStorageDir(context);
    if (dir) {
        try {
            ensureDirSync(dir);
            writeToDiskSync(dir, key, value);
            return;
        } catch { /* fall through */ }
    }
    if (context?.globalState) {
        context.globalState.update(key, value).catch(() => {});
    }
}

module.exports = {
    getGlobalKey,
    setGlobalKey,
    setGlobalKeySync,
    GLOBAL_KEYS,
    MIGRATION_MARKER
};
