/**
 * ExtensionState - Runtime state container for VibeSwitch extension
 * Holds UI components, runtime state, and service references that exist during extension lifetime
 */

class ExtensionState {
    constructor() {
        // UI Components (created during activation)
        this.statusBarItem = null;
        this.awarenessBarItem = null;
        this.outputChannel = null;
        
        // Core Runtime State
        this.currentMode = null;
        this.extensionContext = null;
        
        // Service References (created during activation)
        this.usageStats = null;
        this.awarenessEngine = null;
        this.fileDecorationProvider = null;
        
        // Mode enforcement (set during activation)
        this.modeEnforcement = null;
        
        // Timers
        this.meterUpdateTimer = null;
    }
    
    /**
     * Update current mode (no-op; mode switching removed; kept for backward compat)
     * @param {string} mode - Mode value (ignored)
     */
    setMode(mode) {
        if (mode) this.currentMode = mode;
    }
    
    /**
     * Get current mode
     * @returns {string|null} Current mode or null
     */
    getMode() {
        return this.currentMode;
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
