/**
 * Resolve git remote origin URL for a workspace root.
 * Used by repoId.getRepoIdAsync to derive stable repo id (Contract B).
 */

const { exec } = require('child_process');
const path = require('path');

/**
 * Get git remote origin URL for the given workspace root path.
 * @param {string} workspaceRootPath - Absolute path to repo root
 * @returns {Promise<string|null>} Remote URL or null if not a git repo / no origin
 */
function getGitRemoteUrl(workspaceRootPath) {
    return new Promise((resolve) => {
        if (!workspaceRootPath || typeof workspaceRootPath !== 'string') {
            resolve(null);
            return;
        }
        const cwd = path.normalize(workspaceRootPath);
        exec('git config --get remote.origin.url', { cwd, maxBuffer: 4096 }, (err, stdout) => {
            if (err || !stdout || typeof stdout !== 'string') {
                resolve(null);
                return;
            }
            const url = stdout.trim();
            resolve(url || null);
        });
    });
}

module.exports = {
    getGitRemoteUrl
};
