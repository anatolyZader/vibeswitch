/**
 * CapabilitySetup - Copies hook scripts and canonical.js from extension to ~/.vibeswitch
 * Ensures ~/.vibeswitch/hooks/, state/, lib/ exist and scripts are executable.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const VIBESWITCH_DIR = path.join(os.homedir(), '.vibeswitch');
const HOOKS_DIR = path.join(VIBESWITCH_DIR, 'hooks');
const STATE_DIR = path.join(VIBESWITCH_DIR, 'state');
const LIB_DIR = path.join(VIBESWITCH_DIR, 'lib');

const HOOK_NAMES = [
    'gate-shell.sh',
    'gate-mcp.sh',
    'inject-context.sh',
    'detect-edit.sh'
];

const CANONICAL_FILENAME = 'canonical.js';

/**
 * Ensure directory exists (mkdir -p style)
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Copy a file from src to dest and optionally chmod
 * @param {string} src - Source path
 * @param {string} dest - Destination path
 * @param {number} [mode] - Optional fs.chmod mode (e.g. 0o755)
 */
function copyFile(src, dest, mode) {
    fs.copyFileSync(src, dest);
    if (mode !== undefined) {
        fs.chmodSync(dest, mode);
    }
}

/**
 * Run setup: copy hooks and canonical.js from extension to ~/.vibeswitch
 * @param {string} extensionPath - Path to the extension (context.extensionPath)
 * @returns {{ success: boolean, errors: string[], copied: string[] }}
 */
function runSetup(extensionPath) {
    // #region agent log
    try { fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'capabilitySetup.js:runSetup',message:'runSetup_entry',data:{hasPath:!!extensionPath,pathLen:extensionPath?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{}); } catch (_) {}
    // #endregion
    const errors = [];
    const copied = [];

    if (!extensionPath || !fs.existsSync(extensionPath)) {
        return { success: false, errors: ['Extension path missing or invalid'], copied: [] };
    }

    const hooksDirInExtension = path.join(extensionPath, 'hooks');
    const libCanonicalSrc = path.join(extensionPath, 'lib', CANONICAL_FILENAME);

    try {
        ensureDir(VIBESWITCH_DIR);
        ensureDir(HOOKS_DIR);
        ensureDir(STATE_DIR);
        ensureDir(LIB_DIR);
    } catch (e) {
        errors.push(`Failed to create directories: ${e.message}`);
        return { success: false, errors, copied: [] };
    }

    if (!fs.existsSync(hooksDirInExtension)) {
        errors.push(`Hooks directory not found: ${hooksDirInExtension}`);
    } else {
        for (const name of HOOK_NAMES) {
            const src = path.join(hooksDirInExtension, name);
            const dest = path.join(HOOKS_DIR, name);
            try {
                if (fs.existsSync(src)) {
                    copyFile(src, dest, 0o755);
                    copied.push(`hooks/${name}`);
                } else {
                    errors.push(`Missing hook script: ${name}`);
                }
            } catch (e) {
                errors.push(`Failed to copy ${name}: ${e.message}`);
            }
        }
    }

    if (!fs.existsSync(libCanonicalSrc)) {
        errors.push(`Canonical module not found: ${libCanonicalSrc}`);
    } else {
        try {
            const dest = path.join(LIB_DIR, CANONICAL_FILENAME);
            copyFile(libCanonicalSrc, dest);
            copied.push(`lib/${CANONICAL_FILENAME}`);
        } catch (e) {
            errors.push(`Failed to copy canonical.js: ${e.message}`);
        }
    }

    const success = errors.length === 0;
    // #region agent log
    try { fetch('http://localhost:7242/ingest/13e78070-273b-4280-8000-8403b705f141',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'capabilitySetup.js:runSetup',message:'runSetup_exit',data:{success,copiedCount:copied.length,errorCount:errors.length,firstError:errors[0]},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{}); } catch (_) {}
    // #endregion
    return { success, errors, copied };
}

module.exports = {
    runSetup,
    HOOKS_DIR,
    STATE_DIR,
    LIB_DIR,
    VIBESWITCH_DIR
};
