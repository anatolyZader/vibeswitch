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
const awarenessMeter = require('./ui/awareness-meter');
const modeSwitcher = require('./ui/mode-switcher');
const commandHandlersFactory = require('./vsCommandsFactory');
const modeService = require('./business_modules/mode/app/modeService');
const UnreviewedFileDecor = require('./ui/file-coloring');
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
    // Internal helper - errors propagate to caller (boundary)
    const updateFileColorsInExplorer = () => {
        if (state.fileDecorationProvider && state.getMode() === 'dev') {
            state.fileDecorationProvider.refresh();
        }
    };
    
    // Update file colors for mode change - shows/hides file colors based on mode
    // Called when mode changes to show/hide file decorations
    // NOTE: This is separate from content-based updates to isolate mode switching concerns
    // Internal helper - errors propagate to caller (boundary)
    const updateFileColorsForMode = () => {
        if (state.fileDecorationProvider) {
            // Refresh to show/hide based on current mode (provider checks mode internally)
            state.fileDecorationProvider.refresh();
        }
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
        // #region agent log
        const logData13 = {location:'initializeHelpers.js:93',message:'switchModeInStatusBar called',data:{forceMode:forceMode,hasStatusBarItem:state.statusBarItem!==null,hasModeSwitcher:modeSwitcher!==null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
        console.log('[DEBUG]', JSON.stringify(logData13));
        if (state.outputChannel) state.outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData13)}`);
        fetch('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData13)}).catch(()=>{});
        // #endregion
        // Only update if mode is explicitly provided or already set
        if (forceMode !== null) {
            state.setMode(forceMode);
        }
        
        const currentMode = state.getMode();
        // #region agent log
        const logData14 = {location:'initializeHelpers.js:99',message:'Before updateStatusBar call',data:{currentMode:currentMode,hasStatusBarItem:state.statusBarItem!==null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
        console.log('[DEBUG]', JSON.stringify(logData14));
        if (state.outputChannel) state.outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData14)}`);
        fetch('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData14)}).catch(()=>{});
        // #endregion
        
        // If no mode set at all, show neutral state (don't detect)
        if (!currentMode) {
            modeSwitcher.updateStatusBar(state.statusBarItem, null, state.outputChannel);
            updateAwarenessMeter(); // This will hide the meter if no mode
            return;
        }
        
        // Update mode indicator in status bar
        modeSwitcher.updateStatusBar(state.statusBarItem, currentMode, state.outputChannel);
        // #region agent log
        const logData15 = {location:'initializeHelpers.js:109',message:'After updateStatusBar call',data:{currentMode:currentMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
        console.log('[DEBUG]', JSON.stringify(logData15));
        if (state.outputChannel) state.outputChannel.appendLine(`[DEBUG] ${JSON.stringify(logData15)}`);
        fetch('http://127.0.0.1:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData15)}).catch(()=>{});
        // #endregion
        // Update awareness meter (will show in 'dev' mode, hide in 'vibe' mode)
        updateAwarenessMeter();
        // NOTE: File colors are updated separately - not mixed with status bar updates
    };

    // ============================================================================
    // STEP 3: Initialize file decoration helper
    // ============================================================================
    // Internal helper - errors propagate to caller (boundary: startAwarenessMonitor)
    const initFileDecorations = () => {
        if (!UnreviewedFileDecor || state.fileDecorationProvider || !state.extensionContext) {
            return;
        }
        
        log('Creating file decoration provider...');
        state.fileDecorationProvider = new UnreviewedFileDecor(
            state.awarenessEngine,
            () => state.getMode(),
            state.outputChannel,
            disableLogging
        );
        
        const provider = state.fileDecorationProvider.register(state.extensionContext);
        if (provider) {
            log('✅ File decoration provider registered successfully');
        } else {
            log('❌ ERROR: File decoration provider registration failed');
        }
    };

    // ============================================================================
    // STEP 4: Initialize monitor lifecycle helpers
    // ============================================================================
    // Boundary: Called from mode switching (command handler boundary)
    const startAwarenessMonitor = async () => {
        if (!state.awarenessEngine || !state.extensionContext) {
            return;
        }
        
        // Store updateFileColorsInExplorer in state so modules can access it
        state.updateFileColorsInExplorer = updateFileColorsInExplorer;
        
        // Pass current mode to classifier for mode-specific thresholds
        const currentMode = state.getMode() || 'dev';
        await state.awarenessEngine.start(state.extensionContext, updateFileColorsInExplorer, currentMode);
        log('VibeSwitch: Started real-time awareness monitoring');
        initFileDecorations();
        
        // Timer is a boundary - use safe() wrapper
        // Guard against double-start (switch dev→dev)
        if (state.meterUpdateTimer) {
            clearInterval(state.meterUpdateTimer);
        }
        state.meterUpdateTimer = setInterval(() => {
            safe('meterUpdateTimer', () => {
                if (state.getMode() === 'dev') {
                    updateAwarenessMeter();
                }
            });
        }, 10000);
        
        updateAwarenessMeter();
    };

    // Boundary: Called from mode switching (command handler boundary)
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
                onMonitorStart: async () => await startAwarenessMonitor(),
                onMonitorStop: async () => await stopAwarenessMonitor(),
                usageStats: state.usageStats,
                vscodeAdapter: container.getAdapter('awareness', 'vscodeAdapter'), // Pass adapter for Ports and Adapters pattern
                awarenessEngine: state.awarenessEngine
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
    console.log('[DEBUG] Creating commandHandlers via factory');
    const commandHandlers = commandHandlersFactory({
        log,
        switchToMode,
        updateFileColorsInExplorer,
        state,
        container
    });
    console.log('[DEBUG] commandHandlers created', {
        hasCommandHandlers:commandHandlers!==null,
        commandCount:commandHandlers?Object.keys(commandHandlers).length:0,
        hasShowStatusBar:commandHandlers?'vibeswitch.showStatusBar' in commandHandlers:false,
        allCommands:commandHandlers?Object.keys(commandHandlers):[]
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
