/**
 * Findings Diagnostics Provider
 * 
 * Integrates agent findings with VS Code Diagnostics/Problems panel.
 * (IAgentsDiagnosticsPort and agentsVscodeDiagnosticsAdapter exist for future injection; this class still uses the collection directly so existing tests stay green without changes.)
 */

const vscode = require('vscode');
const path = require('path');

class FindingsDiagnostics {
    /**
     * @param {Object} findingsStore - FindingsStore instance
     * @param {Function} [log] - Optional logging function
     */
    constructor(findingsStore, log = null) {
        this.findingsStore = findingsStore;
        this.log = log || (() => {});
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('vibeswitch.agents');
    }

    /**
     * Update diagnostics from findings
     * @param {string} workspaceId - Workspace identifier
     * @param {string} branch - Git branch
     * @param {string} commit - Git commit SHA or 'working-tree'
     */
    updateDiagnostics(workspaceId, branch, commit) {
        const findings = this.findingsStore.getFindings(workspaceId, branch, commit);
        const diagnosticsByFile = new Map();

        findings.forEach(finding => {
            const filePath = finding.evidence.file;
            if (!filePath) return;

            const diagnostic = this._findingToDiagnostic(finding);
            if (!diagnostic) return;

            if (!diagnosticsByFile.has(filePath)) {
                diagnosticsByFile.set(filePath, []);
            }
            diagnosticsByFile.get(filePath).push(diagnostic);
        });

        // Update diagnostics collection
        this.diagnosticCollection.clear();
        for (const [filePath, diagnostics] of diagnosticsByFile.entries()) {
            const uri = this._getFileUri(filePath);
            if (uri) {
                this.diagnosticCollection.set(uri, diagnostics);
            }
        }

        this.log(`Updated diagnostics: ${findings.length} findings across ${diagnosticsByFile.size} files`);
    }

    /**
     * Convert finding to VS Code diagnostic
     * @private
     */
    _findingToDiagnostic(finding) {
        const severityMap = {
            'error': vscode.DiagnosticSeverity.Error,
            'warn': vscode.DiagnosticSeverity.Warning,
            'info': vscode.DiagnosticSeverity.Information
        };

        const severity = severityMap[finding.severity] || vscode.DiagnosticSeverity.Information;
        const range = this._evidenceToRange(finding.evidence);
        if (!range) return null;

        const diagnostic = new vscode.Diagnostic(range, finding.message, severity);
        diagnostic.source = `VibeSwitch ${finding.category}`;
        diagnostic.code = finding.ruleId;
        
        if (finding.recommendation) {
            diagnostic.relatedInformation = [
                new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(vscode.Uri.parse(''), new vscode.Range(0, 0, 0, 0)),
                    finding.recommendation
                )
            ];
        }

        return diagnostic;
    }

    /**
     * Convert evidence to VS Code range
     * @private
     */
    _evidenceToRange(evidence) {
        if (!evidence.range) {
            return new vscode.Range(0, 0, 0, 0);
        }

        const start = new vscode.Position(
            evidence.range.start.line || 0,
            evidence.range.start.character || 0
        );
        const end = new vscode.Position(
            evidence.range.end.line || 0,
            evidence.range.end.character || 0
        );

        return new vscode.Range(start, end);
    }

    /**
     * Get file URI from relative path
     * @private
     */
    _getFileUri(relativePath) {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) return null;

        const workspaceRoot = folders[0].uri.fsPath;
        const fullPath = path.join(workspaceRoot, relativePath);
        return vscode.Uri.file(fullPath);
    }

    /**
     * Clear all diagnostics
     */
    clear() {
        this.diagnosticCollection.clear();
    }

    /**
     * Dispose
     */
    dispose() {
        this.diagnosticCollection.dispose();
    }
}

module.exports = FindingsDiagnostics;
