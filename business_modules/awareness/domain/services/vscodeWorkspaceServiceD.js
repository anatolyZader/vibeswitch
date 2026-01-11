/**
 * VSCodeWorkspaceServiceD - Domain service for VS Code workspace operations
 * 
 * Encapsulates workspace-related operations using VS Code port.
 * Service creates instances and passes adapters as ports to methods (following auth module pattern).
 */

class VSCodeWorkspaceServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Get relative path from URI
     * @param {vscode.Uri} uri - URI to convert
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {string} Relative path
     */
    asRelativePath(uri, vscodePort) {
        return vscodePort.asRelativePath(uri);
    }

    /**
     * Get Range constructor
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Function} Range constructor
     */
    getRange(vscodePort) {
        return vscodePort.Range;
    }

    /**
     * Get text documents from workspace
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Array<vscode.TextDocument>} Array of text documents
     */
    getTextDocuments(vscodePort) {
        return vscodePort.textDocuments || [];
    }

    /**
     * Get workspace folders
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Array} Array of workspace folders
     */
    getWorkspaceFolders(vscodePort) {
        return vscodePort.workspaceFolders || [];
    }
}

module.exports = VSCodeWorkspaceServiceD;
