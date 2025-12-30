/**
 * Initialize all helper functions with state dependency injection
 * Returns object with all helper functions that have access to state
 * 
 * This is a FACTORY FUNCTION that uses DEPENDENCY INJECTION and CLOSURES: when called with a state
 * object (DIContainer), it creates helper functions (like startAwarenessMonitor, switchToMode, etc.)
 * that "close over" (capture) the state parameter in their closure scope. This means the helpers
 * maintain access to the shared state object even after initializeHelpers finishes executing, allowing
 * them to read and modify state properties (like state.awarenessMonitor, state.currentMode) without
 * using global variables. The state is injected (passed in) rather than created internally, making
 * the code testable (can inject mock state), maintainable (clear dependencies), and encapsulated
 * (all helpers share the same state instance). See initializeHelpers.DETAILED-EXPLANATION.md for
 * complete explanation with examples.
 * 
 * INITIALIZATION ORDER (critical):
 * 1. Create log helper (needed by everything)
 * 2. Create UI helpers (updateAwarenessMeter, switchModeInStatusBar, updateFileColorsInExplorer)
 * 3. Create monitor lifecycle helpers (start/stop)
 * 4. Create mode switching helper (depends on UI helpers)
 * 5. Create file decoration helper
 * 6. Create command handlers (depends on all above)
 */

const vscode = require('vscode');
const { window } = vscode;

// Import modules
const { getLogger } = require('../logger');
const statusBar = require('../ui/status-bar');
const commandHandlersFactory = require('./commandHandlers');

// Import modules
const switchToModeFunc = require('../mode/switchToMode');
const UnreviewedFileDecor = require('../ui/fileColorsInExplorer');

/**
 * Initialize all helpers with dependency injection
 * @param {Object} state - Extension state (DIContainer)
 * @param {boolean} disableLogging - Whether to disable logging
 * @returns {Object} Object containing all helper functions
 */
