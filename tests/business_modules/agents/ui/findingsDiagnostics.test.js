const FindingsDiagnostics = require('../../../../business_modules/agents/ui/findingsDiagnostics');

describe('FindingsDiagnostics', () => {
    let diagnostics;
    let mockStore;
    let mockLog;

    beforeEach(() => {
        mockLog = jest.fn();
        mockStore = {
            getFindings: jest.fn().mockReturnValue([])
        };
        diagnostics = new FindingsDiagnostics(mockStore, mockLog);
    });

    test('updateDiagnostics gets findings from store and clears then sets collection', () => {
        mockStore.getFindings.mockReturnValue([
            {
                category: 'qa',
                severity: 'error',
                message: 'msg',
                ruleId: 'r1',
                evidence: { file: 'src/a.js', range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } } }
            }
        ]);
        diagnostics.updateDiagnostics('ws1', 'main', 'abc');
        expect(mockStore.getFindings).toHaveBeenCalledWith('ws1', 'main', 'abc');
        expect(diagnostics.diagnosticCollection.clear).toHaveBeenCalled();
    });

    test('findings without evidence.file are skipped', () => {
        mockStore.getFindings.mockReturnValue([
            { category: 'qa', severity: 'warn', message: 'm', ruleId: 'r', evidence: {} }
        ]);
        diagnostics.updateDiagnostics('ws1', 'main', 'abc');
        expect(diagnostics.diagnosticCollection.set).not.toHaveBeenCalled();
    });

    test('clear clears diagnostic collection', () => {
        diagnostics.clear();
        expect(diagnostics.diagnosticCollection.clear).toHaveBeenCalled();
    });

    test('dispose disposes collection', () => {
        diagnostics.dispose();
        expect(diagnostics.diagnosticCollection.dispose).toHaveBeenCalled();
    });
});
