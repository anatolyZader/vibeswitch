/**
 * Mode Settings - Applies VS Code/Cursor settings when switching between VIBE and DEV modes
 * 
 * This module handles the application of editor settings (cursor.*, files.*) that change
 * based on the selected mode. It's part of the mode switching functionality, not extension-wide config.
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
    
    // #region agent log
    fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'modeSettingsAdapter.js:applyModeSettings',message:'applyModeSettings called',data:{mode,skipCursorSettings,settingsCount},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    let appliedCount = 0;
    let skippedCount = 0;
    
    for (const [key, value] of Object.entries(settings)) {
        try {
            // Skip cursor.* settings if requested (Cursor may auto-reload when these change)
            if (skipCursorSettings && key.startsWith('cursor.')) {
                console.log(`VibeSwitch: ⏭️  SKIPPED ${key} (skipCursorSettings=true)`);
                // #region agent log
                fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'modeSettingsAdapter.js:skip',message:'Setting SKIPPED',data:{key,value,skipCursorSettings},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
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
            
            // #region agent log
            const beforeValue = config.get(property);
            fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'modeSettingsAdapter.js:beforeUpdate',message:'Before setting update',data:{key,section,property,beforeValue,newValue:value},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B-C'})}).catch(()=>{});
            // #endregion
            
            await config.update(property, value, vscode.ConfigurationTarget.Workspace);
            
            // #region agent log
            const afterValue = config.get(property);
            fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'modeSettingsAdapter.js:afterUpdate',message:'After setting update',data:{key,section,property,afterValue,expectedValue:value,success:afterValue===value},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B-C'})}).catch(()=>{});
            // #endregion
            
            console.log(`VibeSwitch: ✅ Applied ${key} = ${JSON.stringify(value)}`);
            appliedCount++;
        } catch (error) {
            // Some settings may not exist in all editors (e.g., cursor.* in VS Code)
            console.log(`VibeSwitch: ❌ Failed to apply ${key}: ${error.message}`);
            // #region agent log
            fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'modeSettingsAdapter.js:error',message:'Setting update FAILED',data:{key,error:error.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
        }
    }
    
    console.log(`VibeSwitch: Settings summary - Applied: ${appliedCount}, Skipped: ${skippedCount}, Total: ${settingsCount}`);
    
    // #region agent log
    fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'modeSettingsAdapter.js:summary',message:'Settings apply complete',data:{mode,appliedCount,skippedCount,settingsCount},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
}

module.exports = {
    getModeSettings,
    applyModeSettings
};


