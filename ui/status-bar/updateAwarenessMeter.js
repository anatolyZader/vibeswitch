/**
 * Awareness Meter Helper
 * Updates awareness meter and refreshes file decorations
 */

module.exports = function createUpdateAwarenessMeter(statusBar, state) {
    return () => {
        statusBar.updateAwarenessMeter(
            state.awarenessBarItem, 
            state.awarenessMonitor, 
            state.currentMode, 
            state.outputChannel
        );
        if (state.fileDecorationProvider && state.currentMode === 'dev') {
            state.fileDecorationProvider.refresh();
        }
    };
};

