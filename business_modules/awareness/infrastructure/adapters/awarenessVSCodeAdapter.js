/**
 * AwarenessVSCodeAdapter - Awareness module-specific adapter implementing IAwarenessVSCodePort
 * 
 * This adapter implements ONLY the VS Code operations required by the awareness module.
 * It is module-specific and does not include general-purpose VS Code methods.
 * 
 * This enables:
 * - Testability without VS Code extension host
 * - Clear separation of concerns
 * - Module-specific contracts (not general-purpose adapters)
 */

const IAwarenessVSCodePort = require('../../domain/ports/IAwarenessVSCodePort');

class AwarenessVSCodeAdapter extends IAwarenessVSCodePort {
    /**
     * @param {Object} vscode - VS Code API module (require('vscode'))
     */
    constructor(vscode) {
        super();
        this.vscode = vscode;
    }

    // ============================================================================
    // Document Event Handlers
    // ============================================================================
    
    onDidChangeTextDocument(handler) {
        return this.vscode.workspace.onDidChangeTextDocument(handler);
    }

    onDidCreateFiles(handler) {
        return this.vscode.workspace.onDidCreateFiles(handler);
    }

    onDidSaveTextDocument(handler) {
        return this.vscode.workspace.onDidSaveTextDocument(handler);
    }

    onDidOpenTextDocument(handler) {
        return this.vscode.workspace.onDidOpenTextDocument(handler);
    }

    onDidCloseTextDocument(handler) {
        return this.vscode.workspace.onDidCloseTextDocument(handler);
    }

    // ============================================================================
    // Editor Event Handlers
    // ============================================================================
    
    onDidChangeTextEditorSelection(handler) {
        return this.vscode.window.onDidChangeTextEditorSelection(handler);
    }

    onDidChangeTextEditorVisibleRanges(handler) {
        return this.vscode.window.onDidChangeTextEditorVisibleRanges(handler);
    }

    onDidChangeActiveTextEditor(handler) {
        return this.vscode.window.onDidChangeActiveTextEditor(handler);
    }

    // ============================================================================
    // Workspace Operations
    // ============================================================================
    
    asRelativePath(uri) {
        return this.vscode.workspace.asRelativePath(uri);
    }

    get workspaceFolders() {
        return this.vscode.workspace.workspaceFolders;
    }

    get textDocuments() {
        return this.vscode.workspace.textDocuments;
    }

    openTextDocument(uri) {
        return this.vscode.workspace.openTextDocument(uri);
    }

    // ============================================================================
    // VS Code Types (for construction)
    // ============================================================================
    
    get Range() {
        return this.vscode.Range;
    }

    get Position() {
        return this.vscode.Position;
    }

    get Uri() {
        return this.vscode.Uri;
    }
}

module.exports = AwarenessVSCodeAdapter;
