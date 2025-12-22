/**
 * Status Bar Helper
 * Updates status bar without auto-detecting mode
 */

module.exports = function createUpdateStatusBar(statusBar, state, updateAwarenessMeter) {
    return (forceMode = null) => {
        // Only update if mode is explicitly provided or already set
        if (forceMode !== null) {
            state.setMode(forceMode);
        }
        
        const currentMode = state.getMode();
        
        // If no mode set at all, show neutral state (don't detect)
        if (!currentMode) {
            statusBar.updateStatusBar(state.statusBarItem, null, state.outputChannel);
            updateAwarenessMeter();
            return;
        }
        
        statusBar.updateStatusBar(state.statusBarItem, currentMode, state.outputChannel);
        updateAwarenessMeter();
    };
};

