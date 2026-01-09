/**
 * IFileSystemPort - Port interface for filesystem operations
 * 
 * Defines the contract for filesystem access.
 * Domain entities should use this port instead of directly importing fs module.
 */

class IFileSystemPort {
    constructor() {
        if (new.target === IFileSystemPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Watch a directory for changes
     * @param {string} path - Path to watch
     * @param {Object} options - Watch options (recursive, etc.)
     * @param {Function} callback - Callback function (eventType, filename)
     * @returns {Object} Watcher object with close() method
     */
    watch(path, options, callback) {
        throw new Error('Method not implemented.');
    }

    /**
     * Get file stats asynchronously
     * @param {string} path - File path
     * @param {Function} callback - Callback function (err, stats)
     */
    stat(path, callback) {
        throw new Error('Method not implemented.');
    }

    /**
     * Read directory contents synchronously
     * @param {string} path - Directory path
     * @param {Object} options - Options (withFileTypes, etc.)
     * @returns {Array} Array of directory entries
     */
    readdirSync(path, options) {
        throw new Error('Method not implemented.');
    }

    /**
     * Read file contents synchronously
     * @param {string} path - File path
     * @param {string} encoding - File encoding (default: 'utf8')
     * @returns {string|Buffer} File contents
     */
    readFileSync(path, encoding = 'utf8') {
        throw new Error('Method not implemented.');
    }
}

module.exports = IFileSystemPort;
