/**
 * Awareness Monitor Utilities
 * Shared constants and utility functions used across awareness monitor modules
 */

const vscode = require('vscode');
const path = require('path');

// Constants for file filtering
const NON_CODE_SCHEMES = ['output', 'vscode', 'vscode-notebook', 'debug'];
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj', '.sh', '.bash', '.zsh', '.fish'];

/**
 * Check if a document scheme should be skipped (non-code documents)
 * @param {string} scheme - The URI scheme to check
 * @returns {boolean} True if the scheme should be skipped
 */
function isNonCodeDocument(scheme) {
    return NON_CODE_SCHEMES.includes(scheme);
}

/**
 * Get relative path from workspace folder
 * @param {string} filePath - Absolute file path
 * @returns {string} Relative path or basename if not in workspace
 */
function getRelativePath(filePath) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return path.basename(filePath);
    }
    
    // Try each workspace folder
    for (const folder of workspaceFolders) {
        const folderPath = folder.uri.fsPath;
        if (filePath.startsWith(folderPath)) {
            const relative = path.relative(folderPath, filePath);
            return relative || path.basename(filePath);
        }
    }
    
    // Fallback to basename if not in workspace
    return path.basename(filePath);
}

/**
 * Check if a position is within a range
 * @param {vscode.Position} position - The position to check
 * @param {vscode.Range} range - The range to check against
 * @returns {boolean} True if position is within range
 */
function isPositionInRange(position, range) {
    if (position.line < range.start.line || position.line > range.end.line) {
        return false;
    }
    if (position.line === range.start.line && position.character < range.start.character) {
        return false;
    }
    if (position.line === range.end.line && position.character > range.end.character) {
        return false;
    }
    return true;
}

/**
 * Check if two ranges overlap
 * @param {vscode.Range} range1 - First range
 * @param {vscode.Range} range2 - Second range
 * @returns {boolean} True if ranges overlap
 */
function rangesOverlap(range1, range2) {
    // Check if ranges are on same lines or overlapping lines
    return !(range1.end.line < range2.start.line || range1.start.line > range2.end.line);
}

module.exports = {
    NON_CODE_SCHEMES,
    CODE_EXTENSIONS,
    isNonCodeDocument,
    getRelativePath,
    isPositionInRange,
    rangesOverlap
};


