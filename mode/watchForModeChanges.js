/**
 * Mode Watching - Monitors file system for .cursor/rules.md changes
 * 
 * Provides file system watching to detect external changes to mode files:
 * - Watches .cursor/rules.md, .cursor/rules.dev.md, .cursor/rules.vibe.md
 * - Debounces rapid changes to prevent excessive triggers
 * - Calls callback when mode files are modified/created/deleted
 * - Useful for detecting manual edits, git branch switches, etc.
 */

const vscode = require('vscode');
const path = require('path');

/**
 * Watches for changes to .cursor/rules*.md files and triggers callback
 * @param {Function} callback - Callback to call when mode files change
 * @returns {vscode.FileSystemWatcher|null} The file system watcher instance, or null if no workspace
 */
function watchForModeChanges(callback) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cursorDir = path.join(workspaceRoot, '.cursor');
    const rulesFile = path.join(cursorDir, 'rules.md');
    const devFile = path.join(cursorDir, 'rules.dev.md');
    const vibeFile = path.join(cursorDir, 'rules.vibe.md');

    // Watch for changes to any .cursor/rules*.md files
    const pattern = new vscode.RelativePattern(cursorDir, 'rules*.md');
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

    console.log('VibeSwitch: Watching for .cursor/rules*.md file changes');
    return watcher;
}

module.exports = watchForModeChanges;



