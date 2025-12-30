// extension.js

const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const { window, workspace, commands, StatusBarAlignment } = vscode;
const { createLogger, getLogger, setDisableLogging } = require('./logger');
const UsageStatsManager = require('./userStats'); // todo
const userStatsUI = require('./ui/userStatsUI'); // todo
const detectCurrentMode = require('./mode/detectCurrentMode');
const AwarenessMonitor = require('./awarenessMonitor');
const statusBar = require('./ui/status-bar');
const UnreviewedFileDecor = require('./ui/fileColorsInExplorer');
const ui = require('./ui/ui');
const DIContainer = require('./diContainer');
const initializeHelpers = require('./helpers/initializeHelpers');

// Development flag: Set to true to disable all output logging
const DISABLE_LOGGING = true;

// Register all commands
const registerCommands = (context, commandHandlers) => {
    Object.entries(commandHandlers).forEach(([command, handler]) => {
        context.subscriptions.push(commands.registerCommand(command, handler));
    });
};

// Setup usage stats listeners
const setupUsageStatsListeners = (context, state) => {
    context.subscriptions.push(
        workspace.onDidOpenTextDocument((doc) => state.usageStats?.trackFileOpen(doc.fileName)),
        workspace.onDidChangeTextDocument((event) => {
            if (state.usageStats && event.contentChanges.length > 0) state.usageStats.trackEdit();
        }),
        workspace.onDidSaveTextDocument(() => state.usageStats?.trackFileSave()),
        { dispose: () => state.usageStats?.endSession() }
    );
};

// Main activation function
function activate(context) {
    // Create extension state
    const state = new DIContainer();
    state.extensionContext = context;
    
    try {
        // Initialize output channel
        state.outputChannel = window.createOutputChannel('VibeSwitch');
        context.subscriptions.push(state.outputChannel);
        
        // Initialize logger with output channel and set logging preference centrally
        createLogger(state.outputChannel);
        setDisableLogging(DISABLE_LOGGING);
        
        // Initialize managers
        state.usageStats = new UsageStatsManager(context);
        
        // Initialize awareness monitor
        state.awarenessMonitor = new AwarenessMonitor(state.usageStats);
        
        // Initialize helpers with state
        const helpers = initializeHelpers(state, DISABLE_LOGGING);
        const { log, switchModeInStatusBar, commandHandlers } = helpers;
        
        // Initialize status bar items using VS Code API
        state.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
        state.awarenessBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 99);
        state.statusBarItem.command = 'vibeswitch.switchMode';
        state.statusBarItem.show();
        
        // Register all commands
        registerCommands(context, commandHandlers);
        
        // Detect initial mode from file
        const initialMode = detectCurrentMode();
        log(`VibeSwitch: Detected initial mode from file: ${initialMode}`);
        switchModeInStatusBar(initialMode);
        
        // Disable file-based mode detection completely
        // This prevents all flashing and race conditions
        log('VibeSwitch: File watcher disabled - mode only changes on explicit user action');
        
        setupUsageStatsListeners(context, state);
    } catch (error) {
        console.error('VibeSwitch: Error during activation:', error);
        state.outputChannel?.appendLine(`ERROR: ${error.message}`);
        state.outputChannel?.show(true);
    }
}

// Deactivation function
function deactivate() {
    // Cleanup is handled by context.subscriptions
};

module.exports = { activate, deactivate };
