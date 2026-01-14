/**
 * SuggestionStatusScheduler - Coalescing scheduler for suggestion status checks
 * 
 * Ensures only one outstanding timer per suggestion ID to prevent duplicate checks/events.
 * All timers are managed through TimerRegistry for proper cleanup.
 */

class SuggestionStatusScheduler {
    /**
     * @param {TimerRegistry} timerRegistry - Timer registry (required)
     * @param {Function} isActive - Function to check if service is active (required)
     * @param {string} instanceId - Instance ID for generation-based cancellation (required)
     */
    constructor(timerRegistry, isActive, instanceId) {
        if (!timerRegistry) {
            throw new Error('SuggestionStatusScheduler requires timerRegistry');
        }
        if (!isActive || typeof isActive !== 'function') {
            throw new Error('SuggestionStatusScheduler requires isActive function');
        }
        if (!instanceId) {
            throw new Error('SuggestionStatusScheduler requires instanceId');
        }

        this.timerRegistry = timerRegistry;
        this.isActive = isActive;
        this.instanceId = instanceId;
        
        // Track outstanding timers per suggestion ID (one timer per suggestion)
        this.outstandingTimers = new Map(); // suggestionId -> timer
    }

    /**
     * Schedule a status check for a suggestion
     * If a timer already exists for this suggestion, it will be cancelled and replaced.
     * @param {string} suggestionId - Suggestion ID
     * @param {Function} checkCallback - Callback to execute (checkSuggestionStatus)
     * @param {number} delayMs - Delay in milliseconds (default: 5000)
     */
    schedule(suggestionId, checkCallback, delayMs = 5000) {
        if (!suggestionId || !checkCallback) {
            return;
        }

        // Cancel existing timer for this suggestion if any
        this.cancel(suggestionId);

        // Capture instance ID at timer creation for generation-based cancellation
        const instanceId = this.instanceId;

        // Create new timer through registry
        const timer = this.timerRegistry.setTimeout(() => {
            // Remove from outstanding timers
            this.outstandingTimers.delete(suggestionId);
            
            // Generation-based cancellation: only execute if instance ID matches
            if (this.instanceId !== instanceId) {
                return; // Instance was restarted, ignore this timer
            }
            
            // Only execute if service is still active
            if (this.isActive()) {
                checkCallback();
            }
        }, delayMs);

        // Track this timer
        this.outstandingTimers.set(suggestionId, timer);
    }

    /**
     * Cancel a scheduled status check for a suggestion
     * @param {string} suggestionId - Suggestion ID
     */
    cancel(suggestionId) {
        const timer = this.outstandingTimers.get(suggestionId);
        if (timer) {
            this.timerRegistry.clearTimeout(timer);
            this.outstandingTimers.delete(suggestionId);
        }
    }

    /**
     * Cancel all outstanding status checks
     */
    cancelAll() {
        for (const [suggestionId, timer] of this.outstandingTimers.entries()) {
            this.timerRegistry.clearTimeout(timer);
        }
        this.outstandingTimers.clear();
    }

    /**
     * Get count of outstanding timers
     * @returns {number} Number of outstanding timers
     */
    getOutstandingCount() {
        return this.outstandingTimers.size;
    }
}

module.exports = SuggestionStatusScheduler;
