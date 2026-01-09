/**
 * Extension Setup Helpers
 * 
 * Utility functions for setting up VS Code extension components:
 * - Command registration
 * - Event listener setup
 * 
 * These are extension-level concerns that don't belong in business modules.
 */

const vscode = require('vscode');
const safe = require('./safe');

/**
 * Register all VS Code commands
 * 
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {Object} commandHandlers - Object mapping command IDs to handler functions
 * @param {Function} log - Optional logging function
 * @throws {Error} If context or commandHandlers are missing
 */
function registerCommands(context, commandHandlers, log = null) {
    if (!context || !commandHandlers) {
        throw new Error('registerCommands: context and commandHandlers are required');
    }
    
    Object.entries(commandHandlers).forEach(([command, handler]) => {
        if (!command || !handler) {
            // Log warning in development mode for missing handlers
            if (log && process.env.NODE_ENV !== 'production') {
                log(`WARNING: Skipping invalid command handler - command: ${command || 'undefined'}, handler: ${handler ? 'exists' : 'missing'}`, false, false);
            }
            return; // Skip invalid entries
        }
        context.subscriptions.push(vscode.commands.registerCommand(command, handler));
    });
}

/**
 * Setup usage statistics event listeners
 * 
 * Tracks file operations (open, edit, save) for usage statistics.
 * Uses safe() wrapper for error boundaries.
 * 
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {Object} state - Extension state (must have usageStats property)
 * @throws {Error} If context or state are missing
 */
function setupUsageStatsListeners(context, state) {
    if (!context || !state) {
        throw new Error('setupUsageStatsListeners: context and state are required');
    }
    
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((doc) => {
            safe('trackFileOpen', () => {
                if (state.usageStats) {
                    state.usageStats.trackFileOpen(doc.fileName);
                }
            });
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            safe('trackEdit', () => {
                if (state.usageStats && event.contentChanges.length > 0) {
                    // Enhanced metadata for future AI vs human inference
                    const metadata = {
                        document: event.document.uri.fsPath,
                        changeCount: event.contentChanges.length,
                        timestamp: Date.now(),
                        // Future: could add file size, edit pattern analysis, etc.
                    };
                    state.usageStats.trackEdit(metadata);
                }
            });
        }),
        vscode.workspace.onDidSaveTextDocument((document) => {
            safe('trackFileSave', () => {
                if (state.usageStats) {
                    state.usageStats.trackFileSave();
                }
            });
        })
    );
}

module.exports = {
    registerCommands,
    setupUsageStatsListeners
};
