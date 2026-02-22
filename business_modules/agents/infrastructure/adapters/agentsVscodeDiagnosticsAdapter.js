/**
 * Adapter: Show diagnostics in VS Code Problems panel.
 * Implements IAgentsDiagnosticsPort (clear, set, dispose).
 */

const vscode = require('vscode');

const SEVERITY_MAP = { 1: vscode.DiagnosticSeverity.Error, 2: vscode.DiagnosticSeverity.Warning, 3: vscode.DiagnosticSeverity.Information };

/**
 * @param {function(): string|null} getWorkspaceRoot - Resolve workspace root for relative paths
 * @returns {{ set: function(string, Object[]), clear: function(), dispose: function() }} Port implementation (same shape as DiagnosticCollection for tests)
 */
function createAgentsVscodeDiagnosticsAdapter(getWorkspaceRoot) {
    const collection = vscode.languages.createDiagnosticCollection('vibeswitch.agents');

    function toVscodeDiagnostic(plain) {
        const range = plain.range
            ? new vscode.Range(
                plain.range.start.line ?? 0,
                plain.range.start.character ?? 0,
                plain.range.end.line ?? 0,
                plain.range.end.character ?? 0
            )
            : new vscode.Range(0, 0, 0, 0);
        const severity = SEVERITY_MAP[plain.severity] ?? vscode.DiagnosticSeverity.Information;
        const diagnostic = new vscode.Diagnostic(range, plain.message, severity);
        if (plain.source) diagnostic.source = plain.source;
        if (plain.code) diagnostic.code = plain.code;
        if (plain.relatedInformation?.length) {
            diagnostic.relatedInformation = plain.relatedInformation.map((r) => new vscode.DiagnosticRelatedInformation(new vscode.Location(vscode.Uri.parse(''), new vscode.Range(0, 0, 0, 0)), r.message));
        }
        return diagnostic;
    }

    return {
        set(fullPathOrUri, plainDiagnostics) {
            const uri = typeof fullPathOrUri === 'string' ? vscode.Uri.file(fullPathOrUri) : fullPathOrUri;
            const vscodeDiags = (plainDiagnostics || []).map(toVscodeDiagnostic);
            collection.set(uri, vscodeDiags);
        },
        clear() {
            collection.clear();
        },
        dispose() {
            collection.dispose();
        }
    };
}

module.exports = { createAgentsVscodeDiagnosticsAdapter };