module.exports = function initializeHelpers(state, disableLogging = false) {
    // ============================================================================
    // STEP 1: Initialize logging (needed by everything)
    // ============================================================================
    // Get the singleton logger and create a wrapper function that matches the expected interface
    // The logger is already initialized in extension.js before this is called
    const logger = getLogger();
    const log = (msg, show = false, force = false) => {
        // Map parameters: log(msg, show, force) -> logger.log(msg, force, show)
        logger.log(msg, force, show);
    };

    // ============================================================================
    // STEP 2: Initialize UI helpers (needed by monitor and mode switching)
    // ============================================================================
    // Update file colors in Explorer - updates file name colors in Explorer based on review debt/pending status
    // Called when mode changes or when score updates to reflect current state
    const updateFileColorsInExplorer = () => {
        if (state.fileDecorationProvider && state.currentMode === 'dev') {
            state.fileDecorationProvider.refresh();
        }
    };
    
    // Update awareness meter - called after score calculation
    const updateAwarenessMeter = () => {
        statusBar.updateAwarenessMeter(
            state.awarenessBarItem, 
            state.awarenessMonitor, 
            state.currentMode, 
            state.outputChannel
        );
    };
    
    // Switch mode in status bar - shows/omits awareness meter based on mode
    // Called when mode changes to update mode indicator and show/hide awareness meter
    const switchModeInStatusBar = (forceMode = null) => {
        // Only update if mode is explicitly provided or already set
        if (forceMode !== null) {
            state.setMode(forceMode);
        }
        
        const currentMode = state.getMode();
        
        // If no mode set at all, show neutral state (don't detect)
        if (!currentMode) {
            statusBar.updateStatusBar(state.statusBarItem, null, state.outputChannel);
            updateAwarenessMeter(); // This will hide the meter if no mode
            updateFileColorsInExplorer(); // Hide file colors when no mode
            return;
        }
        
        // Update mode indicator in status bar
        statusBar.updateStatusBar(state.statusBarItem, currentMode, state.outputChannel);
        // Update awareness meter (will show in 'dev' mode, hide in 'vibe' mode)
        updateAwarenessMeter();
        // Update file colors to show/hide based on mode change
        updateFileColorsInExplorer();
    };

    // ============================================================================
    // STEP 3: Initialize file decoration helper
    // ============================================================================
    const initFileDecorations = () => {
        if (!UnreviewedFileDecor || state.fileDecorationProvider || !state.extensionContext) {
            return;
        }
        
        try {
            log('Creating file decoration provider...');
            state.fileDecorationProvider = new UnreviewedFileDecor(
                state.awarenessMonitor,
                () => state.currentMode,
                state.outputChannel,
                disableLogging
            );
            
            const provider = state.fileDecorationProvider.register(state.extensionContext);
            if (provider) {
                log('✅ File decoration provider registered successfully');
            } else {
                log('❌ ERROR: File decoration provider registration failed');
            }
        } catch (error) {
            log(`❌ ERROR creating file decoration provider: ${error.message}`);
            console.error('VibeSwitch: Error creating file decoration provider:', error);
        }
    };

    // ============================================================================
    // STEP 4: Initialize monitor lifecycle helpers
    // ============================================================================
    const startAwarenessMonitor = () => {
        if (!state.awarenessMonitor || !state.extensionContext) {
            return;
        }
        
        // Store updateFileColorsInExplorer in state so modules can access it
        state.updateFileColorsInExplorer = updateFileColorsInExplorer;
        
        state.awarenessMonitor.start(state.extensionContext, updateFileColorsInExplorer);
        log('VibeSwitch: Started real-time awareness monitoring');
        initFileDecorations();
        
        if (state.meterUpdateTimer) {
            clearInterval(state.meterUpdateTimer);
        }
        state.meterUpdateTimer = setInterval(() => {
            if (state.currentMode === 'dev') {
                updateAwarenessMeter();
            }
        }, 10000);
        
        updateAwarenessMeter();
    };

    const stopAwarenessMonitor = () => {
        if (!state.awarenessMonitor) {
            return;
        }
        
        state.awarenessMonitor.stop();
        log('VibeSwitch: Stopped awareness monitoring (VIBE mode)');
        
        if (state.fileDecorationProvider) {
            state.fileDecorationProvider.dispose();
            state.fileDecorationProvider = null;
        }
        
        if (state.meterUpdateTimer) {
            clearInterval(state.meterUpdateTimer);
            state.meterUpdateTimer = null;
        }
    };

    // ============================================================================
    // STEP 5: Initialize mode switching helper (depends on UI helpers)
    // ============================================================================
    const switchToMode = async (mode) => {
        try {
            log(`VibeSwitch: Switching to ${mode} mode (current: ${state.currentMode})`);
            
            // Set mode IMMEDIATELY before any file operations
            // This prevents any detection from seeing the wrong mode
            const previousMode = state.currentMode;
            state.setMode(mode);
            
            // Update UI immediately with the new mode (shows/omits awareness meter)
            switchModeInStatusBar(mode);
            
            await switchToModeFunc(mode, {
                currentMode: previousMode, // Pass previous mode for stats
                onModeSwitched: (newMode) => {
                    // Don't change currentMode here - we already set it
                    log(`VibeSwitch: Mode switched callback called with: ${newMode} (already set to ${state.currentMode})`);
                },
                onMonitorStart: startAwarenessMonitor,
                onMonitorStop: stopAwarenessMonitor,
                usageStats: state.usageStats
            });
            
            // Verify file was written correctly, but DON'T detect mode from file
            // We trust what we just set
            log(`VibeSwitch: Successfully switched to ${mode} mode (mode locked, no re-detection)`);
            
            // Final UI update to ensure consistency (shows/omits awareness meter)
            switchModeInStatusBar(mode);
        } catch (error) {
            // On error, try to restore previous mode
            log(`ERROR in switchToMode: ${error.message}`, true, true);
            console.error('VibeSwitch: Error in switchToMode:', error);
            window.showErrorMessage(`Failed to switch mode: ${error.message}`);
        }
    };

    // ============================================================================
    // STEP 6: Initialize command handlers (depends on all above helpers)
    // ============================================================================
    const commandHandlers = commandHandlersFactory({
        log,
        switchToMode,
        updateFileColorsInExplorer,
        state
    });

    // ============================================================================
    // Return all helpers for use in activate function
    // ============================================================================
    return {
        log,
        updateAwarenessMeter,
        switchModeInStatusBar,
        updateFileColorsInExplorer,
        commandHandlers,
        initFileDecorations,
        startAwarenessMonitor,
        stopAwarenessMonitor,
        switchToMode
    };
};
