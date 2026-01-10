/**
 * AwarenessController - Input layer controller for awareness monitoring
 * 
 * Thin controller that handles VS Code commands and delegates to app layer service files.
 * Uses explicit dependencies instead of whole DI container for better testability.
 * 
 * Design principles:
 * - Controller throws errors; composition root handles UI
 */

class AwarenessController {
    /**
     * @param {Object} dependencies - Explicit dependencies
     * @param {AwarenessService} dependencies.awarenessService - Awareness service instance
     * @param {Object} dependencies.logger - Logger instance (optional, expects { error(msg, err?), info(msg)? })
     */
    constructor({ awarenessService, logger = null }) {
        if (!awarenessService) {
            throw new Error('AwarenessController requires awarenessService');
        }
        this.awarenessService = awarenessService;
        this.logger = logger;
    }
    
    /**
     * Start monitoring
     * @param {Object} context - VS Code extension context
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors
     * @param {string} mode - Current mode ('vibe' or 'dev')
     */
    async startMonitoring(context, updateFileColorsInExplorer = null, mode = 'dev') {
        try {
            await this.awarenessService.start(context, updateFileColorsInExplorer, mode);
        } catch (error) {
            this.logger?.error('AwarenessController.startMonitoring failed', error);
            throw error;
        }
    }
    
    /**
     * Stop monitoring
     */
    async stopMonitoring() {
        try {
            await this.awarenessService.stop();
        } catch (error) {
            this.logger?.error('AwarenessController.stopMonitoring failed', error);
            throw error;
        }
    }
    
    /**
     * Get current awareness score
     * @returns {Object} Score data
     */
    getScore() {
        try {
            return this.awarenessService.getScore();
        } catch (error) {
            this.logger?.error('AwarenessController.getScore failed', error);
            throw error;
        }
    }
    
    /**
     * Handle externally created file
     * @param {string} filePath - Path to the externally created file
     */
    handleExternallyCreatedFile(filePath) {
        try {
            this.awarenessService.handleExternallyCreatedFile(filePath);
        } catch (error) {
            this.logger?.error('AwarenessController.handleExternallyCreatedFile failed', error);
            throw error;
        }
    }
    
    /**
     * Get monitoring status
     * @returns {Object} Status information
     */
    getStatus() {
        try {
            return this.awarenessService.getStatus();
        } catch (error) {
            this.logger?.error('AwarenessController.getStatus failed', error);
            throw error;
        }
    }
}

module.exports = AwarenessController;
