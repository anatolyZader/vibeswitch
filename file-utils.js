/**
 * File utilities and path validation
 */

const path = require('path');

/**
 * Validates that a path is within the workspace and doesn't contain dangerous patterns
 * @param {string} targetPath - Path to validate
 * @param {string} workspaceRoot - Workspace root path
 * @returns {boolean} True if path is safe
 */
function isPathSafe(targetPath, workspaceRoot) {
    const normalizedTarget = path.normalize(targetPath);
    const normalizedWorkspace = path.normalize(workspaceRoot);
    
    // Check for path traversal attempts
    if (normalizedTarget.includes('..')) {
        return false;
    }
    
    // Ensure path is within workspace
    if (!normalizedTarget.startsWith(normalizedWorkspace)) {
        return false;
    }
    
    return true;
}

module.exports = {
    isPathSafe
};

