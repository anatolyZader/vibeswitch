/**
 * ICachePort (interface)
 *
 * Key/value cache for InsightBundles.
 * Implementations may use workspaceState, in-memory, disk, etc.
 */
class ICachePort {
    // eslint-disable-next-line no-unused-vars
    async get(key) {
        throw new Error('ICachePort.get not implemented');
    }

    // eslint-disable-next-line no-unused-vars
    async set(key, value, options = {}) {
        throw new Error('ICachePort.set not implemented');
    }
}

module.exports = ICachePort;

