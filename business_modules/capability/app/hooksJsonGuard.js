/**
 * HooksJsonGuard - Watches and protects .cursor/hooks.json from tampering
 * 
 * On tamper:
 * 1. Atomically restore expected content
 * 2. Flip to DEV mode
 * 3. Audit the event (with sha256 of tampered content)
 * 4. Alert user
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const VIBESWITCH_DIR = path.join(os.homedir(), '.vibeswitch');
const STATE_DIR = path.join(VIBESWITCH_DIR, 'state');
const HOOKS_DIR = path.join(VIBESWITCH_DIR, 'hooks');
const AUDIT_LOG = path.join(STATE_DIR, 'audit.log');

const DEBOUNCE_MS = 300;

class HooksJsonGuard {
    /**
     * @param {vscode.ExtensionContext} context - VS Code extension context
     * @param {ModeManager} modeManager - ModeManager instance
     */
    constructor(context, modeManager) {
        if (!context) {
            throw new Error('HooksJsonGuard: context is required');
        }
        this._context = context;
        this._modeManager = modeManager;
        this._watcher = null;
        this._isRestoring = false;
        this._debounceTimer = null;
        this._workspaceRoot = null;
        this._hooksJsonPath = null;
        this._expectedContent = null;
    }

    /**
     * Generate expected hooks.json content
     */
    _generateExpectedContent() {
        return JSON.stringify({
            version: 1,
            hooks: {
                beforeSubmitPrompt: [
                    { command: path.join(HOOKS_DIR, 'inject-context.sh'), timeout: 3 }
                ],
                beforeShellExecution: [
                    { command: path.join(HOOKS_DIR, 'gate-shell.sh'), timeout: 5 }
                ],
                beforeMCPExecution: [
                    { command: path.join(HOOKS_DIR, 'gate-mcp.sh'), timeout: 5 }
                ],
                afterFileEdit: [
                    { command: path.join(HOOKS_DIR, 'detect-edit.sh'), timeout: 3 }
                ]
            }
        }, null, 2) + '\n';
    }

    /**
     * Atomically restore hooks.json to expected content
     */
    _atomicRestore() {
        if (!this._hooksJsonPath) return;

        const tempFile = this._hooksJsonPath + '.tmp';
        try {
            fs.writeFileSync(tempFile, this._expectedContent, 'utf8');
            fs.renameSync(tempFile, this._hooksJsonPath);
        } catch (error) {
            console.error('HooksJsonGuard: Failed to restore hooks.json:', error.message);
            // Try direct write as fallback
            try {
                fs.writeFileSync(this._hooksJsonPath, this._expectedContent, 'utf8');
            } catch (fallbackError) {
                console.error('HooksJsonGuard: Fallback restore also failed:', fallbackError.message);
            }
        }
    }

    /**
     * Audit tamper event
     */
    _audit(tamperedContent) {
        try {
            const hash = crypto.createHash('sha256').update(tamperedContent || '').digest('hex').slice(0, 16);
            const entry = JSON.stringify({
                ts: new Date().toISOString(),
                action: 'HOOKS_JSON_TAMPER',
                sha256: hash
            }) + '\n';
            fs.appendFileSync(AUDIT_LOG, entry, 'utf8');
        } catch (error) {
            console.error('HooksJsonGuard: Failed to audit:', error.message);
        }
    }

    /**
     * Handle tamper event (debounced)
     */
    async _handleTamper() {
        if (this._isRestoring) return;
        
        this._isRestoring = true;
        try {
            // Read tampered content for audit
            let tamperedContent = '';
            try {
                if (fs.existsSync(this._hooksJsonPath)) {
                    tamperedContent = fs.readFileSync(this._hooksJsonPath, 'utf8');
                }
            } catch (e) {
                // Ignore read errors
            }

            // Check if actually tampered (content differs)
            if (tamperedContent === this._expectedContent) {
                return; // Not actually tampered, skip
            }

            console.log('HooksJsonGuard: Tamper detected, restoring and flipping to DEV');

            // 1. Atomic restore
            this._atomicRestore();

            // 2. Flip to DEV mode
            if (this._modeManager) {
                await this._modeManager.setMode('dev');
            }

            // 3. Audit
            this._audit(tamperedContent);

            // 4. Alert user
            vscode.window.showWarningMessage(
                'VibeSwitch: hooks.json was modified! Restored and switched to DEV mode for safety.',
                'View Audit Log'
            ).then(selection => {
                if (selection === 'View Audit Log') {
                    const doc = vscode.Uri.file(AUDIT_LOG);
                    vscode.workspace.openTextDocument(doc).then(d => vscode.window.showTextDocument(d));
                }
            });
        } finally {
            this._isRestoring = false;
        }
    }

    /**
     * Start watching hooks.json
     * @param {string} workspaceRoot - Workspace root path
     */
    start(workspaceRoot) {
        if (!workspaceRoot) {
            console.error('HooksJsonGuard: workspaceRoot is required');
            return;
        }

        this._workspaceRoot = workspaceRoot;
        this._hooksJsonPath = path.join(workspaceRoot, '.cursor', 'hooks.json');
        this._expectedContent = this._generateExpectedContent();

        // Ensure hooks.json exists with expected content
        const cursorDir = path.join(workspaceRoot, '.cursor');
        if (!fs.existsSync(cursorDir)) {
            fs.mkdirSync(cursorDir, { recursive: true });
        }
        if (!fs.existsSync(this._hooksJsonPath) || 
            fs.readFileSync(this._hooksJsonPath, 'utf8') !== this._expectedContent) {
            this._atomicRestore();
        }

        // Watch for changes using VS Code's reliable file watcher
        const pattern = new vscode.RelativePattern(workspaceRoot, '.cursor/hooks.json');
        this._watcher = vscode.workspace.createFileSystemWatcher(pattern);

        // Debounced handler
        const debouncedHandle = () => {
            if (this._debounceTimer) {
                clearTimeout(this._debounceTimer);
            }
            this._debounceTimer = setTimeout(() => {
                this._handleTamper();
            }, DEBOUNCE_MS);
        };

        this._watcher.onDidChange(debouncedHandle);
        this._watcher.onDidCreate(debouncedHandle);
        this._watcher.onDidDelete(() => {
            // File deleted - restore it
            console.log('HooksJsonGuard: hooks.json deleted, restoring');
            this._atomicRestore();
        });

        // Register for cleanup
        this._context.subscriptions.push(this._watcher);

        console.log('HooksJsonGuard: Started watching', this._hooksJsonPath);
    }

    /**
     * Stop watching and cleanup
     */
    dispose() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        if (this._watcher) {
            this._watcher.dispose();
            this._watcher = null;
        }
    }
}

module.exports = HooksJsonGuard;
