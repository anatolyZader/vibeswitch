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
        
        // Capability Enforcement (set during activation)
        this.capability = null;
        
        // Timers
        this.meterUpdateTimer = null;
    }
    
    /**
     * Update current mode
     * Also syncs to ModeManager (if available) for capability enforcement
     * @param {string} mode - Mode value ('vibe' or 'dev')
     */
    setMode(mode) {
        this.currentMode = mode;
        
        // Sync to ModeManager for capability enforcement (best-effort, don't block)
        if (this.capability && this.capability.modeManager) {
            this.capability.modeManager.setMode(mode).catch(err => {
                console.error('ExtensionState: Failed to sync mode to ModeManager:', err.message);
            });
        }
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
