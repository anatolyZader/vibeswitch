/**
 * AwarenessLoggerAdapter - Adapter implementing ILoggerPort
 * 
 * Wraps the logger module to provide logging functionality to domain entities.
 */

const ILoggerPort = require('../../domain/ports/ILoggerPort');
const { getLogger } = require('../../../../logger');

class AwarenessLoggerAdapter extends ILoggerPort {
    constructor() {
        super();
        this.logger = getLogger();
    }

    /**
     * Log a message
     * @param {string} message - The message to log
     * @param {boolean} force - Force log even if throttled
     * @param {boolean} show - Show output channel
     * @param {string} sourceKey - Optional source key for rate limiting
     */
    log(message, force = false, show = false, sourceKey = null) {
        if (this.logger) {
            this.logger.log(message, force, show, sourceKey);
        }
    }

    /**
     * Log a debug message
     * @param {string} message - The debug message to log
     * @param {string} sourceKey - Optional source key for rate limiting
     */
    debug(message, sourceKey = null) {
        if (this.logger) {
            // Use log with debug marker
            this.logger.log(`[DEBUG] ${message}`, false, false, sourceKey);
        }
    }

    /**
     * Log an error message
     * @param {string} message - The error message to log
     * @param {Error} error - Optional error object
     */
    error(message, error = null) {
        if (this.logger) {
            const errorMessage = error ? `${message}: ${error.message || error}` : message;
            this.logger.log(errorMessage, true, false); // force=true, show=false
        }
    }
}

module.exports = AwarenessLoggerAdapter;
