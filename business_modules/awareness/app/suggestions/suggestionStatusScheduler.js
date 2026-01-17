/**
 * SuggestionStatusScheduler - Coalescing scheduler for suggestion status checks
 * 
 * Ensures only one outstanding timer per suggestion ID to prevent duplicate checks/events.
 * All timers are managed through TimerRegistry for proper cleanup.
 * Uses generation-based cancellation to prevent zombie timers after engine restarts.
 */

class SuggestionStatusScheduler {
    /**
     * @param {TimerRegistry} timerRegistry - Timer registry (required)
     * @param {Function} isActive - Function to check if service is active (required)
     * @param {Function} getInstanceId - Getter function for current instance ID (required)
     * @param {ILoggerPort} loggerPort - Logger port (optional)
     */
    constructor(timerRegistry, isActive, getInstanceId, loggerPort = null) {
        if (!timerRegistry) {
            throw new Error('SuggestionStatusScheduler requires timerRegistry');
        }
        if (!isActive || typeof isActive !== 'function') {
            throw new Error('SuggestionStatusScheduler requires isActive function');
        }
        if (!getInstanceId || typeof getInstanceId !== 'function') {
            throw new Error('SuggestionStatusScheduler requires getInstanceId function');
        }

        this.timerRegistry = timerRegistry;
        this.isActive = isActive;
        this.getInstanceId = getInstanceId;
        this.loggerPort = loggerPort;
        
        // Track outstanding timers per suggestion ID (one timer per suggestion)
        this.scheduledChecks = new Map(); // suggestionId -> timer
    }

    /**
     * Schedule a status check for a suggestion
     * If a timer already exists for this suggestion, it will be cancelled and replaced.
     * @param {string} suggestionId - Suggestion ID
     * @param {Function} callback - Callback to execute when the timer fires
     * @param {number} delayMs - Delay in milliseconds before the callback is executed
     */
    schedule(suggestionId, callback, delayMs) {
        if (!this.isActive()) {
            this.loggerPort?.debug(`Scheduler: Not active, skipping schedule for ${suggestionId}`);
            return;
        }

        // Cancel any existing timer for this suggestion
        this.cancel(suggestionId);

        // Capture generation at schedule time (critical for zombie timer prevention)
        const scheduledGen = this.getInstanceId();

        const timer = this.timerRegistry.setTimeout(() => {
            // Delete first to ensure cleanup even if callback throws
            this.scheduledChecks.delete(suggestionId);
            
            // Hard guard: generation must still match (prevents zombie timers after restart)
            if (this.getInstanceId() !== scheduledGen) {
                this.loggerPort?.debug(`Scheduler: Generation mismatch for ${suggestionId}, ignoring timer.`);
                return;
            }
            
            if (!this.isActive()) {
                this.loggerPort?.debug(`Scheduler: Service not active for ${suggestionId}, ignoring timer.`);
                return;
            }
            
            // Execute callback with error handling
            try {
                callback();
            } catch (error) {
                this.loggerPort?.error(`Scheduler: Error in callback for ${suggestionId}`, error);
            }
        }, delayMs, 'statusCheck'); // Tag timer with owner

        this.scheduledChecks.set(suggestionId, timer);
        this.loggerPort?.debug(`Scheduler: Scheduled check for ${suggestionId} in ${delayMs}ms`);
    }

    /**
     * Cancel a scheduled status check for a specific suggestion
     * @param {string} suggestionId - The ID of the suggestion whose check should be cancelled
     */
    cancel(suggestionId) {
        const timer = this.scheduledChecks.get(suggestionId);
        if (!timer) return;
        
        // Delete first to ensure cleanup even if clearTimeout throws
        this.scheduledChecks.delete(suggestionId);
        this.timerRegistry.clearTimeout(timer);
        this.loggerPort?.debug(`Scheduler: Cancelled check for ${suggestionId}`);
    }

    /**
     * Cancel all scheduled status checks
     */
    cancelAll() {
        for (const timer of this.scheduledChecks.values()) {
            this.timerRegistry.clearTimeout(timer);
        }
        this.scheduledChecks.clear();
        this.loggerPort?.debug('Scheduler: Cancelled all scheduled checks.');
    }
}

module.exports = SuggestionStatusScheduler;
