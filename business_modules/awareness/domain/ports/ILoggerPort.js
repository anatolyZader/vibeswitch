/**
 * ILoggerPort - Port interface for logging operations
 * 
 * Defines the contract for logging functionality.
 * Domain entities should use this port instead of directly importing logger implementations.
 */

class ILoggerPort {
    constructor() {
        if (new.target === ILoggerPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Log a message
     * @param {string} message - The message to log
     * @param {boolean} force - Force log even if throttled (for important messages)
     * @param {boolean} show - Show output channel
     * @param {string} sourceKey - Optional source key for rate limiting
     */
    log(message, force = false, show = false, sourceKey = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Log a debug message
     * @param {string} message - The debug message to log
     * @param {string} sourceKey - Optional source key for rate limiting
     */
    debug(message, sourceKey = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Log an error message
     * @param {string} message - The error message to log
     * @param {Error} error - Optional error object
     */
    error(message, error = null) {
        throw new Error('Method not implemented.');
    }
}

module.exports = ILoggerPort;
