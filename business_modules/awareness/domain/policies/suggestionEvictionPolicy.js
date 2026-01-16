/**
 * SuggestionEvictionPolicy - Domain policy for suggestion eviction rules
 * 
 * Encapsulates business rules for when and how to evict suggestions from memory.
 * This is a stateless policy that can be configured per mode or environment.
 */

class SuggestionEvictionPolicy {
    /**
     * @param {number} maxSuggestions - Maximum total suggestions to keep (default: 5000)
     * @param {number} evictionThreshold - Threshold ratio for triggering eviction (default: 0.9)
     * @param {number} targetRatio - Target ratio after eviction (default: 0.8)
     */
    constructor({
        maxSuggestions = 5000,
        evictionThreshold = 0.9,
        targetRatio = 0.8
    } = {}) {
        this.maxSuggestions = maxSuggestions;
        this.evictionThreshold = evictionThreshold;
        this.targetRatio = targetRatio;
    }

    /**
     * Check if eviction should be triggered
     * @param {number} currentCount - Current number of suggestions
     * @returns {boolean} True if eviction should be triggered
     */
    shouldEvict(currentCount) {
        return currentCount >= this.maxSuggestions * this.evictionThreshold;
    }

    /**
     * Get target size after eviction
     * @param {number} currentCount - Current number of suggestions
     * @returns {number} Target size to evict down to
     */
    getEvictionTarget(currentCount) {
        return Math.floor(this.maxSuggestions * this.targetRatio);
    }

    /**
     * Get maximum suggestions allowed
     * @returns {number} Maximum suggestions
     */
    getMaxSuggestions() {
        return this.maxSuggestions;
    }
}

module.exports = SuggestionEvictionPolicy;
