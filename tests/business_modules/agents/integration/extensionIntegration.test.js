jest.mock('vscode', () => {
    const mockWorkspaceState = { get: jest.fn().mockReturnValue({}), update: jest.fn() };
    return {
        workspace: {
            getConfiguration: jest.fn(() => ({
                get: jest.fn((key) => (key === 'gatewayUrl' ? 'https://gateway.example.com' : (key === 'triggerOnSave' ? false : '')))
            })),
            workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
            onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() }))
        },
        window: {
            showWarningMessage: jest.fn(),
            showInformationMessage: jest.fn(),
            showErrorMessage: jest.fn()
        },
        languages: { createDiagnosticCollection: jest.fn(() => ({ clear: jest.fn(), set: jest.fn(), dispose: jest.fn() })) },
        Uri: { file: (p) => ({ fsPath: p }) },
        DiagnosticSeverity: { Error: 1, Warning: 2, Information: 3 },
        Diagnostic: class {},
        Range: class {},
        Position: class {},
        DiagnosticRelatedInformation: class {},
        Location: class {}
    };
});

const path = require('path');
const AgentsExtensionIntegration = require('../../../../business_modules/agents/integration/extensionIntegration');

describe('AgentsExtensionIntegration', () => {
    let integration;
    let mockContext;
    let mockState;
    let mockLog;

    beforeEach(() => {
        jest.clearAllMocks();
        mockLog = jest.fn();
        mockContext = {
            workspaceState: { get: jest.fn().mockReturnValue({}), update: jest.fn() },
            subscriptions: []
        };
        mockState = { getMode: jest.fn().mockReturnValue('dev') };
        const vscode = require('vscode');
        vscode.workspace.getConfiguration.mockReturnValue({
            get: jest.fn((key, def) => (key === 'gatewayUrl' ? 'https://gateway.example.com' : def))
        });
        integration = new AgentsExtensionIntegration(mockContext, mockState, mockLog);
    });

    test('start when orchestrator present logs Agent integration started', () => {
        integration.start();
        expect(mockLog).toHaveBeenCalledWith('Agent integration started');
    });

    test('triggerBeforeCommit with orchestrator calls triggerAgents', async () => {
        const triggerAgents = jest.fn().mockResolvedValue('corr-123');
        integration.orchestrator = { triggerAgents };
        await integration.triggerBeforeCommit();
        expect(triggerAgents).toHaveBeenCalledWith({ trigger: 'before-commit', mode: 'dev' });
    });

    test('triggerBeforeCommit with no orchestrator shows warning', async () => {
        integration.orchestrator = null;
        const vscode = require('vscode');
        await integration.triggerBeforeCommit();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('Agents not configured');
    });

    test('dispose clears timer and disposes diagnostics and orchestrator', () => {
        integration._saveDebounceTimer = setTimeout(() => {}, 10000);
        integration.diagnostics = { dispose: jest.fn() };
        integration.orchestrator = { dispose: jest.fn() };
        integration.dispose();
        expect(integration.diagnostics.dispose).toHaveBeenCalled();
        expect(integration.orchestrator.dispose).toHaveBeenCalled();
    });
});
