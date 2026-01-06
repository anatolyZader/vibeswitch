/**
 * VSCodeAdapter - Adapter implementing IVSCodePort
 * 
 * Wraps VS Code API to implement the IVSCodePort interface.
 * This enables testability and clear separation of concerns.
 */

const IVSCodePort = require('../ports/IVSCodePort');

class VSCodeAdapter extends IVSCodePort {
    /**
     * @param {Object} vscode - VS Code API module (require('vscode'))
     */
    constructor(vscode) {
        super();
        this.vscode = vscode;
    }

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

    onDidChangeTextEditorSelection(handler) {
        return this.vscode.window.onDidChangeTextEditorSelection(handler);
    }

    onDidChangeTextEditorVisibleRanges(handler) {
        return this.vscode.window.onDidChangeTextEditorVisibleRanges(handler);
    }

    onDidChangeActiveTextEditor(handler) {
        return this.vscode.window.onDidChangeActiveTextEditor(handler);
    }

    asRelativePath(uri) {
        return this.vscode.workspace.asRelativePath(uri);
    }

    get workspaceFolders() {
        return this.vscode.workspace.workspaceFolders;
    }

    get textDocuments() {
        return this.vscode.workspace.textDocuments;
    }

    createOutputChannel(name) {
        return this.vscode.window.createOutputChannel(name);
    }

    createStatusBarItem(alignment, priority) {
        return this.vscode.window.createStatusBarItem(alignment, priority);
    }

    showErrorMessage(message) {
        return this.vscode.window.showErrorMessage(message);
    }

    showInformationMessage(message) {
        return this.vscode.window.showInformationMessage(message);
    }

    showWarningMessage(message) {
        return this.vscode.window.showWarningMessage(message);
    }

    get activeTextEditor() {
        return this.vscode.window.activeTextEditor;
    }

    registerCommand(command, handler) {
        return this.vscode.commands.registerCommand(command, handler);
    }

    getConfiguration(section) {
        return this.vscode.workspace.getConfiguration(section);
    }

    openTextDocument(uri) {
        return this.vscode.workspace.openTextDocument(uri);
    }

    // Expose VS Code types for construction (Range, Position, Uri, etc.)
    get Range() {
        return this.vscode.Range;
    }

    get Position() {
        return this.vscode.Position;
    }

    get Uri() {
        return this.vscode.Uri;
    }

    get StatusBarAlignment() {
        return this.vscode.StatusBarAlignment;
    }
}

module.exports = VSCodeAdapter;

