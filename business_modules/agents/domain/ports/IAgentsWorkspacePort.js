/**
 * Port: Workspace and git operations for agent job context.
 * Implemented by infrastructure/adapters/agentsGitWorkspaceAdapter.js.
 *
 * @interface
 * @typedef {Object} WorkspaceInfo
 * @property {string} workspaceRoot
 * @property {string} repoId
 * @property {string} branch
 * @property {string} commit
 * @property {string} [headRev] - HEAD rev when commit is 'working-tree'
 *
 * @typedef {Object} ChangedFile
 * @property {string} path
 * @property {string} patch
 * @property {string} language
 * @property {number} size
 *
 * @typedef {Object} IAgentsWorkspacePort
 * @property {function(string|null): Promise<WorkspaceInfo|null>} getWorkspaceInfo - root optional; when null, adapter resolves (e.g. first workspace folder)
 * @property {function(string): Promise<ChangedFile[]>} getChangedFiles
 * @property {function(string): Promise<Object>} getMetadata - e.g. { packageJson?: Object }
 */

module.exports = {};
