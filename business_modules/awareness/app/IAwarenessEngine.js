/**
 * IAwarenessEngine - Interface for awareness monitoring service
 * 
 * Defines the contract for awareness monitoring operations.
 * This interface allows for different implementations and easier testing.
 */

class IAwarenessEngine {
    constructor() {
        if (new.target === IAwarenessEngine) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Set callbacks for external tracking (backward compatibility)
     * @param {Object} callbacks - Callback functions
     */
    setCallbacks(callbacks = {}) {
        throw new Error('Method not implemented.');
    }

    /**
     * Start monitoring (called when switching to DEV mode)
     * @param {Object} context - VS Code extension context
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors in Explorer
     * @param {string} mode - Current mode ('vibe', 'dev') for classifier config
     */
    async start(context, updateFileColorsInExplorer = null, mode = 'dev') {
        throw new Error('Method not implemented.');
    }

    /**
     * Stop monitoring (called when switching away from DEV mode)
     */
    async stop() {
        throw new Error('Method not implemented.');
    }

    /**
     * Update awareness score and trigger callbacks/events
     */
    updateScore() {
        throw new Error('Method not implemented.');
    }

    /**
     * Get current awareness score
     * @returns {Object} Score data with total, components, suggestions, debt, and debug info
     */
    getScore() {
        throw new Error('Method not implemented.');
    }

    /**
     * Handle externally created file
     * @param {string} filePath - Path to the externally created file
     */
    handleExternallyCreatedFile(filePath) {
        throw new Error('Method not implemented.');
    }

    /**
     * Get monitoring status
     * @returns {Object} Status information
     */
    getStatus() {
        throw new Error('Method not implemented.');
    }
}

module.exports = IAwarenessEngine;
