/**
 * Score - Value object for awareness scores
 * 
 * Encapsulates score validation and business rules.
 */

class Score {
    constructor(value) {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error('Score must be a valid number');
        }
        if (value < 0 || value > 100) {
            throw new Error('Score must be between 0 and 100');
        }
        this.value = Math.round(value * 100) / 100; // Round to 2 decimal places
    }

    equals(other) {
        return other instanceof Score && this.value === other.value;
    }

    toNumber() {
        return this.value;
    }

    toString() {
        return this.value.toString();
    }

    /**
     * Check if score is in a critical range (high awareness needed)
     * @returns {boolean} True if score >= 70
     */
    isCritical() {
        return this.value >= 70;
    }

    /**
     * Check if score is in a warning range
     * @returns {boolean} True if score >= 40 and < 70
     */
    isWarning() {
        return this.value >= 40 && this.value < 70;
    }

    /**
     * Check if score is in a safe range
     * @returns {boolean} True if score < 40
     */
    isSafe() {
        return this.value < 40;
    }
}

module.exports = Score;

