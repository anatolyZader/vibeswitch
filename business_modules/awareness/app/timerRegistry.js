/**
 * TimerRegistry - Centralized timer management for awareness module
 * 
 * Provides a single point of control for all timers, ensuring they can be
 * properly cleaned up on service stop/dispose. This prevents "stuck state"
 * bugs where timers fire after the service has been stopped.
 */

class TimerRegistry {
    constructor() {
        // Track all active timers
        this.timeouts = new Set();
        this.intervals = new Set();
    }

    /**
     * Create a timeout that will be tracked and can be cleared
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {Object} Timer ID (Node.js Timeout object)
     */
    setTimeout(callback, delay) {
        const timer = setTimeout(() => {
            this.timeouts.delete(timer);
            callback();
        }, delay);
        this.timeouts.add(timer);
        return timer;
    }

    /**
     * Create an interval that will be tracked and can be cleared
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {Object} Timer ID (Node.js Timeout object)
     */
    setInterval(callback, delay) {
        const timer = setInterval(callback, delay);
        this.intervals.add(timer);
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
     */
    clear() {
        // Clear all timeouts
        for (const timer of this.timeouts) {
            clearTimeout(timer);
        }
        this.timeouts.clear();

        // Clear all intervals
        for (const timer of this.intervals) {
            clearInterval(timer);
        }
        this.intervals.clear();
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
}

module.exports = TimerRegistry;
