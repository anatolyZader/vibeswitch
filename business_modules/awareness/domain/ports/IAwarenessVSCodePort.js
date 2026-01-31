/**
 * IAwarenessVSCodePort - Interface for VS Code API operations used by the Awareness module
 * 
 * This port abstracts ONLY the VS Code operations that the awareness module requires.
 * It is module-specific and does not include general-purpose VS Code methods.
 * 
 * This enables:
 * - Testability without VS Code extension host
 * - Flexibility to swap implementations
 * - Clear separation between domain and infrastructure
 * - Module-specific contracts (not general-purpose adapters)
 * 
 * Implementations should wrap the actual VS Code API.
 */

/**
 * @interface IAwarenessVSCodePort
 */
class IAwarenessVSCodePort {
    constructor() {
        if (new.target === IAwarenessVSCodePort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    // ============================================================================
    // Document Event Handlers (used by EventHandlers entity)
    // ============================================================================
    
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

    // ============================================================================
    // Editor Event Handlers (used by EventHandlers entity)
    // ============================================================================
    
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

    // ============================================================================
    // Workspace Operations (used by FileWatcher, ScoreCalculator, EventHandlers)
    // ============================================================================
    
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
     * Open a text document
     * @param {Object} uri - VS Code URI object
     * @returns {Promise<Object>} TextDocument instance
     */
    openTextDocument(uri) {
        throw new Error('openTextDocument not implemented');
    }

    // ============================================================================
    // VS Code Types (used for constructing Range, Position, Uri objects)
    // ============================================================================
    
    /**
     * Get VS Code Range constructor
     * @returns {Function} Range constructor
     */
    get Range() {
        throw new Error('Range getter not implemented');
    }

    /**
     * Get VS Code Position constructor
     * @returns {Function} Position constructor
     */
    get Position() {
        throw new Error('Position getter not implemented');
    }

    /**
     * Get VS Code Uri constructor
     * @returns {Function} Uri constructor
     */
    get Uri() {
        throw new Error('Uri getter not implemented');
    }

    /**
     * Create a file system watcher for the workspace (e.g. to detect agent-created files).
     * @param {string|Object} globPattern - Glob pattern or RelativePattern (e.g. match all files)
     * @returns {Object} FileSystemWatcher with onDidCreate, onDidChange, onDidDelete (each returns Disposable)
     */
    createFileSystemWatcher(globPattern) {
        throw new Error('createFileSystemWatcher not implemented');
    }
}

module.exports = IAwarenessVSCodePort;
