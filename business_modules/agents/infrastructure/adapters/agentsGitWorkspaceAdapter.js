/**
 * Adapter: Git and workspace operations for the agents module.
 * Implements IAgentsWorkspacePort using child_process.execSync and optional VSCode for workspace root.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class AgentsGitWorkspaceAdapter {
    /**
     * @param {Object} opts
     * @param {function(): string|null} [opts.getWorkspaceRoot] - When workspace root is not passed, use this (e.g. first workspace folder)
     */
    constructor(opts = {}) {
        this._getWorkspaceRoot = opts.getWorkspaceRoot || (() => null);
    }

    async getWorkspaceInfo(workspaceRoot) {
        try {
            const root = workspaceRoot || this._getWorkspaceRoot();
            if (!root) return null;
            try {
                execSync('git rev-parse --git-dir', { cwd: root, stdio: 'pipe' });
            } catch {
                return null;
            }
            let repoId;
            try {
                const remoteUrl = execSync('git config --get remote.origin.url', { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
                repoId = remoteUrl || this._hashPath(root);
            } catch {
                repoId = this._hashPath(root);
            }
            const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
            let commit;
            let headRev;
            try {
                commit = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
                headRev = commit;
                const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
                if (status) commit = 'working-tree';
            } catch {
                commit = 'working-tree';
                headRev = undefined;
            }
            return { workspaceRoot: root, repoId, branch, commit, headRev: commit === 'working-tree' ? headRev : undefined };
        } catch (error) {
            return null;
        }
    }

    async getChangedFiles(workspaceRoot) {
        try {
            const statusOutput = execSync('git status --porcelain', { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
            if (!statusOutput) return [];
            const files = [];
            for (const line of statusOutput.split('\n')) {
                const status = line.substring(0, 2).trim();
                const filePath = line.substring(3).trim();
                if (status.includes('D')) continue;
                let patch = '';
                try {
                    if (status.includes('A') || status.includes('?')) {
                        const content = execSync(`git show :${filePath}`, { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
                        patch = this._createUnifiedDiff(filePath, '', content);
                    } else {
                        patch = execSync(`git diff HEAD -- "${filePath}"`, { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
                    }
                } catch {
                    patch = '';
                }
                const ext = path.extname(filePath).slice(1);
                files.push({ path: filePath, patch, language: ext, size: 0 });
            }
            return files;
        } catch {
            return [];
        }
    }

    _createUnifiedDiff(filePath, oldContent, newContent) {
        const newLines = newContent ? newContent.split('\n') : [];
        let diff = `--- a/${filePath}\n+++ b/${filePath}\n`;
        diff += `@@ -0,0 +1,${newLines.length} @@\n`;
        newLines.forEach(line => { diff += `+${line}\n`; });
        return diff;
    }

    async getMetadata(workspaceRoot) {
        const metadata = {};
        try {
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                metadata.packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            }
        } catch {}
        return metadata;
    }

    _hashPath(p) {
        return crypto.createHash('sha256').update(p).digest('hex').substring(0, 16);
    }
}

module.exports = AgentsGitWorkspaceAdapter;
