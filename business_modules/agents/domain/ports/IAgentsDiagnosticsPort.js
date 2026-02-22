/**
 * Port: Display diagnostics (e.g. Problems panel).
 * Implemented by infrastructure/adapters/agentsVscodeDiagnosticsAdapter.js.
 *
 * @interface
 * @typedef {Object} DiagnosticItem - Plain diagnostic (no VSCode types)
 * @property {number} severity - 1=Error, 2=Warning, 3=Information
 * @property {{ start: { line: number, character: number }, end: { line: number, character: number } }} range
 * @property {string} message
 * @property {string} [source]
 * @property {string} [code]
 * @property {Array<{ message: string }>} [relatedInformation]
 *
 * @typedef {Object} IAgentsDiagnosticsPort
 * @property {function(string, DiagnosticItem[]): void} setDiagnostics - setDiagnostics(filePathOrUri, diagnostics) for one file
 * @property {function(): void} clear - clear all diagnostics
 * @property {function(): void} dispose - dispose the collection
 */

module.exports = {};
