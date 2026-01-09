/**
 * AwarenessFileSystemAdapter - Adapter implementing IFileSystemPort
 * 
 * Wraps Node.js fs module to provide filesystem operations to domain entities.
 */

const IFileSystemPort = require('../../domain/ports/IFileSystemPort');
const fs = require('fs');

class AwarenessFileSystemAdapter extends IFileSystemPort {
    constructor() {
        super();
    }

    /**
     * Watch a directory for changes
     * @param {string} path - Path to watch
     * @param {Object} options - Watch options (recursive, etc.)
     * @param {Function} callback - Callback function (eventType, filename)
     * @returns {Object} Watcher object with close() method
     */
    watch(path, options, callback) {
        return fs.watch(path, options, callback);
    }

    /**
     * Get file stats asynchronously
     * @param {string} path - File path
     * @param {Function} callback - Callback function (err, stats)
     */
    stat(path, callback) {
        fs.stat(path, callback);
    }

    /**
     * Read directory contents synchronously
     * @param {string} path - Directory path
     * @param {Object} options - Options (withFileTypes, etc.)
     * @returns {Array} Array of directory entries
     */
    readdirSync(path, options) {
        return fs.readdirSync(path, options);
    }

    /**
     * Read file contents synchronously
     * @param {string} path - File path
     * @param {string} encoding - File encoding (default: 'utf8')
     * @returns {string|Buffer} File contents
     */
    readFileSync(path, encoding = 'utf8') {
        return fs.readFileSync(path, encoding);
    }
}

module.exports = AwarenessFileSystemAdapter;
