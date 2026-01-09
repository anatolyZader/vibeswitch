/**
 * Mode - Value object for VibeSwitch mode
 * 
 * Represents the current mode: 'dev' (awareness monitoring) or 'vibe' (no monitoring).
 */

class Mode {
    constructor(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('Mode must be a non-empty string');
        }
        const normalized = value.toLowerCase().trim();
        if (normalized !== 'dev' && normalized !== 'vibe') {
            throw new Error(`Invalid mode: ${value}. Must be 'dev' or 'vibe'`);
        }
        this.value = normalized;
    }

    equals(other) {
        return other instanceof Mode && this.value === other.value;
    }

    toString() {
        return this.value;
    }

    /**
     * Check if mode is 'dev'
     * @returns {boolean} True if mode is 'dev'
     */
    isDev() {
        return this.value === 'dev';
    }

    /**
     * Check if mode is 'vibe'
     * @returns {boolean} True if mode is 'vibe'
     */
    isVibe() {
        return this.value === 'vibe';
    }

    static DEV = new Mode('dev');
    static VIBE = new Mode('vibe');
}

module.exports = Mode;

