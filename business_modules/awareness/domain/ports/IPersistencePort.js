/**
 * IPersistencePort - Interface for persistence operations
 * 
 * This port abstracts storage operations, enabling:
 * - Testability with in-memory implementations
 * - Flexibility to swap storage backends (workspaceState, file system, etc.)
 * - Clear separation between domain and infrastructure
 * 
 * Implementations should wrap the actual storage mechanism (e.g., VS Code workspaceState).
 */

/**
 * @interface IPersistencePort
 */
class IPersistencePort {
    /**
     * Save a value asynchronously
     * @param {string} key - Storage key
     * @param {*} value - Value to save (must be JSON-serializable)
     * @returns {Promise<void>}
     */
    async save(key, value) {
        throw new Error('save not implemented');
    }

    /**
     * Load a value asynchronously
     * @param {string} key - Storage key
     * @returns {Promise<*>} Stored value or undefined
     */
    async load(key) {
        throw new Error('load not implemented');
    }

    /**
     * Delete a value asynchronously
     * @param {string} key - Storage key
     * @returns {Promise<void>}
     */
    async delete(key) {
        throw new Error('delete not implemented');
    }

    /**
     * Save a value synchronously
     * @param {string} key - Storage key
     * @param {*} value - Value to save (must be JSON-serializable)
     * @returns {void}
     */
    saveSync(key, value) {
        throw new Error('saveSync not implemented');
    }

    /**
     * Load a value synchronously
     * @param {string} key - Storage key
     * @returns {*} Stored value or undefined
     */
    loadSync(key) {
        throw new Error('loadSync not implemented');
    }
}

module.exports = IPersistencePort;



