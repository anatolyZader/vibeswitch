/**
 * EventSubscriptionServiceD - Domain service for VS Code event subscription
 * 
 * Encapsulates event subscription logic using VS Code port.
 * Service creates instances and passes adapters as ports to methods (following auth module pattern).
 */

class EventSubscriptionServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Subscribe to text document change events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToTextDocumentChanges(handler, vscodePort) {
        return vscodePort.onDidChangeTextDocument(handler);
    }

    /**
     * Subscribe to file creation events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToFileCreation(handler, vscodePort) {
        return vscodePort.onDidCreateFiles(handler);
    }

    /**
     * Subscribe to file save events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToFileSave(handler, vscodePort) {
        return vscodePort.onDidSaveTextDocument(handler);
    }

    /**
     * Subscribe to file open events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToFileOpen(handler, vscodePort) {
        return vscodePort.onDidOpenTextDocument(handler);
    }

    /**
     * Subscribe to file close events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToFileClose(handler, vscodePort) {
        return vscodePort.onDidCloseTextDocument(handler);
    }

    /**
     * Subscribe to cursor move events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToCursorMove(handler, vscodePort) {
        return vscodePort.onDidChangeTextEditorSelection(handler);
    }

    /**
     * Subscribe to scroll events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToScroll(handler, vscodePort) {
        return vscodePort.onDidChangeTextEditorVisibleRanges(handler);
    }

    /**
     * Subscribe to editor change events
     * @param {Function} handler - Event handler function
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Object} Disposable to unsubscribe
     */
    subscribeToEditorChange(handler, vscodePort) {
        return vscodePort.onDidChangeActiveTextEditor(handler);
    }
}

module.exports = EventSubscriptionServiceD;
