/**
 * Mock vscode module for Jest tests
 */

module.exports = {
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
