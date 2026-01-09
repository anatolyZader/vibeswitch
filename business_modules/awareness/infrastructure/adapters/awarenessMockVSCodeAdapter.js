/**
 * AwarenessMockVSCodeAdapter - Mock implementation of IAwarenessVSCodePort for testing
 * 
 * Provides in-memory implementations of VS Code APIs for unit testing
 * without requiring the VS Code extension host.
 */

const IAwarenessVSCodePort = require('../../domain/ports/IAwarenessVSCodePort');

class AwarenessMockVSCodeAdapter extends IAwarenessVSCodePort {
    constructor() {
        super();
        
        // Mock event emitters
        this._textDocumentChangeHandlers = [];
        this._fileCreateHandlers = [];
        this._fileSaveHandlers = [];
        this._fileOpenHandlers = [];
        this._fileCloseHandlers = [];
        this._selectionChangeHandlers = [];
        this._visibleRangesChangeHandlers = [];
        this._activeEditorChangeHandlers = [];
        
        // Mock state
        this._workspaceFolders = [];
        this._textDocuments = [];
        this._activeTextEditor = null;
        this._outputChannels = new Map();
        this._statusBarItems = [];
        this._commands = new Map();
        this._configurations = new Map();
        
        // Mock VS Code types
        this.Range = class MockRange {
            constructor(startLine, startChar, endLine, endChar) {
                this.start = { line: startLine, character: startChar };
                this.end = { line: endLine, character: endChar };
            }
        };
        
        this.Position = class MockPosition {
            constructor(line, character) {
                this.line = line;
                this.character = character;
            }
        };
        
        this.Uri = class MockUri {
            constructor(scheme, authority, path, query, fragment) {
                this.scheme = scheme || 'file';
                this.authority = authority || '';
                this.path = path || '';
                this.query = query || '';
                this.fragment = fragment || '';
            }
            
            static parse(uriString) {
                const match = uriString.match(/^([^:]+):\/\/([^\/]*)(\/.*)?$/);
                if (!match) {
                    return new MockUri('file', '', uriString);
                }
                return new MockUri(match[1], match[2] || '', match[3] || '/');
            }
            
            static file(filePath) {
                return new MockUri('file', '', filePath);
            }
            
            toString() {
                return `${this.scheme}://${this.authority}${this.path}`;
            }
            
            get fsPath() {
                return this.path;
            }
        };
        
        this.StatusBarAlignment = {
            Left: 1,
            Right: 2
        };
    }
    
    // Event registration methods
    onDidChangeTextDocument(handler) {
        this._textDocumentChangeHandlers.push(handler);
        return { dispose: () => {
            const index = this._textDocumentChangeHandlers.indexOf(handler);
            if (index > -1) this._textDocumentChangeHandlers.splice(index, 1);
        }};
    }
    
    onDidCreateFiles(handler) {
        this._fileCreateHandlers.push(handler);
        return { dispose: () => {
            const index = this._fileCreateHandlers.indexOf(handler);
            if (index > -1) this._fileCreateHandlers.splice(index, 1);
        }};
    }
    
    onDidSaveTextDocument(handler) {
        this._fileSaveHandlers.push(handler);
        return { dispose: () => {
            const index = this._fileSaveHandlers.indexOf(handler);
            if (index > -1) this._fileSaveHandlers.splice(index, 1);
        }};
    }
    
    onDidOpenTextDocument(handler) {
        this._fileOpenHandlers.push(handler);
        return { dispose: () => {
            const index = this._fileOpenHandlers.indexOf(handler);
            if (index > -1) this._fileOpenHandlers.splice(index, 1);
        }};
    }
    
    onDidCloseTextDocument(handler) {
        this._fileCloseHandlers.push(handler);
        return { dispose: () => {
            const index = this._fileCloseHandlers.indexOf(handler);
            if (index > -1) this._fileCloseHandlers.splice(index, 1);
        }};
    }
    
    onDidChangeTextEditorSelection(handler) {
        this._selectionChangeHandlers.push(handler);
        return { dispose: () => {
            const index = this._selectionChangeHandlers.indexOf(handler);
            if (index > -1) this._selectionChangeHandlers.splice(index, 1);
        }};
    }
    
