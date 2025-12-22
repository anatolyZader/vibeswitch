/**
 * Logging Helper
 * Creates a logger function that respects DISABLE_LOGGING flag
 */

module.exports = function createLog(DISABLE_LOGGING, outputChannel) {
    return (msg, show = false) => {
        // Fallback if logger not initialized
        console.log(msg);
        if (DISABLE_LOGGING) return; // Exit early if logging disabled
        outputChannel?.appendLine(msg);
        if (show) outputChannel?.show(true);
    };
};

