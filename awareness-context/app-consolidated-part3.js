/**
 * APP LAYER - CONSOLIDATED (PART 3/3)
 * 
 * This file contains part 3 of 3 of the app layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 3/13
 * Generated: 2026-01-12T18:19:21.020Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 11/13: app/timerRegistry.js
// ============================================================================

(function() { // IIFE scope for app/timerRegistry.js
/**
 * TimerRegistry - Centralized timer management for awareness module
 * 
 * Provides a single point of control for all timers, ensuring they can be
 * properly cleaned up on service stop/dispose. This prevents "stuck state"
 * bugs where timers fire after the service has been stopped.
 */

class TimerRegistry {
    constructor() {
        // Track all active timers
        this.timeouts = new Set();
        this.intervals = new Set();
    }

    /**
     * Create a timeout that will be tracked and can be cleared
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {Object} Timer ID (Node.js Timeout object)
     */
    setTimeout(callback, delay) {
        const timer = setTimeout(() => {
            this.timeouts.delete(timer);
            callback();
        }, delay);
        this.timeouts.add(timer);
        return timer;
    }

    /**
     * Create an interval that will be tracked and can be cleared
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {Object} Timer ID (Node.js Timeout object)
     */
    setInterval(callback, delay) {
        const timer = setInterval(callback, delay);
        this.intervals.add(timer);
        return timer;
    }

    /**
     * Clear a specific timeout
     * @param {Object} timer - Timer ID to clear
     */
    clearTimeout(timer) {
        if (timer) {
            clearTimeout(timer);
            this.timeouts.delete(timer);
        }
    }

    /**
     * Clear a specific interval
     * @param {Object} timer - Timer ID to clear
     */
    clearInterval(timer) {
        if (timer) {
            clearInterval(timer);
            this.intervals.delete(timer);
        }
    }

    /**
     * Clear all timers (timeouts and intervals)
     * Should be called on service stop/dispose
     */
    clear() {
        // Clear all timeouts
        for (const timer of this.timeouts) {
            clearTimeout(timer);
        }
        this.timeouts.clear();

        // Clear all intervals
        for (const timer of this.intervals) {
            clearInterval(timer);
        }
        this.intervals.clear();
    }

    /**
     * Get count of active timers
     * @returns {Object} { timeouts: number, intervals: number }
     */
    getCount() {
        return {
            timeouts: this.timeouts.size,
            intervals: this.intervals.size
        };
    }
}

// module.exports = TimerRegistry; // Commented for consolidation

})(); // End IIFE for app/timerRegistry.js


// ============================================================================
// FILE 12/13: app/uriPathUtilities.js
// ============================================================================

(function() { // IIFE scope for app/uriPathUtilities.js
/**
 * UriPathUtilities - Application layer utilities for URI and path operations
 * 
 * Contains technical utilities for URI/path normalization and extraction.
 * These are technical/infrastructure operations - not domain business logic.
 */

// const path = require('path'); // Commented for consolidation

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

// module.exports = UriPathUtilities; // Commented for consolidation

})(); // End IIFE for app/uriPathUtilities.js


// ============================================================================
// FILE 13/13: app/vscodeUtilities.js
// ============================================================================

(function() { // IIFE scope for app/vscodeUtilities.js
/**
 * VSCodeUtilities - Application layer utilities for VS Code operations
 * 
 * Contains technical/infrastructure utilities for VS Code API operations.
 * These are thin wrappers around VS Code API - not domain logic.
 */

class VSCodeUtilities {
    /**
     * Subscribe to text document change events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToTextDocumentChanges(vscodePort, handler) {
        return vscodePort.onDidChangeTextDocument(handler);
    }

    /**
     * Subscribe to file creation events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToFileCreation(vscodePort, handler) {
        return vscodePort.onDidCreateFiles(handler);
    }

    /**
     * Subscribe to file save events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToFileSave(vscodePort, handler) {
        return vscodePort.onDidSaveTextDocument(handler);
    }

    /**
     * Subscribe to file open events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToFileOpen(vscodePort, handler) {
        return vscodePort.onDidOpenTextDocument(handler);
    }

    /**
     * Subscribe to file close events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToFileClose(vscodePort, handler) {
        return vscodePort.onDidCloseTextDocument(handler);
    }

    /**
     * Subscribe to cursor move events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToCursorMove(vscodePort, handler) {
        return vscodePort.onDidChangeTextEditorSelection(handler);
    }

    /**
     * Subscribe to scroll events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToScroll(vscodePort, handler) {
        return vscodePort.onDidChangeTextEditorVisibleRanges(handler);
    }

    /**
     * Subscribe to editor change events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToEditorChange(vscodePort, handler) {
        return vscodePort.onDidChangeActiveTextEditor(handler);
    }

    /**
     * Get relative path from URI
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {vscode.Uri} uri - URI to convert
     * @returns {string} Relative path
     */
    static asRelativePath(vscodePort, uri) {
        return vscodePort.asRelativePath(uri);
    }

    /**
     * Get Range constructor
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @returns {Function} Range constructor
     */
    static getRange(vscodePort) {
        return vscodePort.Range;
    }

    /**
     * Get text documents from workspace
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @returns {Array<vscode.TextDocument>} Array of text documents
     */
    static getTextDocuments(vscodePort) {
        return vscodePort.textDocuments || [];
    }

    /**
     * Get workspace folders
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @returns {Array} Array of workspace folders
     */
    static getWorkspaceFolders(vscodePort) {
        return vscodePort.workspaceFolders || [];
    }
}

// module.exports = VSCodeUtilities; // Commented for consolidation

})(); // End IIFE for app/vscodeUtilities.js

