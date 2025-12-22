/**
 * Mode Watching - Monitors file system for .cursorrules changes
 * 
 * Provides file system watching to detect external changes to mode files:
 * - Watches .cursorrules, .cursorrules.dev, .cursorrules.vibe
 * - Debounces rapid changes to prevent excessive triggers
 * - Calls callback when mode files are modified/created/deleted
 * - Useful for detecting manual edits, git branch switches, etc.
 */

const vscode = require('vscode');
const path = require('path');

/**
 * Watches for changes to .cursorrules files and triggers callback
 * @param {Function} callback - Callback to call when mode files change
 * @returns {vscode.FileSystemWatcher|null} The file system watcher instance, or null if no workspace
 */
function watchForModeChanges(callback) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const rulesFile = path.join(workspaceRoot, '.cursorrules');
    const devFile = path.join(workspaceRoot, '.cursorrules.dev');
    const vibeFile = path.join(workspaceRoot, '.cursorrules.vibe');

    // Watch for changes to any .cursorrules files
    const pattern = new vscode.RelativePattern(workspaceRoot, '.cursorrules*');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    // Debounce configuration
    let debounceTimer = null;
    const debounceDelay = 1500; // 1.5 seconds debounce to prevent rapid firing

    /**
     * Handles file change events with debouncing
     */
    const handleChange = () => {
        // Debounce rapid file changes
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        debounceTimer = setTimeout(() => {
            if (callback) {
                callback();
            }
        }, debounceDelay);
    };

    // Register event handlers
    watcher.onDidChange(handleChange);
    watcher.onDidCreate(handleChange);
    watcher.onDidDelete(handleChange);

    console.log('VibeSwitch: Watching for .cursorrules file changes');
    return watcher;
}

module.exports = watchForModeChanges;



