/**
 * Unit tests for OperationValidator.
 */

const OperationValidator = require('../../../business_modules/dashboard-chat/app/OperationValidator');

describe('OperationValidator', () => {
    describe('validateToolDefinitions', () => {
        it('accepts create_insight', () => {
            expect(OperationValidator.validateToolDefinitions([{ name: 'create_insight' }]).valid).toBe(true);
        });
        it('rejects unknown tools', () => {
            expect(OperationValidator.validateToolDefinitions([{ name: 'write_file' }]).valid).toBe(false);
        });
    });

    describe('validateToolRequest', () => {
        it('allows create_insight with valid input', () => {
            expect(OperationValidator.validateToolRequest({ tool: 'create_insight', input: { filename: 'x', content: 'y' } }).allowed).toBe(true);
        });
        it('rejects path traversal in filename', () => {
            expect(OperationValidator.validateToolRequest({ tool: 'create_insight', input: { filename: '../../../x', content: 'y' } }).allowed).toBe(false);
        });
        it('rejects unknown tools', () => {
            expect(OperationValidator.validateToolRequest({ tool: 'run_command' }).allowed).toBe(false);
        });
    });

    describe('getSecurityReport', () => {
        it('returns enforcement info', () => {
            const r = OperationValidator.getSecurityReport();
            expect(r.enforcement).toBe('TECHNICAL');
            expect(r.allowedTools).toContain('create_insight');
        });
    });
});
