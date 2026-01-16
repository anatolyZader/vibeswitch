/**
 * KeepAllDetectionPolicy - Domain policy for "keep all" pattern detection
 * 
 * Encapsulates business rules for detecting when a user accepts multiple suggestions
 * rapidly, indicating they clicked "Keep All" button.
 * This is a stateless policy that can be configured per mode or environment.
 */

class KeepAllDetectionPolicy {
    /**
     * @param {number} windowMs - Detection window in milliseconds (default: 2000)
     * @param {number} threshold - Minimum number of acceptances to trigger (default: 3)
     */
    constructor({
        windowMs = 2000,
        threshold = 3
    } = {}) {
        this.windowMs = windowMs;
        this.threshold = threshold;
    }

    /**
     * Check if a pattern of acceptances matches "keep all" criteria
     * @param {Array<Object>} acceptances - Array of acceptance entries with {timestamp, ...}
     * @param {number} now - Current timestamp (default: Date.now())
     * @returns {boolean} True if pattern matches "keep all"
     */
    isKeepAllPattern(acceptances, now = Date.now()) {
        if (!acceptances || acceptances.length === 0) return false;
        
        // Filter to recent acceptances within window
        const recent = acceptances.filter(entry => 
            (now - entry.timestamp) < this.windowMs
        );
        
        return recent.length >= this.threshold;
    }

    /**
     * Get unique files affected by recent acceptances
     * @param {Array<Object>} acceptances - Array of acceptance entries
     * @param {number} now - Current timestamp (default: Date.now())
     * @returns {Set<string>} Set of unique file paths
     */
    getAffectedFiles(acceptances, now = Date.now()) {
        if (!acceptances || acceptances.length === 0) return new Set();
        
        const recent = acceptances.filter(entry => 
            (now - entry.timestamp) < this.windowMs
        );
        
        return new Set(recent.map(e => e.document));
    }

    /**
     * Get total size of recent acceptances
     * @param {Array<Object>} acceptances - Array of acceptance entries with {size, ...}
     * @param {number} now - Current timestamp (default: Date.now())
     * @returns {number} Total size in characters
     */
    getTotalSize(acceptances, now = Date.now()) {
        if (!acceptances || acceptances.length === 0) return 0;
        
        const recent = acceptances.filter(entry => 
            (now - entry.timestamp) < this.windowMs
        );
        
        return recent.reduce((sum, e) => sum + (e.size || 0), 0);
    }

    /**
     * Get detection window in milliseconds
     * @returns {number} Window size in milliseconds
     */
    getWindowMs() {
        return this.windowMs;
    }

    /**
     * Get threshold count
     * @returns {number} Minimum acceptances to trigger
     */
    getThreshold() {
        return this.threshold;
    }
}

module.exports = KeepAllDetectionPolicy;
