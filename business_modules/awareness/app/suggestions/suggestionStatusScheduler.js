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
     * @param {ILoggerPort} loggerPort - Logger port (optional)
     */
    constructor(timerRegistry, isActive, instanceId, loggerPort = null) {
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

        const currentInstanceId = this.instanceId; // Capture instance ID for closure

        const timer = this.timerRegistry.setTimeout(() => {
            this.scheduledChecks.delete(suggestionId);
            // Generation-based cancellation: only execute if instance ID matches
            if (this.instanceId !== currentInstanceId) {
                this.loggerPort?.debug(`Scheduler: Instance ID mismatch for ${suggestionId}, ignoring timer.`);
                return;
            }
            if (this.isActive()) {
                callback();
            } else {
                this.loggerPort?.debug(`Scheduler: Service not active for ${suggestionId}, ignoring timer.`);
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
        if (timer) {
            this.timerRegistry.clearTimeout(timer);
            this.scheduledChecks.delete(suggestionId);
            this.loggerPort?.debug(`Scheduler: Cancelled check for ${suggestionId}`);
        }
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
