/**
 * DIContainer - Dependency Injection container for VibeSwitch extension
 * Centralizes all extension dependencies and state in a single, manageable container
 */

class DIContainer {
    constructor() {
        // UI Components
        this.statusBarItem = null;
        this.awarenessBarItem = null;
        this.outputChannel = null;
        
        // Core State
        this.currentMode = null;
        this.extensionContext = null;
        
        // Managers & Monitors
        this.usageStats = null;
        this.awarenessMonitor = null;
        this.fileDecorationProvider = null;
        
        // Timers
        this.meterUpdateTimer = null;
    }
    
    /**
     * Update current mode
     */
    setMode(mode) {
        this.currentMode = mode;
    }
    
    /**
     * Get current mode
     */
    getMode() {
        return this.currentMode;
    }
    
    /**
     * Check if extension is fully initialized
     */
    isInitialized() {
        return this.outputChannel !== null && this.extensionContext !== null;
    }
}

module.exports = DIContainer;

