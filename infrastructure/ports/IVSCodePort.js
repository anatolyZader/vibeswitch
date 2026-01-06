/**
 * IVSCodePort - Interface for VS Code API operations
 * 
 * This port abstracts VS Code workspace and window APIs, enabling:
 * - Testability without VS Code extension host
 * - Flexibility to swap implementations
 * - Clear separation between domain and infrastructure
 * 
 * Implementations should wrap the actual VS Code API.
 */

/**
 * @interface IVSCodePort
 */
class IVSCodePort {
    /**
     * Register a handler for text document changes
     * @param {Function} handler - Handler function receiving TextDocumentChangeEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeTextDocument(handler) {
        throw new Error('onDidChangeTextDocument not implemented');
    }

    /**
     * Register a handler for file creation events
     * @param {Function} handler - Handler function receiving FileCreateEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidCreateFiles(handler) {
        throw new Error('onDidCreateFiles not implemented');
    }

    /**
     * Register a handler for file save events
     * @param {Function} handler - Handler function receiving TextDocument
     * @returns {Object} Disposable to unsubscribe
     */
    onDidSaveTextDocument(handler) {
        throw new Error('onDidSaveTextDocument not implemented');
    }

    /**
     * Register a handler for file open events
     * @param {Function} handler - Handler function receiving TextDocument
     * @returns {Object} Disposable to unsubscribe
     */
    onDidOpenTextDocument(handler) {
        throw new Error('onDidOpenTextDocument not implemented');
    }

    /**
     * Register a handler for file close events
     * @param {Function} handler - Handler function receiving TextDocument
     * @returns {Object} Disposable to unsubscribe
     */
    onDidCloseTextDocument(handler) {
        throw new Error('onDidCloseTextDocument not implemented');
    }

    /**
     * Register a handler for text editor selection changes
     * @param {Function} handler - Handler function receiving TextEditorSelectionChangeEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeTextEditorSelection(handler) {
        throw new Error('onDidChangeTextEditorSelection not implemented');
    }

    /**
     * Register a handler for text editor visible range changes
     * @param {Function} handler - Handler function receiving TextEditorVisibleRangesChangeEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeTextEditorVisibleRanges(handler) {
        throw new Error('onDidChangeTextEditorVisibleRanges not implemented');
    }

    /**
     * Register a handler for active text editor changes
     * @param {Function} handler - Handler function receiving TextEditor | undefined
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeActiveTextEditor(handler) {
        throw new Error('onDidChangeActiveTextEditor not implemented');
    }

    /**
     * Convert a URI to a relative path string
     * @param {Object} uri - VS Code URI object
     * @returns {string} Relative path string
     */
    asRelativePath(uri) {
        throw new Error('asRelativePath not implemented');
    }

    /**
     * Get workspace folders
     * @returns {Array|undefined} Array of workspace folders or undefined
     */
    get workspaceFolders() {
        throw new Error('workspaceFolders getter not implemented');
    }

    /**
     * Get all open text documents
     * @returns {Array} Array of TextDocument instances
     */
    get textDocuments() {
        throw new Error('textDocuments getter not implemented');
    }

    /**
     * Create an output channel
     * @param {string} name - Name of the output channel
     * @returns {Object} OutputChannel instance
     */
    createOutputChannel(name) {
        throw new Error('createOutputChannel not implemented');
    }

    /**
     * Create a status bar item
     * @param {number} alignment - StatusBarAlignment value
     * @param {number} priority - Priority value
     * @returns {Object} StatusBarItem instance
     */
    createStatusBarItem(alignment, priority) {
        throw new Error('createStatusBarItem not implemented');
    }

    /**
     * Show an error message
     * @param {string} message - Error message to display
     * @returns {Promise<string|undefined>} Selected item or undefined
     */
    showErrorMessage(message) {
        throw new Error('showErrorMessage not implemented');
    }

    /**
     * Show an information message
     * @param {string} message - Information message to display
     * @returns {Promise<string|undefined>} Selected item or undefined
     */
    showInformationMessage(message) {
        throw new Error('showInformationMessage not implemented');
    }

    /**
     * Show a warning message
     * @param {string} message - Warning message to display
     * @returns {Promise<string|undefined>} Selected item or undefined
     */
    showWarningMessage(message) {
        throw new Error('showWarningMessage not implemented');
    }

    /**
     * Get the active text editor
     * @returns {Object|undefined} Active TextEditor or undefined
     */
    get activeTextEditor() {
        throw new Error('activeTextEditor getter not implemented');
    }

    /**
     * Register a command
     * @param {string} command - Command identifier
     * @param {Function} handler - Command handler function
     * @returns {Object} Disposable to unregister command
     */
    registerCommand(command, handler) {
        throw new Error('registerCommand not implemented');
    }

    /**
     * Get workspace configuration
     * @param {string} section - Configuration section name
     * @returns {Object} WorkspaceConfiguration instance
     */
    getConfiguration(section) {
        throw new Error('getConfiguration not implemented');
    }

    /**
     * Open a text document
     * @param {Object} uri - VS Code URI object
     * @returns {Promise<Object>} TextDocument instance
     */
    openTextDocument(uri) {
        throw new Error('openTextDocument not implemented');
    }
}

module.exports = IVSCodePort;

