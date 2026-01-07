/**
 * AwarenessController - Input layer controller for awareness monitoring
 * 
 * Thin controller that handles VS Code commands and delegates to AwarenessService.
 * This follows the pattern from gitModuleExample.js where controllers resolve
 * services from DI container and call service methods.
 */

class AwarenessController {
    /**
     * @param {Object} diContainer - Dependency injection container
     */
    constructor(diContainer) {
        if (!diContainer) {
            throw new Error('AwarenessController requires diContainer');
        }
        this.diContainer = diContainer;
    }
    
    /**
     * Start monitoring
     * @param {Object} context - VS Code extension context
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors
     * @param {string} mode - Current mode ('vibe' or 'dev')
     */
    async startMonitoring(context, updateFileColorsInExplorer = null, mode = 'dev') {
        try {
            const awarenessService = await this.diContainer.resolve('awarenessService');
            if (!awarenessService) {
                throw new Error('AwarenessService not found in DI container');
            }
            await awarenessService.start(context, updateFileColorsInExplorer, mode);
        } catch (error) {
            const { getLogger } = require('../../../logger');
            getLogger().log(`AwarenessController: Error starting monitoring: ${error.message}`, false, true);
            throw error;
        }
    }
    
    /**
     * Start monitoring (backward compatibility alias)
     * @param {Object} context - VS Code extension context
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors
     * @param {string} mode - Current mode ('vibe' or 'dev')
     */
    async start(context, updateFileColorsInExplorer = null, mode = 'dev') {
        return this.startMonitoring(context, updateFileColorsInExplorer, mode);
    }
    
    /**
     * Stop monitoring
     */
    async stopMonitoring() {
        try {
            const awarenessService = await this.diContainer.resolve('awarenessService');
            if (!awarenessService) {
                throw new Error('AwarenessService not found in DI container');
            }
            await awarenessService.stop();
        } catch (error) {
            const { getLogger } = require('../../../logger');
            getLogger().log(`AwarenessController: Error stopping monitoring: ${error.message}`, false, true);
            throw error;
        }
    }
    
    /**
     * Stop monitoring (backward compatibility alias)
     */
    async stop() {
        return this.stopMonitoring();
    }
    
    /**
     * Get current awareness score
     * @returns {Object} Score data
     */
    getScore() {
        try {
            const awarenessService = this.diContainer.resolveSync('awarenessService');
            if (!awarenessService) {
                throw new Error('AwarenessService not found in DI container');
            }
            return awarenessService.getScore();
        } catch (error) {
            const { getLogger } = require('../../../logger');
            getLogger().log(`AwarenessController: Error getting score: ${error.message}`, false, true);
            throw error;
        }
    }
    
    /**
     * Handle externally created file
     * @param {string} filePath - Path to the externally created file
     */
    handleExternallyCreatedFile(filePath) {
        try {
            const awarenessService = this.diContainer.resolveSync('awarenessService');
            if (!awarenessService) {
                throw new Error('AwarenessService not found in DI container');
            }
            awarenessService.handleExternallyCreatedFile(filePath);
        } catch (error) {
            const { getLogger } = require('../../../logger');
            getLogger().log(`AwarenessController: Error handling external file: ${error.message}`, false, true);
            throw error;
        }
    }
    
    /**
     * Get monitoring status
     * @returns {Object} Status information
     */
    getStatus() {
        try {
            const awarenessService = this.diContainer.resolveSync('awarenessService');
            if (!awarenessService) {
                throw new Error('AwarenessService not found in DI container');
            }
            return awarenessService.getStatus();
        } catch (error) {
            const { getLogger } = require('../../../logger');
            getLogger().log(`AwarenessController: Error getting status: ${error.message}`, false, true);
            throw error;
        }
    }
}

module.exports = AwarenessController;

