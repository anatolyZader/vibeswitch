/**
 * astCache - In-memory cache for AST and derived data. Key: filePath + mtime + size.
 */

const DEFAULT_MAX_ENTRIES = 200;

function createAstCache(maxEntries) {
    const max = typeof maxEntries === 'number' && maxEntries > 0 ? maxEntries : DEFAULT_MAX_ENTRIES;
    const map = new Map();
    const order = [];

    function key(filePath, mtime, size) {
        return (filePath || '') + '\n' + (mtime ?? '') + '\n' + (size ?? '');
    }

    function get(filePath, mtime, size) {
        const k = key(filePath, mtime, size);
        return map.get(k) || null;
    }

    function set(filePath, mtime, size, value) {
        const k = key(filePath, mtime, size);
        if (map.has(k)) {
            const i = order.indexOf(k);
            if (i >= 0) order.splice(i, 1);
        }
        map.set(k, value);
        order.push(k);
        while (order.length > max) {
            const old = order.shift();
            map.delete(old);
        }
    }

    function clear() {
        map.clear();
        order.length = 0;
    }

    return { get, set, clear };
}

module.exports = { createAstCache };
