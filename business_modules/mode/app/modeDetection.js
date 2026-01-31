/**
 * Mode Detection - Detects current mode from .cursor/rules.md files
 * 
 * Determines which mode (VIBE/DEV) the workspace is currently in by:
 * - Reading .cursor/rules.md file content and analyzing indicators
 * - Falling back to mode-specific file existence (.cursor/rules.vibe.md, .cursor/rules.dev.md)
 * - Caching results to prevent rapid re-detection
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Cache for mode detection to prevent rapid re-detection
let lastDetectedMode = null;
let lastDetectionTime = 0;
const DETECTION_CACHE_MS = 2000; // Cache for 2 seconds

/**
 * Detects the current mode by checking .cursor/rules.md files
 * @param {boolean} forceFresh - Force fresh detection, bypassing cache
 * @returns {string|null} 'vibe', 'dev', or null if undetermined
 */
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

    // Check workspace root for .cursor/rules.md files
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cursorDir = path.join(workspaceRoot, '.cursor');
    const rulesFile = path.join(cursorDir, 'rules.md');
    const devFile = path.join(cursorDir, 'rules.dev.md');
    const vibeFile = path.join(cursorDir, 'rules.vibe.md');

    let detectedMode = null;

    // Priority: Check .cursor/rules.md content FIRST (it's the active file)
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
            console.error('VibeSwitch: Error reading .cursor/rules.md:', error);
        }
    }

    // Only fallback to mode-specific files if .cursor/rules.md doesn't exist or has no clear indicators
    // DO NOT fallback if .cursor/rules.md exists but detection failed - this prevents false positives
    if (!detectedMode) {
        // If .cursor/rules.md exists but we couldn't detect mode, don't fallback
        // This prevents detecting 'dev' when .cursor/rules.md has vibe content but detection failed
        if (!fs.existsSync(rulesFile)) {
            // .cursor/rules.md doesn't exist, safe to check mode-specific files
            if (fs.existsSync(devFile)) {
                detectedMode = 'dev';
            } else if (fs.existsSync(vibeFile)) {
                detectedMode = 'vibe';
            }
        }
        // If .cursor/rules.md exists but we couldn't detect, return null (ambiguous)
    }

    // Update cache
    lastDetectedMode = detectedMode;
    lastDetectionTime = now;
    
    return detectedMode;
}

/**
 * Invalidate the detection cache so the next detectCurrentMode() reads from disk.
 * Call after mode switch (e.g. after writing rules.md) so detection sees the new state.
 */
function invalidateCache() {
    lastDetectedMode = null;
    lastDetectionTime = 0;
}

module.exports = detectCurrentMode;
module.exports.invalidateCache = invalidateCache;

