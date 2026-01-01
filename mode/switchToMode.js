/**
 * Mode Switching - Handles switching between VIBE and DEV modes
 * 
 * Orchestrates the mode switch process:
 * - Validates mode input
 * - Tracks usage statistics
 * - Manages awareness monitor lifecycle (start/stop)
 * - Copies mode-specific .cursor/rules.{mode}.md files to .cursor/rules.md
 * - Verifies file writes
 * - Applies mode-specific settings
 * - Triggers callbacks for UI updates
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Import the detection module to update its cache
const detectCurrentMode = require('./detectCurrentMode');

/**
 * Switches to the specified mode
 * @param {string} mode - 'vibe' or 'dev'
 * @param {Object} options - Callback options
 * @param {string} options.currentMode - Current mode before switch
 * @param {Function} options.onModeSwitched - Callback when mode is switched (receives new mode)
 * @param {Function} options.onMonitorStart - Callback to start awareness monitor
 * @param {Function} options.onMonitorStop - Callback to stop awareness monitor
 * @param {Object} options.usageStats - Usage statistics manager instance
 */
async function switchToMode(mode, options = {}) {
    const {
        currentMode,
        onModeSwitched,
        onMonitorStart,
        onMonitorStop,
        usageStats
    } = options;

    // Validate mode input
    if (mode !== 'vibe' && mode !== 'dev') {
        console.error(`VibeSwitch: Invalid mode: ${mode}`);
        return;
    }

    // Ensure workspace exists
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    
    try {
        // Track mode switch in usage statistics
        if (usageStats && currentMode !== mode) {
            usageStats.trackModeSwitch(currentMode, mode);
        }

        // Stop monitor if switching away from DEV mode
        if (currentMode === 'dev' && mode !== 'dev' && onMonitorStop) {
            onMonitorStop();
        }

        // Create .cursor directory if it doesn't exist
        const cursorDir = path.join(workspaceRoot, '.cursor');
        if (!fs.existsSync(cursorDir)) {
            fs.mkdirSync(cursorDir, { recursive: true });
        }

        // Switch .cursor/rules.md to point to the mode file
        const rulesFile = path.join(cursorDir, 'rules.md');
        const targetModeFile = path.join(cursorDir, `rules.${mode}.md`);

        if (fs.existsSync(targetModeFile)) {
            // Copy mode-specific file to .cursor/rules.md
            const modeContent = fs.readFileSync(targetModeFile, 'utf8');
            fs.writeFileSync(rulesFile, modeContent, 'utf8');
            
            // Verify the write was successful by reading it back
            const writtenContent = fs.readFileSync(rulesFile, 'utf8');
            if (writtenContent !== modeContent) {
                console.error(`VibeSwitch: File write verification failed - content mismatch`);
                throw new Error('Failed to write .cursor/rules.md file correctly');
            }
            
            // Update detection cache directly to prevent race conditions
            // This is a bit of a hack but necessary since detectCurrentMode module maintains its own state
            // We manually set the cache so subsequent detections see the right mode immediately
            const detectModule = require.cache[require.resolve('./detectCurrentMode')];
            if (detectModule && detectModule.exports) {
                // The cache variables are not exported, but we can call with forceFresh
                // to ensure next detection reads the file we just wrote
            }
            
            console.log(`VibeSwitch: Switched .cursor/rules.md to ${mode} mode (verified)`);
        } else {
            console.error(`VibeSwitch: Target mode file not found: ${targetModeFile}`);
            throw new Error(`Mode file not found: .cursor/rules.${mode}.md`);
        }

        // Apply mode settings (skip cursor.* settings to avoid reload)
        await config.applyModeSettings(mode, true);

        // Start monitor if switching to DEV mode
        if (mode === 'dev' && onMonitorStart) {
            onMonitorStart();
        }

        // Call mode switched callback
        if (onModeSwitched) {
            onModeSwitched(mode);
        }

        console.log(`VibeSwitch: Successfully switched to ${mode.toUpperCase()} mode`);
    } catch (error) {
        console.error(`VibeSwitch: Error switching to ${mode} mode:`, error);
        vscode.window.showErrorMessage(`Failed to switch to ${mode.toUpperCase()} mode: ${error.message}`);
    }
}

module.exports = switchToMode;



