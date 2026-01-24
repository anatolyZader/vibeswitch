/**
 * WorkspaceAllowlist - Manages list of trusted workspace roots
 * 
 * Stores realpath'd workspace roots for MCP server to validate against.
 * Used to prevent workspaceRoot injection attacks.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const VIBESWITCH_DIR = path.join(os.homedir(), '.vibeswitch');
const STATE_DIR = path.join(VIBESWITCH_DIR, 'state');
const WORKSPACES_FILE = path.join(STATE_DIR, 'workspaces.json');

class WorkspaceAllowlist {
    constructor() {
        this._ensureDirectories();
    }

    _ensureDirectories() {
        try {
            if (!fs.existsSync(STATE_DIR)) {
                fs.mkdirSync(STATE_DIR, { recursive: true });
            }
        } catch (error) {
            console.error('WorkspaceAllowlist: Failed to create state directory:', error.message);
        }
    }

    /**
     * Get real (resolved) path
     */
    _realpath(p) {
        try {
            return fs.realpathSync(p);
        } catch {
            return p;
        }
    }

    /**
     * Load current allowlist
     * @returns {string[]} Array of realpath'd workspace roots
     */
    load() {
        try {
            if (fs.existsSync(WORKSPACES_FILE)) {
                const content = fs.readFileSync(WORKSPACES_FILE, 'utf8');
                const data = JSON.parse(content);
                return Array.isArray(data.workspaces) ? data.workspaces : [];
            }
        } catch (error) {
            console.error('WorkspaceAllowlist: Failed to load:', error.message);
        }
        return [];
    }

    /**
     * Save allowlist
     * @param {string[]} workspaces - Array of realpath'd workspace roots
     */
    save(workspaces) {
        try {
            const content = JSON.stringify({
                workspaces: workspaces,
                updatedAt: new Date().toISOString()
            }, null, 2);
            
            // Atomic write
            const tempFile = WORKSPACES_FILE + '.tmp';
            fs.writeFileSync(tempFile, content, 'utf8');
            fs.renameSync(tempFile, WORKSPACES_FILE);
        } catch (error) {
            console.error('WorkspaceAllowlist: Failed to save:', error.message);
        }
    }

    /**
     * Add a workspace to the allowlist (if not already present)
     * @param {string} workspaceRoot - Workspace root path
     * @returns {boolean} True if added, false if already present
     */
    add(workspaceRoot) {
        const resolved = this._realpath(workspaceRoot);
        const workspaces = this.load();
        
        if (!workspaces.includes(resolved)) {
            workspaces.push(resolved);
            this.save(workspaces);
            console.log('WorkspaceAllowlist: Added', resolved);
            return true;
        }
        return false;
    }

    /**
     * Remove a workspace from the allowlist
     * @param {string} workspaceRoot - Workspace root path
     * @returns {boolean} True if removed
     */
    remove(workspaceRoot) {
        const resolved = this._realpath(workspaceRoot);
        const workspaces = this.load();
        const index = workspaces.indexOf(resolved);
        
        if (index !== -1) {
            workspaces.splice(index, 1);
            this.save(workspaces);
            console.log('WorkspaceAllowlist: Removed', resolved);
            return true;
        }
        return false;
    }

    /**
     * Check if a workspace is in the allowlist
     * @param {string} workspaceRoot - Workspace root path
     * @returns {boolean}
     */
    contains(workspaceRoot) {
        const resolved = this._realpath(workspaceRoot);
        const workspaces = this.load();
        return workspaces.includes(resolved);
    }

    /**
     * Sync all open workspaces to the allowlist
     * Call this on extension activation
     * @param {vscode.WorkspaceFolder[]} workspaceFolders
     */
    syncFromWorkspace(workspaceFolders) {
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        const currentWorkspaces = this.load();
        let changed = false;

        for (const folder of workspaceFolders) {
            const resolved = this._realpath(folder.uri.fsPath);
            if (!currentWorkspaces.includes(resolved)) {
                currentWorkspaces.push(resolved);
                changed = true;
            }
        }

        if (changed) {
            this.save(currentWorkspaces);
        }
    }
}

module.exports = WorkspaceAllowlist;
