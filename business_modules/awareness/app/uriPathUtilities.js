/**
 * UriPathUtilities - Application layer utilities for URI and path operations
 * 
 * Contains technical utilities for URI/path normalization and extraction.
 * These are technical/infrastructure operations - not domain business logic.
 */

const path = require('path');

class UriPathUtilities {
    /**
     * Normalize file path or URI to canonical URI string
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {string|Uri} filePathOrUri - File path or URI
     * @returns {string} Canonical URI string
     */
    static normalizeToUri(vscodePort, filePathOrUri) {
        if (!filePathOrUri) return null;
        
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
                const Uri = vscodePort.Uri;
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
     * Get relative path from workspace
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {string} filePath - Absolute file path
     * @returns {string} Relative path or basename
     */
    static getRelativePath(vscodePort, filePath) {
        if (!filePath) return '';
        
        const workspaceFolders = vscodePort.workspaceFolders || [];
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
     * Extract filename from URI
     * @param {string} uri - URI string
     * @returns {string} Filename
     */
    static extractFileName(uri) {
        if (!uri) return '';
        
        // Handle URI string
        let pathPart = uri;
        if (uri.includes('://')) {
            try {
                const url = new URL(uri);
                pathPart = url.pathname;
            } catch (e) {
                // Fallback: extract path manually
                const match = uri.match(/:\/\/[^\/]+(.*)/);
                if (match) {
                    pathPart = match[1].split('?')[0].split('#')[0];
                }
            }
        } else {
            pathPart = uri.split('?')[0].split('#')[0];
        }
        
        return path.basename(pathPart);
    }

    /**
     * Extract file extension from URI
     * @param {string} uri - URI string
     * @returns {string} File extension (with dot)
     */
    static extractFileExtension(uri) {
        if (!uri) return '';
        
        const fileName = this.extractFileName(uri);
        return path.extname(fileName);
    }
}

module.exports = UriPathUtilities;
