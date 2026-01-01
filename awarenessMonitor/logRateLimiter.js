/**
 * Log Rate Limiter
 * Prevents log spam from high-frequency events by limiting logs to once per time window
 * Includes LRU cache to prevent memory leaks
 */

class LogRateLimiter {
    constructor(windowMs = 5000, maxSize = 500) {
        this.windowMs = windowMs;
        this.maxSize = maxSize;
        this.lastLogTime = new Map(); // key -> last log timestamp
    }

    /**
     * Normalize key to prevent memory leaks from full file paths
     * Uses basename or URI hash for consistency
     * @param {string} key - Original key
     * @returns {string} Normalized key
     * @private
     */
    _normalizeKey(key) {
        // If key contains full path, extract basename or use hash
        if (key.includes('/') || key.includes('\\')) {
            // Try to extract basename from common patterns
            const basenameMatch = key.match(/([^/\\]+)$/);
            if (basenameMatch) {
                return basenameMatch[1];
            }
        }
        return key;
    }

    /**
     * Check if logging is allowed for a given key
     * @param {string} key - Unique key for this log source (e.g., 'onTextChange:file.js')
     * @returns {boolean} True if logging is allowed
     */
    shouldLog(key) {
        // Normalize key to prevent memory leaks
        const normalizedKey = this._normalizeKey(key);
        
        // Enforce max size (LRU-like behavior)
        if (this.lastLogTime.size >= this.maxSize) {
            // Remove oldest entries (simple approach: remove first 10%)
            const entries = Array.from(this.lastLogTime.entries());
            const toRemove = Math.floor(this.maxSize * 0.1);
            for (let i = 0; i < toRemove; i++) {
                this.lastLogTime.delete(entries[i][0]);
            }
        }
        
        const now = Date.now();
        const lastTime = this.lastLogTime.get(normalizedKey) || 0;
        
        if (now - lastTime >= this.windowMs) {
            this.lastLogTime.set(normalizedKey, now);
            return true;
        }
        
        return false;
    }

    /**
     * Reset rate limiter for a key (for testing)
     * @param {string} key - Key to reset
     */
    reset(key) {
        const normalizedKey = this._normalizeKey(key);
        this.lastLogTime.delete(normalizedKey);
    }

    /**
     * Clear all rate limit state
     */
    clear() {
        this.lastLogTime.clear();
    }
}

module.exports = LogRateLimiter;
