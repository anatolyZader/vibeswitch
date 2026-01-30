/**
 * Initialize all helper functions with state dependency injection
 * Returns object with all helper functions that have access to state
 * 
 * This is a FACTORY FUNCTION that uses DEPENDENCY INJECTION and CLOSURES: when called with a state
 * object (DIContainer), it creates helper functions (like startAwarenessMonitor, switchToMode, etc.)
 * that "close over" (capture) the state parameter in their closure scope. This means the helpers
 * maintain access to the shared state object even after initializeHelpers finishes executing, allowing
 * them to read and modify state properties (like state.awarenessEngine, state.currentMode) without
 * using global variables. The state is injected (passed in) rather than created internally, making
 * the code testable (can inject mock state), maintainable (clear dependencies), and encapsulated
 * (all helpers share the same state instance). See initializeHelpers.DETAILED-EXPLANATION.md for
 * complete explanation with examples.
 * 
 * INITIALIZATION ORDER (critical):
 * 1. Create log helper (needed by everything)
 * 2. Create UI helpers (updateAwarenessMeter, switchModeInStatusBar, updateFileColorsInExplorer, updateFileColorsForMode)
 * 3. Create monitor lifecycle helpers (start/stop)
 * 4. Create mode switching helper (depends on UI helpers)
 * 5. Create file decoration helper
 * 6. Create command handlers (depends on all above)
 */

const vscode = require('vscode');

// Import modules
const awarenessMeter = require('./ui/awarenessMeterDisplay');
const modeSwitcher = require('./ui/modeSwitcherDisplay');
const commandHandlersFactory = require('./vsCommandsFactory');
const modeService = require('./business_modules/mode/app/modeService');
const UnreviewedFileDecor = require('./ui/fileColoringDisplay');
const safe = require('./safe');

/**
 * Initialize all helpers with dependency injection
 * @param {ExtensionState} state - Extension runtime state
 * @param {DIContainer} container - DI container for adapters and services
 * @param {boolean} disableLogging - Whether to disable logging
 * @returns {Object} Object containing all helper functions
 */
