/**
 * AwarenessIdGeneratorAdapter - Adapter implementing IIdGeneratorPort
 * 
 * Provides ID generation functionality using crypto module.
 */

const IIdGeneratorPort = require('../../domain/ports/IIdGeneratorPort');
const crypto = require('crypto');

class AwarenessIdGeneratorAdapter extends IIdGeneratorPort {
    constructor() {
        super();
        this._idSeq = 0; // Monotonic counter for fallback IDs
    }

    /**
     * Generate a UUID
     * @returns {string} UUID string
     */
    generateUUID() {
        try {
            if (crypto.randomUUID) {
                return crypto.randomUUID();
            } else {
                // Fallback if randomUUID not available
                return this.generateId();
            }
        } catch (e) {
            return this.generateId();
        }
    }

    /**
     * Generate a unique ID (fallback if UUID not available)
     * @returns {string} Unique ID string
     */
    generateId() {
        this._idSeq = (this._idSeq || 0) + 1;
        return `${Date.now()}-${this._idSeq}`;
    }
}

module.exports = AwarenessIdGeneratorAdapter;
