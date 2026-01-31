/**
 * Mode Switching - Handles switching between VIBE and DEV modes
 *
 * Orchestrates the mode switch process:
 * - Validates mode input
 * - Tracks usage statistics
 * - Assembles .cursor/rules.common.md + .cursor/rules.{mode}.md
 * - Writes atomically (tmp + rename) with optional backup
 * - Verifies write by stat size > 0 (no full-content compare)
 * - Invalidates mode detection cache
 * - Applies mode-specific settings (telemetry via optional adapter)
 *
 * Note: Awareness monitor runs continuously and is NOT stopped/started on mode switch
 */

const vscode = require('vscode');
const fsPromises = require('fs').promises;
const path = require('path');
const modeSettingsAdapter = require('../infrastructure/adapters/modeSettingsAdapter');
const modeDetection = require('./modeDetection');
const ruleAssembler = require('./ruleAssembler');

function getShowErrorMessage(vscodeAdapter) {
    if (vscodeAdapter && typeof vscodeAdapter.showErrorMessage === 'function') {
        return vscodeAdapter.showErrorMessage.bind(vscodeAdapter);
    }
    return vscode.window.showErrorMessage;
}

/**
 * Switches to the specified mode
 * @param {string} mode - 'vibe' or 'dev'
 * @param {Object} options - Callback options
 * @param {string} options.currentMode - Current mode before switch
 * @param {Function} options.onModeSwitched - Callback when mode is switched (receives new mode)
 * @param {Object} options.usageStats - Usage statistics manager instance
 * @param {Object} options.vscodeAdapter - VS Code adapter (Ports and Adapters pattern) - optional for backward compatibility
 * @param {Object} [options.telemetryAdapter] - Optional { log(event) } for telemetry; no-op if omitted
 * @returns {Promise<object|undefined>} On success: { mode, rulesWritten: true, settingsApplied: true, rolledBack: false }. Undefined on early exit or error.
 */
async function switchToMode(mode, options = {}) {
    const {
        currentMode,
        onModeSwitched,
        usageStats,
        vscodeAdapter = null,
        telemetryAdapter = null
    } = options;

    // Validate mode input
    if (mode !== 'vibe' && mode !== 'dev') {
        console.error(`VibeSwitch: Invalid mode: ${mode}`);
        return undefined;
    }

    // Ensure workspace exists - use adapter if available, fallback to direct vscode
    const workspaceFolders = vscodeAdapter ? vscodeAdapter.workspaceFolders : vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        const showError = getShowErrorMessage(vscodeAdapter);
        showError('No workspace folder found. Please open a folder first.');
        return undefined;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cursorDir = path.join(workspaceRoot, '.cursor');
    const rulesFile = path.join(cursorDir, 'rules.md');
    const rulesTmp = path.join(cursorDir, 'rules.md.tmp');
    const rulesBak = path.join(cursorDir, 'rules.md.bak');

    try {
        // Track mode switch in usage statistics
        if (usageStats && currentMode !== mode) {
            usageStats.trackModeSwitch(currentMode, mode);
        }

        // Create .cursor directory if it doesn't exist
        try {
            await fsPromises.access(cursorDir);
        } catch {
            await fsPromises.mkdir(cursorDir, { recursive: true });
        }

        const effectiveRules = await ruleAssembler.assembleRules({ cursorDir, mode });

        // Optional backup of current rules for rollback if settings fail
        let previousContent = null;
        try {
            previousContent = await fsPromises.readFile(rulesFile, 'utf8');
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        if (previousContent) {
            await fsPromises.writeFile(rulesBak, previousContent, 'utf8');
        }

        await fsPromises.writeFile(rulesTmp, effectiveRules, 'utf8');

        // Windows-safe replace: rename can fail with EEXIST/EPERM if target exists
        try {
            await fsPromises.rename(rulesTmp, rulesFile);
        } catch (renameErr) {
            if (renameErr.code === 'EEXIST' || renameErr.code === 'EPERM') {
                await fsPromises.unlink(rulesFile);
                await fsPromises.rename(rulesTmp, rulesFile);
            } else {
                throw renameErr;
            }
        }

        const stat = await fsPromises.stat(rulesFile);
        if (stat.size <= 0) {
            if (previousContent) {
                await fsPromises.writeFile(rulesFile, previousContent, 'utf8');
            } else {
                await fsPromises.unlink(rulesFile).catch(() => {});
            }
            modeDetection.invalidateCache();
            throw new Error('Failed to write .cursor/rules.md (zero-size file)');
        }

        modeDetection.invalidateCache();
        console.log(`VibeSwitch: Switched .cursor/rules.md to ${mode} mode (verified)`);

        try {
            if (telemetryAdapter && typeof telemetryAdapter.log === 'function') {
                telemetryAdapter.log({ location: 'modeService:beforeApplySettings', message: 'About to apply mode settings', data: { mode, skipCursorSettings: false }, timestamp: Date.now() });
            }
        } catch (_) { /* telemetry must not break mode switch */ }

        try {
            await modeSettingsAdapter.applyModeSettings(mode, false);
        } catch (settingsError) {
            if (previousContent) {
                await fsPromises.writeFile(rulesFile, previousContent, 'utf8');
                modeDetection.invalidateCache();
            }
            throw settingsError;
        }

        try {
            if (telemetryAdapter && typeof telemetryAdapter.log === 'function') {
                telemetryAdapter.log({ location: 'modeService:afterApplySettings', message: 'Mode settings applied', data: { mode }, timestamp: Date.now() });
            }
        } catch (_) { /* telemetry must not break mode switch */ }

        await fsPromises.unlink(rulesBak).catch(() => {});

        if (onModeSwitched) {
            onModeSwitched(mode);
        }

        console.log(`VibeSwitch: Successfully switched to ${mode.toUpperCase()} mode`);
        return { mode, rulesWritten: true, settingsApplied: true, rolledBack: false };
    } catch (error) {
        console.error(`VibeSwitch: Error switching to ${mode} mode:`, error);
        const showError = getShowErrorMessage(vscodeAdapter);
        showError(`Failed to switch to ${mode.toUpperCase()} mode: ${error.message}`);
    } finally {
        await fsPromises.unlink(rulesTmp).catch(() => {});
    }
}

module.exports = switchToMode;