module.exports = function initializeHelpers(state, container, disableLogging = false) {
    // Validate state parameter
    if (!state) {
        throw new Error('initializeHelpers: state parameter is required');
    }
    
    // ============================================================================
    // STEP 1: Initialize logging (needed by everything)
    // ============================================================================
    // Get the singleton logger and create a wrapper function
    // The logger is already initialized in extension.js before this is called
    const { createLogWrapperFunc } = require('./logger');
    const log = createLogWrapperFunc();

    // ============================================================================
    // STEP 2: Initialize UI helpers (needed by monitor and mode switching)
    // ============================================================================
    // Update file colors in Explorer - updates file name colors based on review debt/pending status
    // Called when debt/suggestions change to reflect current state
    // NOTE: This is for content-based updates (debt/suggestions), NOT mode changes
    // DISABLED: File coloring module disabled to prevent noise and excessive load
    // Internal helper - errors propagate to caller (boundary)
    const updateFileColorsInExplorer = () => {
        // DISABLED: File coloring disabled
        return;
        // if (state.fileDecorationProvider && state.getMode() === 'dev') {
        //     state.fileDecorationProvider.refresh();
        // }
    };
    
    // Update file colors for mode change - shows/hides file colors based on mode
    // Called when mode changes to show/hide file decorations
    // DISABLED: File coloring module disabled to prevent noise and excessive load
    // NOTE: This is separate from content-based updates to isolate mode switching concerns
    // Internal helper - errors propagate to caller (boundary)
    const updateFileColorsForMode = () => {
        // DISABLED: File coloring disabled
        return;
        // if (state.fileDecorationProvider) {
        //     // Refresh to show/hide based on current mode (provider checks mode internally)
        //     state.fileDecorationProvider.refresh();
        // }
    };
    
    // Update awareness meter - called after score calculation
    // Internal helper - errors propagate to caller (boundary)
    const updateAwarenessMeter = () => {
        awarenessMeter.updateAwarenessMeter(
            state.awarenessBarItem, 
            state.awarenessEngine, 
            state.getMode(), 
            state.outputChannel
        );
    };
    
    // Switch mode in status bar - shows/omits awareness meter based on mode
    // Called when mode changes to update mode indicator and show/hide awareness meter
    // NOTE: File colors are updated separately via updateFileColorsForMode()
    const switchModeInStatusBar = (forceMode = null) => {
        // Only update if mode is explicitly provided or already set
        if (forceMode !== null) {
            state.setMode(forceMode);
        }
        
        const currentMode = state.getMode();
        
        // If no mode set at all, show neutral state (don't detect)
        if (!currentMode) {
            modeSwitcher.updateStatusBar(state.statusBarItem, null, state.outputChannel);
            updateAwarenessMeter(); // This will hide the meter if no mode
            return;
        }
        
        // Update mode indicator in status bar
        modeSwitcher.updateStatusBar(state.statusBarItem, currentMode, state.outputChannel);
        // Update awareness meter (shows in both 'dev' and 'vibe' modes)
        updateAwarenessMeter();
        // NOTE: File colors are updated separately - not mixed with status bar updates
    };

    // ============================================================================
    // STEP 3: Initialize file decoration helper
    // ============================================================================
    // DISABLED: File coloring module disabled to prevent noise and excessive load
    // Internal helper - errors propagate to caller (boundary: startAwarenessMonitor)
    const initFileDecorations = () => {
        // DISABLED: File coloring disabled
        return;
        // if (!UnreviewedFileDecor || state.fileDecorationProvider || !state.extensionContext) {
        //     return;
        // }
        // 
        // log('[DEBUG] Creating file decoration provider...');
        // state.fileDecorationProvider = new UnreviewedFileDecor(
        //     state.awarenessEngine,
        //     () => state.getMode(),
        //     state.outputChannel,
        //     disableLogging
        // );
        // 
        // const provider = state.fileDecorationProvider.register(state.extensionContext);
        // if (provider) {
        //     log('[DEBUG] ✅ File decoration provider registered successfully');
        // } else {
        //     log('❌ ERROR: File decoration provider registration failed');
        // }
    };

    // ============================================================================
    // STEP 4: Initialize monitor lifecycle helpers
    // ============================================================================
    // Starts the awareness monitor - called once on extension activation
    // The monitor runs continuously regardless of mode and is never stopped
    const startAwarenessMonitor = async () => {
        if (!state.awarenessEngine || !state.extensionContext) {
            return;
        }
        
        // Store updateFileColorsInExplorer in state so modules can access it
        state.updateFileColorsInExplorer = updateFileColorsInExplorer;
        
        // Pass current mode to classifier for mode-specific thresholds
        const currentMode = state.getMode() || 'dev';
        const recordOptions = {};
        try {
            const cfg = vscode.workspace.getConfiguration('vibeswitch');
            const recordTraceToFile = cfg.get('recordTraceToFile', false);
            if (recordTraceToFile) {
                let recordTracePath = cfg.get('recordTracePath', '');
                if (!recordTracePath && state.extensionContext) {
                    const pathModule = require('path');
                    const base = state.extensionContext.extensionPath || (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0] ? vscode.workspace.workspaceFolders[0].uri.fsPath : '');
                    recordTracePath = pathModule.join(base, 'tests', 'awareness', 'recordings', 'session_' + Date.now() + '.trace.json');
                }
                if (recordTracePath) {
                    recordOptions.recordTraceToFile = true;
                    recordOptions.recordTracePath = recordTracePath;
                }
            }
        } catch (_) { }
        await state.awarenessEngine.start(state.extensionContext, updateFileColorsInExplorer, currentMode, recordOptions);
        log('VibeSwitch: Started real-time awareness monitoring');
        
        // Update awareness engine reference in file decoration provider (if it exists)
        // This ensures decorations work even if they were created before the engine started
        if (state.fileDecorationProvider && typeof state.fileDecorationProvider.setAwarenessEngine === 'function') {
            state.fileDecorationProvider.setAwarenessEngine(state.awarenessEngine);
            // setAwarenessEngine already calls refresh(), no need to call it again
        } else {
            // If decorations weren't created yet, create them now
            initFileDecorations();
        }
        
        // Timer is a boundary - use safe() wrapper
        // Guard against double-start (switch dev→dev)
        if (state.meterUpdateTimer) {
            clearInterval(state.meterUpdateTimer);
        }
        state.meterUpdateTimer = setInterval(() => {
            safe('meterUpdateTimer', () => {
                // Always update meter - runs continuously regardless of mode
                updateAwarenessMeter();
            });
        }, 10000);
        
        updateAwarenessMeter();
    };

    // stopAwarenessMonitor is used ONLY for cleanup on extension deactivation
    // It is NOT called during mode switches - the monitor runs continuously
    const stopAwarenessMonitor = async () => {
        if (!state.awarenessEngine) {
            return;
        }
        
        await state.awarenessEngine.stop();
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
    // Boundary: Command handler - errors handled at boundary
    const switchToMode = async (mode) => {
        try {
            const currentMode = state.getMode();
            log(`VibeSwitch: Switching to ${mode} mode (current: ${currentMode})`);
            
            // Set mode IMMEDIATELY before any file operations
            // This prevents any detection from seeing the wrong mode
            const previousMode = currentMode;
            state.setMode(mode);
            
            // Update UI immediately with the new mode (shows/omits awareness meter)
            switchModeInStatusBar(mode);
            // Update file colors separately based on mode change
            updateFileColorsForMode();
            
            await modeService(mode, {
                currentMode: previousMode, // Pass previous mode for stats
                onModeSwitched: (newMode) => {
                    // Don't change currentMode here - we already set it
                    log(`VibeSwitch: Mode switched callback called with: ${newMode} (already set to ${state.getMode()})`);
                },
                usageStats: state.usageStats,
                vscodeAdapter: container.getAdapter('awareness', 'vscodeAdapter') // Pass adapter for Ports and Adapters pattern
            });
            
            // Verify file was written correctly, but DON'T detect mode from file
            // We trust what we just set
            log(`VibeSwitch: Successfully switched to ${mode} mode (mode locked, no re-detection)`);
            
            // Final UI update to ensure consistency (shows/omits awareness meter)
            switchModeInStatusBar(mode);
            // Update file colors separately to ensure they reflect the new mode
            updateFileColorsForMode();
        } catch (error) {
            // Boundary: Command handler - show user-facing error
            log(`ERROR in switchToMode: ${error.message}`, true, true);
            // Use adapter if available, fallback to direct vscode
            const vscodeAdapter = container.getAdapter('awareness', 'vscodeAdapter');
            const showError = (vscodeAdapter && vscodeAdapter.showErrorMessage) ? vscodeAdapter.showErrorMessage.bind(vscodeAdapter) : vscode.window.showErrorMessage;
            showError(`Failed to switch mode: ${error.message}`);
            throw error; // Re-throw so caller knows it failed
        }
    };

    // ============================================================================
    // STEP 6: Initialize command handlers (depends on all above helpers)
    // ============================================================================
    // Expose so commands (e.g. restart awareness meter) can force meter refresh
    state.updateAwarenessMeter = updateAwarenessMeter;
    const commandHandlers = commandHandlersFactory({
        log,
        switchToMode,
        updateFileColorsInExplorer,
        state,
        container
    });

    // ============================================================================
    // Return all helpers for use in activate function
    // ============================================================================
    return {
        updateAwarenessMeter,
        switchModeInStatusBar,
        updateFileColorsInExplorer,
        updateFileColorsForMode,
        commandHandlers,
        initFileDecorations,
        startAwarenessMonitor,
        stopAwarenessMonitor,
        switchToMode
    };
};
