/**
 * IHashGeneratorPort - Port interface for hashing operations
 * 
 * Defines the contract for generating hashes.
 * Domain entities should use this port instead of directly using crypto module.
 */

class IHashGeneratorPort {
    constructor() {
        if (new.target === IHashGeneratorPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Create a hash from data
     * @param {string} algorithm - Hash algorithm (e.g., 'md5', 'sha256')
     * @param {string|Buffer} data - Data to hash
     * @returns {string} Hash string (hex)
     */
    createHash(algorithm, data) {
        throw new Error('Method not implemented.');
    }
}

module.exports = IHashGeneratorPort;
