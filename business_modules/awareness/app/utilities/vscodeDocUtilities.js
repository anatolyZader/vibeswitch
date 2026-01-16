/**
 * VSCodeDocUtilities - Application layer utilities for VS Code document operations
 * 
 * Contains technical utilities for VS Code document/URI operations.
 * These are technical/infrastructure operations - not domain business logic.
 * 
 * Moved from domain/utils/utils.js to fix hex boundary violations.
 */

const vscode = require('vscode');
const path = require('path');

// Constants for file filtering
const NON_CODE_SCHEMES = ['output', 'vscode', 'vscode-notebook', 'debug', 'vscode-userdata', 'git'];
// Fix: Store extensions in lowercase for consistent comparison
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj', '.sh', '.bash', '.zsh', '.fish'].map(ext => ext.toLowerCase());

/**
 * Check if a document should be skipped (non-code documents)
 * @param {vscode.TextDocument} document - The document to check
 * @returns {boolean} True if the document should be skipped
 */
function isNonCodeDocument(document) {
    if (!document) return true;
    
    const scheme = document.uri.scheme;
    
    // Scheme blacklist (always skip these)
    if (NON_CODE_SCHEMES.includes(scheme)) {
        return true;
    }
    
    // Fix: Filter by file extension (only process code files)
    // Fix: Handle remote/virtual docs properly - prefer uri.path, strip query/fragment
    const p = (document.uri?.path || document.fileName || '');
    const clean = p.split('?')[0].split('#')[0]; // Strip query and fragment
    const ext = path.extname(clean).toLowerCase();
    
    // If we have an extension and it's not in the code extensions list, skip it
    if (ext && !CODE_EXTENSIONS.includes(ext)) {
        return true;
    }
    
    // Handle untitled documents (user-controlled)
    // untitled can be code, so we don't skip it by default if no extension
    
    return false;
}

/**
 * Check if a URI scheme should be skipped (for cases where we only have URI, not document)
 * @param {vscode.Uri|string} uriOrScheme - URI or scheme string
 * @returns {boolean} True if the URI should be skipped
 */
function isSkippableUri(uriOrScheme) {
    let scheme;
    if (typeof uriOrScheme === 'string') {
        scheme = uriOrScheme;
    } else {
        scheme = uriOrScheme.scheme;
    }
    
    return NON_CODE_SCHEMES.includes(scheme);
}

/**
 * Normalize file path or URI to canonical URI string
 * FIXED: Use URI as canonical identifier for remote workspace compatibility
 * @param {IAwarenessVSCodePort} [vscodePort] - Optional VS Code port for URI creation
 * @param {string|vscode.Uri} filePathOrUri - File path (fsPath) or URI
 * @returns {string} Canonical URI string
 */
function normalizeToUri(vscodePort, filePathOrUri) {
    if (!filePathOrUri) return null;
    
    // Handle optional first parameter (backward compatibility)
    if (typeof vscodePort === 'string' || (vscodePort && typeof vscodePort === 'object' && vscodePort.toString)) {
        // First param is actually filePathOrUri (old signature)
        filePathOrUri = vscodePort;
        vscodePort = null;
    }
    
    // If already a URI string (starts with scheme), return as-is
    if (typeof filePathOrUri === 'string' && filePathOrUri.includes('://')) {
        return filePathOrUri;
    }
    
    // If it's a vscode.Uri object, convert to string
    if (filePathOrUri && typeof filePathOrUri === 'object' && filePathOrUri.toString) {
        return filePathOrUri.toString();
    }
    
    // If it's a file path (fsPath), convert to file:// URI
    if (typeof filePathOrUri === 'string') {
        try {
            const Uri = vscodePort?.Uri || vscode.Uri;
            if (Uri && Uri.file) {
                const uri = Uri.file(filePathOrUri);
                return uri.toString();
            }
            // Fallback if Uri not available
            return filePathOrUri;
        } catch (err) {
            // Fallback: treat as relative path or return as-is
            return filePathOrUri;
        }
    }
    
    return filePathOrUri;
}

/**
 * Get relative path from workspace folder
 * @param {IAwarenessVSCodePort} [vscodePort] - Optional VS Code port for workspace access
 * @param {string} filePath - Absolute file path
 * @returns {string} Relative path or basename if not in workspace
 */
function getRelativePath(vscodePort, filePath) {
    if (!filePath) return '';
    
    // Handle optional first parameter (backward compatibility)
    if (typeof vscodePort === 'string') {
        filePath = vscodePort;
        vscodePort = null;
    }
    
    const workspaceFolders = vscodePort?.workspaceFolders || vscode.workspace.workspaceFolders || [];
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return path.basename(filePath);
    }
    
    // Try each workspace folder
    for (const folder of workspaceFolders) {
        const folderPath = folder.uri.fsPath || folder.uri.path || '';
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
 * Fix: Use VS Code's built-in range intersection for accurate overlap detection
 * @param {vscode.Range} range1 - First range
 * @param {vscode.Range} range2 - Second range
 * @returns {boolean} True if ranges overlap
 */
function rangesOverlap(range1, range2) {
    // Fix: Use VS Code's built-in intersection method for accurate overlap detection
    // This properly handles character positions on the same line
    return range1.intersection(range2) !== undefined;
}

module.exports = {
    normalizeToUri,
    getRelativePath,
    rangesOverlap,
    isPositionInRange,
    isNonCodeDocument,
    isSkippableUri,
    NON_CODE_SCHEMES,
    CODE_EXTENSIONS
};


