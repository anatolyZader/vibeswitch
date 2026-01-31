/**
 * ApprovalManager - Handles the approval workflow for MCP patch requests
 * 
 * Watches $HOME/.vibeswitch/state/requests/ for new patch requests (written by MCP)
 * On approval:
 * 1. Signs a token with Ed25519 private key
 * 2. Writes approved token to $HOME/.vibeswitch/state/approved/<requestId>.token
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const VIBESWITCH_DIR = path.join(os.homedir(), '.vibeswitch');
const STATE_DIR = path.join(VIBESWITCH_DIR, 'state');
const REQUESTS_DIR = path.join(STATE_DIR, 'requests');
const APPROVED_DIR = path.join(STATE_DIR, 'approved');
const LIB_DIR = path.join(VIBESWITCH_DIR, 'lib');
const TOKEN_TTL_MS = 60 * 1000;

class ApprovalManager {
    constructor(context, keypairManager, modeManager) {
        if (!context) throw new Error('ApprovalManager: context is required');
        if (!keypairManager) throw new Error('ApprovalManager: keypairManager is required');
        if (!modeManager) throw new Error('ApprovalManager: modeManager is required');
        
        this._context = context;
        this._keypairManager = keypairManager;
        this._modeManager = modeManager;
        this._watcher = null;
        this._canonical = null;
        
        this._ensureDirectories();
        this._loadCanonical();
    }

    _ensureDirectories() {
        for (const dir of [REQUESTS_DIR, APPROVED_DIR]) {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        }
    }

    _loadCanonical() {
        try {
            const canonicalPath = path.join(LIB_DIR, 'canonical.js');
            if (fs.existsSync(canonicalPath)) {
                this._canonical = require(canonicalPath);
            }
        } catch (e) { console.error('ApprovalManager: Failed to load canonical:', e.message); }
    }

    _base64url(buffer) {
        return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    _generateToken(request) {
        if (!this._canonical) throw new Error('Canonical module not loaded');
        if (!this._keypairManager.isReady()) throw new Error('Keypair not initialized');

        const now = Date.now();
        const payload = {
            exp: String(now + TOKEN_TTL_MS),
            iat: String(now),
            nonce: crypto.randomBytes(16).toString('hex'),
            requestId: String(request.requestId),
            scope: { filePath: String(request.filePath), patchHash: String(request.patchHash) }
        };

        const canonicalPayload = this._canonical.toCanonicalJSON(payload);
        const signature = this._keypairManager.sign(canonicalPayload);
        return `${this._base64url(Buffer.from(canonicalPayload))}.${this._base64url(signature)}`;
    }

    async _showApprovalDialog(request) {
        const fileName = path.basename(request.filePath);
        const result = await vscode.window.showInformationMessage(
            `Approve patch for ${fileName}?`, { modal: true }, 'Approve', 'View Diff', 'Deny'
        );
        if (result === 'View Diff') {
            const oc = vscode.window.createOutputChannel('VibeSwitch Patch Preview', 'diff');
            oc.clear(); oc.appendLine(request.patch || ''); oc.show(true);
            const r2 = await vscode.window.showInformationMessage('Approve?', { modal: true }, 'Approve', 'Deny');
            return r2 === 'Approve';
        }
        return result === 'Approve';
    }

    async _processRequest(requestFile) {
        try {
            if (this._modeManager.getMode() !== 'dev') return;
            const request = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
            if (!request.requestId || !request.filePath || !request.patch) return;
            if (!request.patchHash) {
                request.patchHash = crypto.createHash('sha256').update(request.patch).digest('hex').slice(0,16);
            }
            if (await this._showApprovalDialog(request)) {
                const token = this._generateToken(request);
                const approvedFile = path.join(APPROVED_DIR, `${request.requestId}.token`);
                const tmp = approvedFile + '.tmp';
                fs.writeFileSync(tmp, token, 'utf8');
                fs.renameSync(tmp, approvedFile);
                vscode.window.showInformationMessage('Patch approved. Token valid for 60 seconds.');
            } else {
                vscode.window.showWarningMessage('Patch request denied.');
            }
            try { fs.unlinkSync(requestFile); } catch (e) {}
        } catch (e) { console.error('ApprovalManager:', e.message); }
    }

    start() {
        try {
            const chokidar = require('chokidar');
            this._watcher = chokidar.watch(REQUESTS_DIR, { persistent: true, ignoreInitial: false });
            this._watcher.on('add', (fp) => { if (fp.endsWith('.json')) this._processRequest(fp); });
        } catch (e) {
            const poll = setInterval(() => {
                try {
                    fs.readdirSync(REQUESTS_DIR).filter(f => f.endsWith('.json'))
                        .forEach(f => this._processRequest(path.join(REQUESTS_DIR, f)));
                } catch (e) {}
            }, 1000);
            this._watcher = { close: () => clearInterval(poll) };
        }
    }

    dispose() { if (this._watcher) { this._watcher.close(); this._watcher = null; } }
}

module.exports = ApprovalManager;
