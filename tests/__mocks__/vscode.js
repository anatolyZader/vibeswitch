/**
 * Mock vscode module for Jest tests
 */

class EventEmitter {
    constructor() {
        this._listeners = [];
    }
    get event() {
        return (listener) => {
            this._listeners.push(listener);
            return { dispose: () => {} };
        };
    }
    fire(data) {
        this._listeners.forEach(l => l(data));
    }
}

module.exports = {
    EventEmitter,
    Uri: {
        parse: (uri) => ({ 
            scheme: uri.startsWith('file://') ? 'file' : 'http',
            fsPath: uri.replace('file://', ''),
            toString: () => uri
        })
    },
    window: {
        showErrorMessage: jest.fn(),
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn()
        })),
        createStatusBarItem: jest.fn(() => ({
            text: '',
            tooltip: '',
            command: null,
            show: jest.fn(),
            hide: jest.fn()
        }))
    },
    workspace: {
        workspaceFolders: [],
        getConfiguration: jest.fn(() => ({
            get: jest.fn(),
            update: jest.fn()
        }))
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    }
};
