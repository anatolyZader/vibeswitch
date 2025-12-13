/**
 * Configuration helpers for mode settings
 */

const vscode = require('vscode');

/**
 * Get the settings configuration for a specific mode
 * @param {string} mode - 'vibe' or 'dev'
 * @returns {Object} Settings object for the mode
 */
function getModeSettings(mode) {
    const settings = {
        vibe: {
            "cursor.chat.defaultMode": "agent",
            "cursor.agent.requireApproval": false,
            "cursor.agent.autoApplyEdits": true,
            "cursor.ai.autoApply": true,
            "files.autoSave": "afterDelay",
            "files.autoSaveDelay": 1000
        },
        dev: {
            "cursor.chat.defaultMode": "ask",
            "cursor.agent.requireApproval": true,
            "cursor.agent.autoApplyEdits": false,
            "cursor.ai.autoApply": false,
            "files.autoSave": "afterDelay",
            "files.autoSaveDelay": 3000
        }
    };
    return settings[mode] || {};
}

/**
 * Apply mode settings programmatically using VS Code's configuration API
 * This applies settings immediately without requiring a window reload
 * @param {string} mode - 'vibe' or 'dev'
 * @param {boolean} skipCursorSettings - Skip cursor.* settings (they may trigger Cursor to reload)
 */
async function applyModeSettings(mode, skipCursorSettings = false) {
    const settings = getModeSettings(mode);
    const settingsCount = Object.keys(settings).length;
    console.log(`VibeSwitch: Applying ${settingsCount} settings for ${mode} mode...`);
    
    let appliedCount = 0;
    let skippedCount = 0;
    
    for (const [key, value] of Object.entries(settings)) {
        try {
            // Skip cursor.* settings if requested (Cursor may auto-reload when these change)
            if (skipCursorSettings && key.startsWith('cursor.')) {
                console.log(`VibeSwitch: ⏭️  SKIPPED ${key} (skipCursorSettings=true)`);
                skippedCount++;
                continue;
            }
            
            // Split key into section and property (e.g., "cursor.chat.defaultMode" -> ["cursor", "chat.defaultMode"])
            const firstDot = key.indexOf('.');
            if (firstDot === -1) {
                console.log(`VibeSwitch: ⚠️  INVALID ${key} (no dot in key)`);
                continue;
            }
            
            const section = key.substring(0, firstDot);
            const property = key.substring(firstDot + 1);
            
            console.log(`VibeSwitch: ⏳ Applying ${key} = ${JSON.stringify(value)}...`);
            const config = vscode.workspace.getConfiguration(section);
            await config.update(property, value, vscode.ConfigurationTarget.Workspace);
            console.log(`VibeSwitch: ✅ Applied ${key} = ${JSON.stringify(value)}`);
            appliedCount++;
        } catch (error) {
            // Some settings may not exist in all editors (e.g., cursor.* in VS Code)
            console.log(`VibeSwitch: ❌ Failed to apply ${key}: ${error.message}`);
        }
    }
    
    console.log(`VibeSwitch: Settings summary - Applied: ${appliedCount}, Skipped: ${skippedCount}, Total: ${settingsCount}`);
}

module.exports = {
    getModeSettings,
    applyModeSettings
};


