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

module.exports = VSCodeUtilities;
