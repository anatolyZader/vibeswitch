/**
 * UriPathOperationServiceD - Domain service for URI and path validation
 * 
 * Encapsulates core domain business rules for URI/path validation.
 * Technical utilities (normalization, extraction) are in app layer.
 */

const path = require('path');

// Constants for file filtering (domain business rules)
const NON_CODE_SCHEMES = ['output', 'vscode', 'vscode-notebook', 'debug', 'vscode-userdata', 'git'];
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj', '.sh', '.bash', '.zsh', '.fish'].map(ext => ext.toLowerCase());

class UriPathOperationServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Check if document is a code document (domain business rule)
     * @param {TextDocument} document - Document to check
     * @returns {boolean} True if code document
     */
    isCodeDocument(document) {
        if (!document) return false;
        
        const scheme = document.uri?.scheme || '';
        
        // Scheme blacklist (always skip these)
        if (NON_CODE_SCHEMES.includes(scheme)) {
            return false;
        }
        
        // Filter by file extension (only process code files)
        const p = (document.uri?.path || document.fileName || '');
        const clean = p.split('?')[0].split('#')[0]; // Strip query and fragment
        const ext = path.extname(clean).toLowerCase();
        
        // If we have an extension and it's not in the code extensions list, skip it
        if (ext && !CODE_EXTENSIONS.includes(ext)) {
            return false;
        }
        
        // Handle untitled documents (user-controlled)
        // untitled can be code, so we don't skip it by default if no extension
        
        return true;
    }

    /**
     * Check if URI should be skipped (domain business rule)
     * @param {Uri|string} uri - URI to check
     * @returns {boolean} True if should skip
     */
    isSkippableUri(uri) {
        if (!uri) return true;
        
        let scheme;
        if (typeof uri === 'string') {
            // Extract scheme from URI string
            const match = uri.match(/^([^:]+):/);
            scheme = match ? match[1] : '';
        } else {
            scheme = uri.scheme || '';
        }
        
        return NON_CODE_SCHEMES.includes(scheme);
    }

    /**
     * Check if URI is a code file we should track for awareness (for file watcher).
     * Used when a new file appears on disk (e.g. agent Write tool) so we add it as unreviewed.
     * @param {Uri|string} uri - URI to check
     * @returns {boolean} True if we should process as new code file
     */
    isCodeUri(uri) {
        if (!uri) return false;
        if (this.isSkippableUri(uri)) return false;
        const pathStr = typeof uri === 'string' ? uri : (uri.path || uri.fsPath || '');
        const normalized = pathStr.split('?')[0].split('#')[0];
        if (/node_modules[/\\]/.test(normalized) || /\.git[/\\]/.test(normalized)) return false;
        const ext = path.extname(normalized).toLowerCase();
        if (!ext) return false;
        return CODE_EXTENSIONS.includes(ext);
    }
}

module.exports = UriPathOperationServiceD;
