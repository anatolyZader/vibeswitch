/**
 * repoId - Stable repository identifier (Contract B)
 *
 * Used for candidate feedback and repo-scoped persistence. Must be stable so
 * feedback does not break when workspace path changes.
 *
 * Prefer: hash(git remote URL + workspace root path)
 * Fallback: hash(workspace folder path) if no git.
 *
 * All consumers (candidateFeedbackStore, event store) use this derivation.
 */

const path = require('path');

const HASH_ALGORITHM = 'sha256';
const ENCODING = 'utf8';

/**
 * Derive a stable repo id from workspace path and optional git remote.
 * Pure function: no I/O.
 *
 * @param {string} workspaceRootPath - Absolute path to workspace root (e.g. from workspaceFolders[0].uri.fsPath)
 * @param {string|null|undefined} gitRemoteUrl - Git remote URL (e.g. from `git config --get remote.origin.url`) or null if no git
 * @param {Object} hashGenerator - Port with createHash(algorithm, data) returning hex string
 * @returns {string} Stable hex hash (repoId)
 */
function deriveRepoId(workspaceRootPath, gitRemoteUrl, hashGenerator) {
    if (!workspaceRootPath || typeof workspaceRootPath !== 'string') {
        throw new Error('repoId: workspaceRootPath is required');
    }
    if (!hashGenerator || typeof hashGenerator.createHash !== 'function') {
        throw new Error('repoId: hashGenerator with createHash is required');
    }

    const normalizedRoot = path.normalize(workspaceRootPath).replace(/\\/g, '/');
    const input = gitRemoteUrl && typeof gitRemoteUrl === 'string' && gitRemoteUrl.trim()
        ? gitRemoteUrl.trim() + '\n' + normalizedRoot
        : normalizedRoot;

    return hashGenerator.createHash(HASH_ALGORITHM, Buffer.from(input, ENCODING));
}

/**
 * Get repo id asynchronously when git remote must be resolved (e.g. from extension).
 * Calls getGitRemoteUrl() then deriveRepoId. Use this from adapters/engine.
 *
 * @param {string} workspaceRootPath - Absolute path to workspace root
 * @param {function(string): Promise<string|null>} getGitRemoteUrl - Async function (rootPath) => remoteUrl or null
 * @param {Object} hashGenerator - Port with createHash(algorithm, data)
 * @returns {Promise<string>} Stable repoId
 */
async function getRepoIdAsync(workspaceRootPath, getGitRemoteUrl, hashGenerator) {
    const gitRemoteUrl = await getGitRemoteUrl(workspaceRootPath).catch(() => null);
    return deriveRepoId(workspaceRootPath, gitRemoteUrl || null, hashGenerator);
}

module.exports = {
    deriveRepoId,
    getRepoIdAsync
};
