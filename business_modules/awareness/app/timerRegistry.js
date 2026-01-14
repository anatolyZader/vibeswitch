/**
 * TimerRegistry - Centralized timer management for awareness module
 * 
 * Provides a single point of control for all timers, ensuring they can be
 * properly cleaned up on service stop/dispose. This prevents "stuck state"
 * bugs where timers fire after the service has been stopped.
 */

class TimerRegistry {
    constructor() {
        // Track all active timers with owner tags for selective clearing
        this.timeouts = new Map(); // timer -> { owner: string, callback: Function }
        this.intervals = new Map(); // timer -> { owner: string, callback: Function }
    }

    /**
     * Create a timeout that will be tracked and can be cleared
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @param {string} owner - Optional owner tag for selective clearing (e.g., 'reviewTracking', 'statusCheck')
     * @returns {Object} Timer ID (Node.js Timeout object)
     */
    setTimeout(callback, delay, owner = 'default') {
        const timer = setTimeout(() => {
            this.timeouts.delete(timer);
            callback();
        }, delay);
        this.timeouts.set(timer, { owner, callback });
        return timer;
    }

    /**
     * Create an interval that will be tracked and can be cleared
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @param {string} owner - Optional owner tag for selective clearing
     * @returns {Object} Timer ID (Node.js Timeout object)
     */
    setInterval(callback, delay, owner = 'default') {
        const timer = setInterval(callback, delay);
        this.intervals.set(timer, { owner, callback });
        return timer;
    }

    /**
     * Clear a specific timeout
     * @param {Object} timer - Timer ID to clear
     */
    clearTimeout(timer) {
        if (timer) {
            clearTimeout(timer);
            this.timeouts.delete(timer);
        }
    }

    /**
     * Clear a specific interval
     * @param {Object} timer - Timer ID to clear
     */
    clearInterval(timer) {
        if (timer) {
            clearInterval(timer);
            this.intervals.delete(timer);
        }
    }

    /**
     * Clear all timers (timeouts and intervals)
     * Should be called on service stop/dispose
     * Alias: dispose() for consistency with VS Code patterns
     */
    clear() {
        this.dispose();
    }

    /**
     * Dispose - clear all timers (alias for clear() for consistency)
     */
    dispose() {
        // Clear all timeouts
        for (const timer of this.timeouts.keys()) {
            clearTimeout(timer);
        }
        this.timeouts.clear();

        // Clear all intervals
        for (const timer of this.intervals.keys()) {
            clearInterval(timer);
        }
        this.intervals.clear();
    }

    /**
     * Clear timers by owner tag
     * @param {string} owner - Owner tag to clear
     */
    clearByOwner(owner) {
        // Clear timeouts by owner
        for (const [timer, info] of this.timeouts.entries()) {
            if (info.owner === owner) {
                clearTimeout(timer);
                this.timeouts.delete(timer);
            }
        }

        // Clear intervals by owner
        for (const [timer, info] of this.intervals.entries()) {
            if (info.owner === owner) {
                clearInterval(timer);
                this.intervals.delete(timer);
            }
        }
    }

    /**
     * Get count of active timers
     * @returns {Object} { timeouts: number, intervals: number }
     */
    getCount() {
        return {
            timeouts: this.timeouts.size,
            intervals: this.intervals.size
        };
    }

    /**
     * Get count of timers by owner
     * @param {string} owner - Owner tag
     * @returns {Object} { timeouts: number, intervals: number }
     */
    getCountByOwner(owner) {
        let timeoutCount = 0;
        let intervalCount = 0;

        for (const info of this.timeouts.values()) {
            if (info.owner === owner) timeoutCount++;
        }
        for (const info of this.intervals.values()) {
            if (info.owner === owner) intervalCount++;
        }

        return { timeouts: timeoutCount, intervals: intervalCount };
    }
}

module.exports = TimerRegistry;
