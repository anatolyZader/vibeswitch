/**
 * Mode detection, switching, and file watching
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { isPathSafe } = require('./file-utils');
const fileManager = require('./file-manager');

/**
 * Detects the current mode by reading the .cursorrules file
 * 
 * Searches for mode markers in the file content:
 * - "VIBE MODE" → returns 'vibe'
 * - "DEV MODE" → returns 'dev'
 * - Neither found → returns null
 * 
 * @returns {string|null} Current mode ('vibe', 'dev', or null if unknown/not set)
 */
function detectCurrentMode() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return null;

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cursorrules = path.join(workspaceRoot, '.cursorrules');

    if (!fs.existsSync(cursorrules)) {
        return null;
    }

    try {
        const content = fs.readFileSync(cursorrules, 'utf8');
        if (content.includes('VIBE MODE')) {
            return 'vibe';
        } else if (content.includes('DEV MODE')) {
            return 'dev';
        }
    } catch (error) {
        console.error('Error reading .cursorrules:', error);
    }

    return null;
}

/**
 * Sets up a file watcher to monitor .cursorrules for external changes
 * 
 * When .cursorrules is modified, calls the provided callback to update UI
 * 
 * @param {Function} onModeChange - Callback function to call when mode changes
 * @returns {fs.FSWatcher|null} The file watcher instance, or null if not created
 */
function watchForModeChanges(onModeChange) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return null;

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cursorrules = path.join(workspaceRoot, '.cursorrules');

    // Only watch if file exists
    if (!fs.existsSync(cursorrules)) {
        console.log('VibeSwitch: .cursorrules not found, skipping file watch');
        return null;
    }

    try {
        // Watch for file changes
        const watcher = fs.watch(cursorrules, (eventType) => {
            if (eventType === 'change') {
                if (onModeChange) {
                    onModeChange();
                }
            }
        });

        // Handle watcher errors
        watcher.on('error', (error) => {
            console.error('VibeSwitch: File watcher error:', error);
        });

        return watcher;
    } catch (error) {
        console.error('VibeSwitch: Failed to start file watcher:', error);
        return null;
    }
}

/**
 * Switches the workspace to the specified mode (VIBE or DEV)
 * 
 * @param {string} mode - The mode to switch to ('vibe' or 'dev')
 * @param {Object} options - Configuration options
 * @param {Function} options.onModeSwitched - Callback when mode is successfully switched
 * @param {Function} options.onMonitorStart - Callback to start awareness monitor (for DEV mode)
 * @param {Function} options.onMonitorStop - Callback to stop awareness monitor (for VIBE mode)
 * @param {Object} options.usageStats - Usage statistics manager instance
 * @returns {Promise<void>}
 */
async function switchToMode(mode, options = {}) {
    const {
        onModeSwitched,
        onMonitorStart,
        onMonitorStop,
        usageStats
    } = options;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    // Validate mode parameter
    const validModes = ['vibe', 'dev'];
    if (!validModes.includes(mode)) {
        vscode.window.showErrorMessage(`Invalid mode: ${mode}`);
        console.error('VibeSwitch: Invalid mode attempted:', mode);
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const customPath = config.get('rulesPath');
    const basePath = customPath || workspaceRoot;

    // Validate custom path if provided
    if (customPath) {
        const resolvedPath = path.resolve(workspaceRoot, customPath);
        if (!isPathSafe(resolvedPath, workspaceRoot)) {
            vscode.window.showErrorMessage('Invalid custom rules path');
            console.error('VibeSwitch: Unsafe custom path detected:', customPath);
            return;
        }
    }

    try {
        // Define file paths for .cursorrules
        const cursorrules = path.join(basePath, '.cursorrules');
        const sourceRules = path.join(basePath, `.cursorrules.${mode}`);

        // Validate paths are safe
        if (!isPathSafe(cursorrules, workspaceRoot) || 
            !isPathSafe(sourceRules, workspaceRoot)) {
            vscode.window.showErrorMessage('Invalid file path detected');
            console.error('VibeSwitch: Path validation failed');
            return;
        }

        // Check if source .cursorrules file exists
        if (!fs.existsSync(sourceRules)) {
            const create = await vscode.window.showErrorMessage(
                `Missing .cursorrules.${mode}. Would you like to create default mode files?`,
                'Yes', 'No'
            );
            if (create === 'Yes') {
                await fileManager.createDefaultModeFiles(basePath);
            } else {
                return;
            }
        }

        // Validate source file size (max 1MB to prevent abuse)
        const MAX_FILE_SIZE = 1024 * 1024; // 1MB
        const sourceStats = fs.statSync(sourceRules);
        if (sourceStats.size > MAX_FILE_SIZE) {
            vscode.window.showErrorMessage('Source file too large (max 1MB)');
            console.error('VibeSwitch: File size exceeded:', sourceStats.size);
            return;
        }

        // Copy .cursorrules file (Cursor monitors this file automatically)
        console.log(`VibeSwitch: Switching .cursorrules to ${mode} mode...`);
        fs.copyFileSync(sourceRules, cursorrules);
        console.log(`VibeSwitch: ✅ .cursorrules updated to ${mode} mode`);

        // Track mode switch (before currentMode is updated)
        const previousMode = options.currentMode;

        // Call callbacks
        if (onModeSwitched) {
            onModeSwitched(mode);
        }

        // Start/stop awareness monitor based on mode
        if (mode === 'dev' && onMonitorStart) {
            onMonitorStart();
        } else if (mode === 'vibe' && onMonitorStop) {
            onMonitorStop();
        }

        // Track the switch in usage statistics
        if (usageStats) {
            usageStats.trackModeSwitch(previousMode, mode);
        }

        // Show success message
        const modeName = mode.toUpperCase();
        const emoji = mode === 'vibe' ? '⚡' : '📚';
        
        // No reload needed - .cursorrules changes take effect immediately
        console.log('VibeSwitch: Mode switch complete - no reload needed');
        vscode.window.showInformationMessage(
            `${emoji} Switched to ${modeName} mode - active immediately!`
        );
        
        console.log('VibeSwitch: switchToMode() completed successfully');

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to switch mode: ${error.message}`);
        console.error('VibeSwitch error:', error);
    }
}

module.exports = {
    detectCurrentMode,
    watchForModeChanges,
    switchToMode
};


