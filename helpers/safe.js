/**
 * Centralized error handling wrapper for boundary operations
 * 
 * Use this ONLY at system boundaries (VS Code event callbacks, commands, timers, I/O).
 * Do NOT use for internal business logic - let errors propagate to boundaries.
 * 
 * @param {string} label - Label for error logging
 * @param {Function} fn - Function to execute safely
 * @param {Object} options - Options
 * @param {boolean} options.fatal - If true, re-throw error after logging (default: false)
 * @param {string} options.throttleKey - Key for throttling repeated errors (default: label)
 * @returns {*} Return value of fn(), or undefined on error (unless fatal)
 */
function safe(label, fn, { fatal = false, throttleKey = label } = {}) {
    try {
        return fn();
    } catch (error) {
        const logger = require('../logger').getLogger();
        logger.log(`ERROR [${label}]: ${error.message}`, true);
        
        // Log stack trace only for fatal errors or first occurrence
        if (fatal) {
            logger.log(`Stack trace: ${error.stack}`, true);
        }
        
        if (fatal) {
            throw error;
        }
        return undefined;
    }
}

module.exports = safe;

