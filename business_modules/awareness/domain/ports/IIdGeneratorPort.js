/**
 * IIdGeneratorPort - Port interface for ID generation
 * 
 * Defines the contract for generating unique identifiers.
 * Domain entities should use this port instead of directly using crypto or Date.now().
 */

class IIdGeneratorPort {
    constructor() {
        if (new.target === IIdGeneratorPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Generate a UUID
     * @returns {string} UUID string
     */
    generateUUID() {
        throw new Error('Method not implemented.');
    }

    /**
     * Generate a unique ID (fallback if UUID not available)
     * @returns {string} Unique ID string
     */
    generateId() {
        throw new Error('Method not implemented.');
    }
}

module.exports = IIdGeneratorPort;
