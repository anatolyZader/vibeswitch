/**
 * ExtensionState - Runtime state container for VibeSwitch extension
 * Holds UI components, runtime state, and service references that exist during extension lifetime
 */

class ExtensionState {
    constructor() {
        // UI Components (created during activation)
        this.awarenessBarItem = null; // Report button
        this.outputChannel = null;
        
        // Core Runtime State
        this.extensionContext = null;
        
        // Service References (created during activation)
        this.usageStats = null;
        this.awarenessEngine = null;
        this.fileDecorationProvider = null;
        
        // Timers
        this.reportButtonUpdateTimer = null;
    }
    
    /**
     * Check if extension is fully initialized
     * @returns {boolean} True if output channel and context are set
     */
    isInitialized() {
        return this.outputChannel !== null && this.extensionContext !== null;
    }
}

module.exports = ExtensionState;
