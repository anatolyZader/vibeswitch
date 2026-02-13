/**
 * Disk-backed storage using storageUri/globalStorageUri.
 * Stores JSON files on disk instead of workspaceState to avoid large extension state warnings.
 */

const fs = require('fs');
const path = require('path');

const STORAGE_DIR = 'vibeswitch-storage';
const MIGRATION_MARKER = 'vibeswitch.storage.migrated';

/**
 * Get the storage directory path. Uses storageUri (workspace) when available, else globalStorageUri.
 * @param {vscode.ExtensionContext} context
 * @returns {string|null} Absolute path to storage dir, or null if unavailable
 */
function getStorageDir(context) {
    if (!context) return null;
    const uri = context.storageUri || context.globalStorageUri;
    if (!uri || !uri.fsPath) return null;
    return path.join(uri.fsPath, STORAGE_DIR);
}

/**
 * Get the global storage directory (always globalStorageUri). Use for cross-workspace keys.
 * @param {vscode.ExtensionContext} context
 * @returns {string|null} Absolute path to global storage dir, or null if unavailable
 */
function getGlobalStorageDir(context) {
    if (!context || !context.globalStorageUri || !context.globalStorageUri.fsPath) return null;
    return path.join(context.globalStorageUri.fsPath, STORAGE_DIR);
}

/**
 * Ensure storage directory exists.
 * @param {string} dir
 * @returns {Promise<boolean>}
 */
async function ensureDir(dir) {
    if (!dir) return false;
    try {
        await fs.promises.mkdir(dir, { recursive: true });
        return true;
    } catch {
        return false;
    }
}

/**
 * Ensure storage directory exists (sync).
 * @param {string} dir
 * @returns {boolean}
 */
function ensureDirSync(dir) {
    if (!dir) return false;
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Sanitize key for use as filename (alphanumeric, dash, underscore only).
 * @param {string} key
 * @returns {string}
 */
function keyToFilename(key) {
    return key.replace(/[^a-zA-Z0-9._-]/g, '_') + '.json';
}

/**
 * Read JSON from disk.
 * @param {string} dir - Storage directory
 * @param {string} key - Storage key
 * @returns {Promise<*>} Parsed value or undefined
 */
async function readFromDisk(dir, key) {
    if (!dir) return undefined;
    const filePath = path.join(dir, keyToFilename(key));
    try {
        const raw = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        if (err.code === 'ENOENT') return undefined;
        throw err;
    }
}

/**
 * Read JSON from disk (sync).
 * @param {string} dir - Storage directory
 * @param {string} key - Storage key
 * @returns {*} Parsed value or undefined
 */
function readFromDiskSync(dir, key) {
    if (!dir) return undefined;
    const filePath = path.join(dir, keyToFilename(key));
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        if (err.code === 'ENOENT') return undefined;
        throw err;
    }
}

/**
 * Write JSON to disk.
 * @param {string} dir - Storage directory
 * @param {string} key - Storage key
 * @param {*} value - JSON-serializable value
 */
async function writeToDisk(dir, key, value) {
    if (!dir) return;
    if (!ensureDirSync(dir)) return;
    const filePath = path.join(dir, keyToFilename(key));
    const tempPath = filePath + '.tmp.' + Date.now();
    try {
        await fs.promises.writeFile(tempPath, JSON.stringify(value), 'utf8');
        await fs.promises.rename(tempPath, filePath);
    } catch (err) {
        try { await fs.promises.unlink(tempPath); } catch { /* ignore */ }
        throw err;
    }
}

/**
 * Write JSON to disk (sync).
 * @param {string} dir - Storage directory
 * @param {string} key - Storage key
 * @param {*} value - JSON-serializable value
 */
function writeToDiskSync(dir, key, value) {
    if (!dir) return;
    if (!ensureDirSync(dir)) return;
    const filePath = path.join(dir, keyToFilename(key));
    const tempPath = filePath + '.tmp.' + Date.now();
    try {
        fs.writeFileSync(tempPath, JSON.stringify(value), 'utf8');
        fs.renameSync(tempPath, filePath);
    } catch (err) {
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
        throw err;
    }
}

/**
 * Delete key from disk.
 * @param {string} dir - Storage directory
 * @param {string} key - Storage key
 */
async function deleteFromDisk(dir, key) {
    if (!dir) return;
    const filePath = path.join(dir, keyToFilename(key));
    try {
        await fs.promises.unlink(filePath);
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

module.exports = {
    getStorageDir,
    getGlobalStorageDir,
    ensureDir,
    ensureDirSync,
    keyToFilename,
    readFromDisk,
    readFromDiskSync,
    writeToDisk,
    writeToDiskSync,
    deleteFromDisk,
    STORAGE_DIR,
    MIGRATION_MARKER
};
