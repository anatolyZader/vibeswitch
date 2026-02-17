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
 * 2. Create UI helpers (updateReportButton, updateFileColorsInExplorer)
 * 3. Create monitor lifecycle helpers (start/stop)
 * 4. Create file decoration helper
 * 5. Create command handlers (depends on all above)
 */

const vscode = require('vscode');

// Import modules
const reportButton = require('./ui/reportButtonDisplay');
const commandHandlersFactory = require('./vsCommandsFactory');
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
    // STEP 2: Initialize UI helpers (needed by monitor)
    // ============================================================================
    // Update file colors in Explorer - updates file name colors based on review debt/pending status
    // Called when debt/suggestions change to reflect current state
    // DISABLED: File coloring module disabled to prevent noise and excessive load
    // Internal helper - errors propagate to caller (boundary)
    const updateFileColorsInExplorer = () => {
        // DISABLED: File coloring disabled
        return;
    };
    
    // Update report button - called after score calculation
    // Internal helper - errors propagate to caller (boundary)
    const updateReportButton = () => {
        reportButton.updateReportButton(
            state.awarenessBarItem, 
            state.awarenessEngine, 
            null, // No mode - VibeSwitch doesn't use modes anymore
            state.outputChannel
        );
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
    // STEP 3: Initialize monitor lifecycle helpers
    // ============================================================================
    // Starts the awareness monitor - called once on extension activation
    // The monitor runs continuously and is never stopped
    const startAwarenessMonitor = async () => {
        if (!state.awarenessEngine || !state.extensionContext) {
            return;
        }
        
        // Store updateFileColorsInExplorer in state so modules can access it
        state.updateFileColorsInExplorer = updateFileColorsInExplorer;
        
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
        await state.awarenessEngine.start(state.extensionContext, updateFileColorsInExplorer, null, recordOptions);
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
        if (state.reportButtonUpdateTimer) {
            clearInterval(state.reportButtonUpdateTimer);
        }
        state.reportButtonUpdateTimer = setInterval(() => {
            safe('reportButtonUpdateTimer', () => {
                // Always update report button - runs continuously
                updateReportButton();
            });
        }, 10000);
        
        updateReportButton();
    };

    // stopAwarenessMonitor is used ONLY for cleanup on extension deactivation
    const stopAwarenessMonitor = async () => {
        if (!state.awarenessEngine) {
            return;
        }
        
        await state.awarenessEngine.stop();
        log('VibeSwitch: Stopped awareness monitoring');
        
        if (state.fileDecorationProvider) {
            state.fileDecorationProvider.dispose();
            state.fileDecorationProvider = null;
        }
        
        if (state.reportButtonUpdateTimer) {
            clearInterval(state.reportButtonUpdateTimer);
            state.reportButtonUpdateTimer = null;
        }
    };

    // ============================================================================
    // STEP 4: Initialize command handlers (depends on all above helpers)
    // ============================================================================
    // Expose so commands (e.g. restart report button) can force button refresh
    state.updateReportButton = updateReportButton;
    const commandHandlers = commandHandlersFactory({
        log,
        updateFileColorsInExplorer,
        state,
        container
    });

    // ============================================================================
    // Return all helpers for use in activate function
    // ============================================================================
    return {
        updateReportButton,
        updateFileColorsInExplorer,
        commandHandlers,
        initFileDecorations,
        startAwarenessMonitor,
        stopAwarenessMonitor
    };
};
