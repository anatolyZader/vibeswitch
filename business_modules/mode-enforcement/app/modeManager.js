/**
 * ModeManager - Manages mode state with secure storage
 * 
 * SOURCE OF TRUTH: context.globalState ('vibeswitch.mode')
 * MIRROR: $HOME/.vibeswitch/state/mode.json (for hook scripts to read)
 * 
 * The mirror is best-effort and should not block mode operations.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getGlobalKey, setGlobalKey } = require('../../../cross_cut_modules/storage-uri/globalKeysStorage');

const VIBESWITCH_DIR = path.join(os.homedir(), '.vibeswitch');
const STATE_DIR = path.join(VIBESWITCH_DIR, 'state');
const MODE_FILE = path.join(STATE_DIR, 'mode.json');
const GLOBAL_STATE_KEY = 'vibeswitch.mode';

class ModeManager {
    /**
     * @param {vscode.ExtensionContext} context - VS Code extension context
     */
    constructor(context) {
        if (!context) {
            throw new Error('ModeManager: context is required');
        }
        this._context = context;
        this._ensureDirectories();
    }

    _ensureDirectories() {
        try {
            if (!fs.existsSync(STATE_DIR)) {
                fs.mkdirSync(STATE_DIR, { recursive: true });
            }
        } catch (error) {
            console.error('ModeManager: Failed to create state directory:', error.message);
        }
    }

    /**
     * Get current mode from secure storage
     * @returns {string} 'dev' or 'vibe'
     */
    getMode() {
        const mode = getGlobalKey(this._context, GLOBAL_STATE_KEY);
        return mode === 'dev' ? 'dev' : 'vibe';  // Default to vibe
    }

    /**
     * Set mode in secure storage and mirror to filesystem
     * @param {string} mode - 'dev' or 'vibe'
     * @returns {Promise<boolean>} Success status
     */
    async setMode(mode) {
        if (mode !== 'dev' && mode !== 'vibe') {
            throw new Error(`ModeManager: Invalid mode '${mode}'`);
        }

        // Store in disk (unified storage)
        await setGlobalKey(this._context, GLOBAL_STATE_KEY, mode);

        // Mirror to filesystem (best-effort, for hooks)
        this._mirrorToFileSystem(mode);

        return true;
    }

    /**
     * Mirror mode to filesystem for hook scripts to read
     * This is best-effort and should not block operations.
     * @private
     */
    _mirrorToFileSystem(mode) {
        try {
            const content = JSON.stringify({
                mode: mode,
                ts: new Date().toISOString()
            }, null, 2);
            
            // Atomic write: write to temp file then rename
            const tempFile = MODE_FILE + '.tmp';
            fs.writeFileSync(tempFile, content, 'utf8');
            fs.renameSync(tempFile, MODE_FILE);
        } catch (error) {
            console.error('ModeManager: Failed to mirror mode to filesystem:', error.message);
            // Don't throw - mirror is best-effort
        }
    }

    /**
     * Force sync from globalState to filesystem
     * Call this on extension activation to ensure consistency
     */
    syncToFileSystem() {
        const mode = this.getMode();
        this._mirrorToFileSystem(mode);
    }
}

module.exports = ModeManager;
