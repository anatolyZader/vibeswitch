/**
 * Mode Manager - Handles mode detection and switching
 * 
 * Manages:
 * - Detecting current mode from .cursorrules files
 * - Switching between VIBE and DEV modes
 * - Watching for mode file changes
 * - Applying mode settings
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const fileManager = require('./file-manager');

/**
 * Detects the current mode by checking .cursorrules files
 * @returns {string|null} 'vibe', 'dev', or null if undetermined
 */
// Cache for mode detection to prevent rapid re-detection
let lastDetectedMode = null;
let lastDetectionTime = 0;
const DETECTION_CACHE_MS = 2000; // Cache for 2 seconds

function detectCurrentMode(forceFresh = false) {
    const now = Date.now();
    
    // Return cached result if recent and not forcing fresh detection
    if (!forceFresh && lastDetectedMode !== null && (now - lastDetectionTime) < DETECTION_CACHE_MS) {
        return lastDetectedMode;
    }
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        lastDetectedMode = null;
        return null;
    }

    // Check workspace root for .cursorrules files
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const rulesFile = path.join(workspaceRoot, '.cursorrules');
    const devFile = path.join(workspaceRoot, '.cursorrules.dev');
    const vibeFile = path.join(workspaceRoot, '.cursorrules.vibe');

    let detectedMode = null;

    // Priority: Check .cursorrules content FIRST (it's the active file)
    // This ensures we detect the mode that was just switched to, even if mode-specific files exist
    if (fs.existsSync(rulesFile)) {
        try {
            const content = fs.readFileSync(rulesFile, 'utf8');
            // Check for mode indicators in content (case-insensitive for robustness)
            const upperContent = content.toUpperCase();
            
            // Check for VIBE mode indicators first (more specific)
            if (upperContent.includes('VIBE MODE') || content.includes('cursor.chat.defaultMode="agent"') || content.includes("cursor.chat.defaultMode='agent'")) {
                detectedMode = 'vibe';
            }
            // Then check for DEV mode indicators
            else if (upperContent.includes('DEV MODE') || content.includes('cursor.chat.defaultMode="ask"') || content.includes("cursor.chat.defaultMode='ask'")) {
                detectedMode = 'dev';
            }
        } catch (error) {
            console.error('VibeSwitch: Error reading .cursorrules:', error);
        }
    }

    // Only fallback to mode-specific files if .cursorrules doesn't exist or has no clear indicators
    // DO NOT fallback if .cursorrules exists but detection failed - this prevents false positives
    if (!detectedMode) {
        // If .cursorrules exists but we couldn't detect mode, don't fallback
        // This prevents detecting 'dev' when .cursorrules has vibe content but detection failed
        if (!fs.existsSync(rulesFile)) {
            // .cursorrules doesn't exist, safe to check mode-specific files
            if (fs.existsSync(devFile)) {
                detectedMode = 'dev';
            } else if (fs.existsSync(vibeFile)) {
                detectedMode = 'vibe';
            }
        }
        // If .cursorrules exists but we couldn't detect, return null (ambiguous)
    }

    // Update cache
    lastDetectedMode = detectedMode;
    lastDetectionTime = now;
    
    return detectedMode;
}

/**
 * Switches to the specified mode
 * @param {string} mode - 'vibe' or 'dev'
 * @param {Object} options - Callback options
 * @param {string} options.currentMode - Current mode
 * @param {Function} options.onModeSwitched - Callback when mode is switched
 * @param {Function} options.onMonitorStart - Callback to start monitor
 * @param {Function} options.onMonitorStop - Callback to stop monitor
 * @param {Object} options.usageStats - Usage statistics manager
 */
async function switchToMode(mode, options = {}) {
    const {
        currentMode,
        onModeSwitched,
        onMonitorStart,
        onMonitorStop,
        usageStats
    } = options;

    if (mode !== 'vibe' && mode !== 'dev') {
        console.error(`VibeSwitch: Invalid mode: ${mode}`);
        return;
    }

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

        // Create mode-specific .cursorrules file if it doesn't exist
        const modeFile = path.join(workspaceRoot, `.cursorrules.${mode}`);
        if (!fs.existsSync(modeFile)) {
            await fileManager.createDefaultModeFiles(workspaceRoot);
        }

        // Switch .cursorrules to point to the mode file
        const rulesFile = path.join(workspaceRoot, '.cursorrules');
        const targetModeFile = path.join(workspaceRoot, `.cursorrules.${mode}`);

        if (fs.existsSync(targetModeFile)) {
            // Copy mode-specific file to .cursorrules
            const modeContent = fs.readFileSync(targetModeFile, 'utf8');
            fs.writeFileSync(rulesFile, modeContent, 'utf8');
            
            // Verify the write was successful by reading it back
            const writtenContent = fs.readFileSync(rulesFile, 'utf8');
            if (writtenContent !== modeContent) {
                console.error(`VibeSwitch: File write verification failed - content mismatch`);
                throw new Error('Failed to write .cursorrules file correctly');
            }
            
            // Update cache with the mode we just set (don't detect, trust what we wrote)
            lastDetectedMode = mode;
            lastDetectionTime = Date.now();
            
            console.log(`VibeSwitch: Switched .cursorrules to ${mode} mode (verified, cache updated)`);
        } else {
            console.error(`VibeSwitch: Target mode file not found: ${targetModeFile}`);
            throw new Error(`Mode file not found: .cursorrules.${mode}`);
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

/**
 * Watches for changes to .cursorrules files and triggers callback
 * @param {Function} callback - Callback to call when mode changes
 * @returns {vscode.FileSystemWatcher} The file system watcher
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

    let debounceTimer = null;
    const debounceDelay = 1500; // 1.5 seconds debounce to prevent rapid firing

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

    watcher.onDidChange(handleChange);
    watcher.onDidCreate(handleChange);
    watcher.onDidDelete(handleChange);

    console.log('VibeSwitch: Watching for .cursorrules file changes');
    return watcher;
}

module.exports = {
    detectCurrentMode,
    switchToMode,
    watchForModeChanges
};






















