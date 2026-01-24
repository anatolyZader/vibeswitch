/**
 * AlertFileEditDetector - Monitors for unapproved file edits in DEV mode
 * 
 * Watches $HOME/.vibeswitch/state/alert.json for changes written by detect-edit.sh
 * When an alert is detected in DEV mode, shows a modal warning.
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VIBESWITCH_DIR = path.join(os.homedir(), '.vibeswitch');
const STATE_DIR = path.join(VIBESWITCH_DIR, 'state');
const ALERT_FILE = path.join(STATE_DIR, 'alert.json');

class AlertFileEditDetector {
    /**
     * @param {ModeManager} modeManager - ModeManager instance
     */
    constructor(modeManager) {
        this._modeManager = modeManager;
        this._watcher = null;
        this._lastAlertTs = null;
        this._statusBarItem = null;
        this._alertCount = 0;
    }

    /**
     * Create status bar badge for unapproved edits
     * @param {vscode.ExtensionContext} context
     */
    createBadge(context) {
        this._statusBarItem = vscode.window.createStatusBarItem(
            'vibeswitch.unapprovedEdits',
            vscode.StatusBarAlignment.Right,
            998  // Just after awareness meter
        );
        this._statusBarItem.name = 'VibeSwitch Unapproved Edits';
        this._statusBarItem.command = 'vibeswitch.showAlertLog';
        this._updateBadge();
        context.subscriptions.push(this._statusBarItem);
    }

    _updateBadge() {
        if (!this._statusBarItem) return;
        
        if (this._alertCount > 0 && this._modeManager.getMode() === 'dev') {
            this._statusBarItem.text = `$(alert) ${this._alertCount}`;
            this._statusBarItem.tooltip = `${this._alertCount} unapproved edit(s) detected`;
            this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this._statusBarItem.show();
        } else {
            this._statusBarItem.hide();
        }
    }

    /**
     * Handle alert file change
     */
    async _onAlertChange() {
        try {
            if (!fs.existsSync(ALERT_FILE)) return;

            const content = fs.readFileSync(ALERT_FILE, 'utf8');
            const alert = JSON.parse(content);

            // Skip if we've already processed this alert
            if (alert.ts === this._lastAlertTs) return;
            this._lastAlertTs = alert.ts;

            // Only alert in DEV mode
            if (this._modeManager.getMode() !== 'dev') return;

            this._alertCount++;
            this._updateBadge();

            // Show modal warning
            const file = alert.file || 'unknown file';
            const selection = await vscode.window.showWarningMessage(
                `Unapproved edit detected in DEV mode: ${path.basename(file)}`,
                { modal: false },
                'View File',
                'View Git Diff',
                'Dismiss'
            );

            if (selection === 'View File' && file !== 'UNKNOWN') {
                const doc = await vscode.workspace.openTextDocument(file);
                await vscode.window.showTextDocument(doc);
            } else if (selection === 'View Git Diff') {
                // Open git diff view
                vscode.commands.executeCommand('git.openChange', vscode.Uri.file(file));
            }
        } catch (error) {
            console.error('AlertFileEditDetector: Error processing alert:', error.message);
        }
    }

    /**
     * Start watching for alerts
     */
    start() {
        // Ensure state directory exists
        if (!fs.existsSync(STATE_DIR)) {
            fs.mkdirSync(STATE_DIR, { recursive: true });
        }

        // Use chokidar if available, fallback to fs.watch
        try {
            const chokidar = require('chokidar');
            this._watcher = chokidar.watch(ALERT_FILE, {
                persistent: true,
                ignoreInitial: true
            });
            this._watcher.on('change', () => this._onAlertChange());
            this._watcher.on('add', () => this._onAlertChange());
            console.log('AlertFileEditDetector: Using chokidar watcher');
        } catch {
            // Fallback to fs.watch (less reliable on some platforms)
            console.log('AlertFileEditDetector: Chokidar not available, using fs.watch');
            if (fs.existsSync(ALERT_FILE)) {
                this._watcher = fs.watch(ALERT_FILE, () => this._onAlertChange());
            } else {
                // Watch directory for file creation
                this._watcher = fs.watch(STATE_DIR, (eventType, filename) => {
                    if (filename === 'alert.json') {
                        this._onAlertChange();
                    }
                });
            }
        }

        console.log('AlertFileEditDetector: Started watching', ALERT_FILE);
    }

    /**
     * Clear alert count
     */
    clearAlerts() {
        this._alertCount = 0;
        this._updateBadge();
    }

    /**
     * Cleanup
     */
    dispose() {
        if (this._watcher) {
            if (typeof this._watcher.close === 'function') {
                this._watcher.close();
            } else if (typeof this._watcher.unref === 'function') {
                this._watcher.unref();
            }
            this._watcher = null;
        }
        if (this._statusBarItem) {
            this._statusBarItem.dispose();
            this._statusBarItem = null;
        }
    }
}

module.exports = AlertFileEditDetector;