    onDidChangeTextEditorVisibleRanges(handler) {
        this._visibleRangesChangeHandlers.push(handler);
        return { dispose: () => {
            const index = this._visibleRangesChangeHandlers.indexOf(handler);
            if (index > -1) this._visibleRangesChangeHandlers.splice(index, 1);
        }};
    }
    
    onDidChangeActiveTextEditor(handler) {
        this._activeEditorChangeHandlers.push(handler);
        return { dispose: () => {
            const index = this._activeEditorChangeHandlers.indexOf(handler);
            if (index > -1) this._activeEditorChangeHandlers.splice(index, 1);
        }};
    }
    
    asRelativePath(uri) {
        if (typeof uri === 'string') {
            return uri;
        }
        return uri.path || uri.toString();
    }
    
    get workspaceFolders() {
        return this._workspaceFolders;
    }
    
    setWorkspaceFolders(folders) {
        this._workspaceFolders = folders;
    }
    
    get textDocuments() {
        return this._textDocuments;
    }
    
    addTextDocument(document) {
        this._textDocuments.push(document);
    }
    
    createOutputChannel(name) {
        if (!this._outputChannels.has(name)) {
            this._outputChannels.set(name, {
                name: name,
                _lines: [],
                append: (value) => { this._outputChannels.get(name)._lines.push(value); },
                appendLine: (value) => { this._outputChannels.get(name)._lines.push(value + '\n'); },
                show: () => {},
                hide: () => {},
                clear: () => { this._outputChannels.get(name)._lines = []; },
                dispose: () => { this._outputChannels.delete(name); }
            });
        }
        return this._outputChannels.get(name);
    }
    
    createStatusBarItem(alignment, priority) {
        const item = {
            alignment: alignment,
            priority: priority,
            text: '',
            tooltip: '',
            command: null,
            show: () => { item._visible = true; },
            hide: () => { item._visible = false; },
            dispose: () => {}
        };
        this._statusBarItems.push(item);
        return item;
    }
    
    showErrorMessage(message) {
        return Promise.resolve(undefined);
    }
    
    showInformationMessage(message) {
        return Promise.resolve(undefined);
    }
    
    showWarningMessage(message) {
        return Promise.resolve(undefined);
    }
    
    get activeTextEditor() {
        return this._activeTextEditor;
    }
    
    setActiveTextEditor(editor) {
        this._activeTextEditor = editor;
        this._activeEditorChangeHandlers.forEach(h => h(editor));
    }
    
    registerCommand(command, handler) {
        this._commands.set(command, handler);
        return { dispose: () => { this._commands.delete(command); }};
    }
    
    getConfiguration(section) {
        if (!this._configurations.has(section)) {
            this._configurations.set(section, {
                get: (key) => undefined,
                update: (key, value) => Promise.resolve(),
                has: (key) => false
            });
        }
        return this._configurations.get(section);
    }
    
    openTextDocument(uri) {
        // Mock implementation - returns a promise with a mock document
        return Promise.resolve({
            uri: typeof uri === 'string' ? this.Uri.parse(uri) : uri,
            getText: () => '',
            lineCount: 0,
            lineAt: (line) => ({ text: '' }),
            validateRange: (range) => range
        });
    }
    
    // Test helpers
    simulateTextDocumentChange(event) {
        this._textDocumentChangeHandlers.forEach(h => h(event));
    }
    
    simulateFileCreate(event) {
        this._fileCreateHandlers.forEach(h => h(event));
    }
    
    simulateFileSave(document) {
        this._fileSaveHandlers.forEach(h => h(document));
    }
    
    simulateFileOpen(document) {
        this._fileOpenHandlers.forEach(h => h(document));
    }
    
    simulateFileClose(document) {
        this._fileCloseHandlers.forEach(h => h(document));
    }
    
    clear() {
        this._textDocumentChangeHandlers = [];
        this._fileCreateHandlers = [];
        this._fileSaveHandlers = [];
        this._fileOpenHandlers = [];
        this._fileCloseHandlers = [];
        this._selectionChangeHandlers = [];
        this._visibleRangesChangeHandlers = [];
        this._activeEditorChangeHandlers = [];
        this._textDocuments = [];
        this._workspaceFolders = [];
        this._outputChannels.clear();
        this._statusBarItems = [];
        this._commands.clear();
        this._configurations.clear();
    }
}

module.exports = AwarenessMockVSCodeAdapter;


