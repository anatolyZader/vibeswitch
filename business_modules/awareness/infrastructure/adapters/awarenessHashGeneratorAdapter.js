/**
 * AwarenessHashGeneratorAdapter - Adapter implementing IHashGeneratorPort
 * 
 * Provides hashing functionality using crypto module.
 */

const IHashGeneratorPort = require('../../domain/ports/IHashGeneratorPort');
const crypto = require('crypto');

class AwarenessHashGeneratorAdapter extends IHashGeneratorPort {
    constructor() {
        super();
    }

    /**
     * Create a hash from data
     * @param {string} algorithm - Hash algorithm (e.g., 'md5', 'sha256')
     * @param {string|Buffer} data - Data to hash
     * @returns {string} Hash string (hex)
     */
    createHash(algorithm, data) {
        return crypto.createHash(algorithm).update(data).digest('hex');
    }
}

module.exports = AwarenessHashGeneratorAdapter;
