/**
 * VibeSwitch Logger with Throttling
 * Prevents excessive logging that can cause performance issues
 */

/**
 * Log Rate Limiter (internal class)
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

class ThrottledLogger {
    constructor(outputChannel = null) {
        this.outputChannel = outputChannel;
        this.logCache = new Map(); // message -> { count, lastLogTime, lastMessage }
        this.throttleWindow = 5000; // 5 seconds
        this.maxCacheSize = 100;
        this.enableThrottling = true;
        this.debugMode = false; // Set to true for verbose debugging
        
        // Rate limiter for source-based throttling (e.g., "onTextChange:file.js")
        // Prevents spam from high-frequency events before message throttling
        this.rateLimiter = new LogRateLimiter(5000, 500);
    }

    /**
     * Log a message with throttling
     * @param {string} message - The message to log
     * @param {boolean} force - Force log even if throttled (for important messages)
     * @param {boolean} show - Show output channel
     * @param {string} sourceKey - Optional source key for rate limiting (e.g., "onTextChange:file.js")
     */
    log(message, force = false, show = false, sourceKey = null) {
        // Respect global logging toggle for non-essential logs.
        // Errors/warnings and forced logs can still pass through.
        if (!LOGGING_ENABLED && !force) {
            const isImportant =
                message.includes('[ERROR]') ||
                message.includes('[WARN]') ||
                message.includes('ERROR') ||
                message.includes('❌') ||
                message.includes('⚠️');
            if (!isImportant) return;
        }

        // Apply source-based rate limiting if sourceKey provided
        // This prevents spam from high-frequency events (e.g., text changes)
        if (sourceKey && !force) {
            if (!this.rateLimiter.shouldLog(sourceKey)) {
                return; // Rate limited by source
            }
        }
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
     * @param {string} message - The debug message
     * @param {boolean} show - Show output channel
     * @param {string} sourceKey - Optional source key for rate limiting
     */
    debug(message, show = false, sourceKey = null) {
        if (this.debugMode) {
            // Apply source-based rate limiting if sourceKey provided
            if (sourceKey && !this.rateLimiter.shouldLog(sourceKey)) {
                return; // Rate limited by source
            }
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
        this.rateLimiter.clear();
    }

    /**
     * Internal: Write log to console and output channel
     */
    _writeLog(message, show = false) {
        const isError = message.startsWith('[ERROR]') || message.includes('❌');
        const isWarn = message.startsWith('[WARN]') || message.includes('⚠️');
        const isDebug = message.includes('[DEBUG]');

        // Console output: only for errors/warnings by default.
        // Keep info logs out of the console unless debugMode is enabled.
        if (isError) {
            console.error(message);
        } else if (isWarn) {
            console.warn(message);
        } else if (this.debugMode || isDebug) {
            console.log(message);
        }

        // Output channel: respect disableLogging, but still surface errors/warnings.
        if (!LOGGING_ENABLED && !isError && !isWarn) return;

        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
            if (show) this.outputChannel.show(true);
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
let LOGGING_ENABLED = true;
let DEBUG_LOGGING_ENABLED = false;

function initializeLogger(outputChannel) {
    loggerInstance = new ThrottledLogger(outputChannel);
    // Apply any previously set debug preference
    loggerInstance.setDebugMode(!!DEBUG_LOGGING_ENABLED);
    return loggerInstance;
}

function getLogger() {
    if (!loggerInstance) {
        loggerInstance = new ThrottledLogger();
    }
    return loggerInstance;
}

function enableLogging() {
    LOGGING_ENABLED = true;
}

function disableLogging() {
    LOGGING_ENABLED = false;
}

/**
 * Enable/disable verbose debug logging.
 * When disabled, `[DEBUG]` logs are suppressed and info logs won't go to console.
 */
function setDebugLoggingEnabled(enabled) {
    DEBUG_LOGGING_ENABLED = !!enabled;
    if (loggerInstance) {
        loggerInstance.setDebugMode(DEBUG_LOGGING_ENABLED);
    }
}

/**
 * Check if logging is enabled based on VS Code settings
 * @param {Object} context - VS Code extension context
 * @returns {boolean} True if logging is enabled
 */
function isLoggingEnabled(context) {
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('vibeswitch');
    // Default to true (enable logging) unless explicitly disabled
    // Can be overridden by NODE_ENV=production
    if (process.env.NODE_ENV === 'production') {
        return false;
    }
    return !config.get('disableLogging', false);
}

/**
 * Apply VS Code settings to logger behavior.
 * Centralizes the policy so other modules don't roll their own console logging.
 */
function applyVSCodeLoggingSettings(context = null) {
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('vibeswitch');

    const disable = !!config.get('disableLogging', false);
    const debug = !!config.get('debugLogging', false);

    if (disable) disableLogging();
    else enableLogging();

    // If logging is disabled, debug logging must also be disabled.
    setDebugLoggingEnabled(!disable && debug);
}

/**
 * Create log wrapper function for extension-level code
 * @returns {Function} Log function with signature: log(message, force, show)
 * @param {string} message - Message to log
 * @param {boolean} force - Force log even if throttled (for errors/important messages)
 * @param {boolean} show - Show output channel to user
 */
function createLogWrapperFunc() {
    const logger = getLogger();
    return (message, force = false, show = false) => {
        if (logger) {
            logger.log(message, force, show);
        }
    };
}

module.exports = {
    ThrottledLogger,
    initializeLogger,
    getLogger,
    enableLogging,
    disableLogging,
    setDebugLoggingEnabled,
    isLoggingEnabled,
    applyVSCodeLoggingSettings,
    createLogWrapperFunc
};





