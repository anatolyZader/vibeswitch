/**
 * VibeSwitch Logger with Throttling
 * Prevents excessive logging that can cause performance issues
 */

class ThrottledLogger {
    constructor(outputChannel = null) {
        this.outputChannel = outputChannel;
        this.logCache = new Map(); // message -> { count, lastLogTime, lastMessage }
        this.throttleWindow = 5000; // 5 seconds
        this.maxCacheSize = 100;
        this.enableThrottling = true;
        this.debugMode = false; // Set to true for verbose debugging
    }

    /**
     * Log a message with throttling
     * @param {string} message - The message to log
     * @param {boolean} force - Force log even if throttled (for important messages)
     * @param {boolean} show - Show output channel
     */
    log(message, force = false, show = false) {
        // Always log important messages (errors, warnings, critical info)
        if (force || message.includes('ERROR') || message.includes('❌') || message.includes('⚠️')) {
            this._writeLog(message, show);
            return;
        }

        // Skip verbose debug logs unless debug mode is enabled
        if (message.includes('[DEBUG]') && !this.debugMode) {
            return;
        }

        // Apply throttling for repeated messages
        if (this.enableThrottling && !force) {
            const cacheKey = this._getCacheKey(message);
            const now = Date.now();
            const cached = this.logCache.get(cacheKey);

            if (cached) {
                const timeSinceLastLog = now - cached.lastLogTime;
                
                // If same message within throttle window, increment counter but don't log
                if (timeSinceLastLog < this.throttleWindow) {
                    cached.count++;
                    cached.lastLogTime = now;
                    return; // Skip logging
                } else {
                    // Time window passed, log with count if > 1
                    if (cached.count > 1) {
                        this._writeLog(`${message} [repeated ${cached.count} times]`, show);
                    } else {
                        this._writeLog(message, show);
                    }
                    // Reset cache entry
                    cached.count = 1;
                    cached.lastLogTime = now;
                }
            } else {
                // New message, log it
                this._writeLog(message, show);
                
                // Add to cache
                if (this.logCache.size >= this.maxCacheSize) {
                    // Remove oldest entry (simple FIFO)
                    const firstKey = this.logCache.keys().next().value;
                    this.logCache.delete(firstKey);
                }
                this.logCache.set(cacheKey, {
                    count: 1,
                    lastLogTime: now,
                    lastMessage: message
                });
            }
        } else {
            // Throttling disabled, log everything
            this._writeLog(message, show);
        }
    }

    /**
     * Log error message (always logged, not throttled)
     */
    error(message, show = true) {
        this._writeLog(`[ERROR] ${message}`, show);
    }

    /**
     * Log warning message (always logged, not throttled)
     */
    warn(message, show = false) {
        this._writeLog(`[WARN] ${message}`, show);
    }

    /**
     * Log debug message (only if debug mode enabled)
     */
    debug(message, show = false) {
        if (this.debugMode) {
            this._writeLog(`[DEBUG] ${message}`, show);
        }
    }

    /**
     * Enable/disable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Enable/disable throttling
     */
    setThrottling(enabled) {
        this.enableThrottling = enabled;
    }

    /**
     * Clear log cache
     */
    clearCache() {
        this.logCache.clear();
    }

    /**
     * Internal: Write log to console and output channel
     */
    _writeLog(message, show = false) {
        console.log(message);
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
            if (show) {
                this.outputChannel.show(true);
            }
        }
    }

    /**
     * Internal: Get cache key from message (normalize similar messages)
     */
    _getCacheKey(message) {
        // Remove timestamps and dynamic values for better cache hits
        return message
            .replace(/\d{4}-\d{2}-\d{2}T[\d:.-]+Z/g, '[TIMESTAMP]')
            .replace(/\d+\.\d+/g, '[NUMBER]')
            .replace(/L\d+:\d+/g, 'L[LINE]')
            .replace(/ID: [\d.]+/g, 'ID: [ID]')
            .substring(0, 200); // Limit key length
    }
}

// Create singleton instance
let loggerInstance = null;

function createLogger(outputChannel) {
    loggerInstance = new ThrottledLogger(outputChannel);
    return loggerInstance;
}

function getLogger() {
    if (!loggerInstance) {
        loggerInstance = new ThrottledLogger();
    }
    return loggerInstance;
}

module.exports = {
    ThrottledLogger,
    createLogger,
    getLogger
};





