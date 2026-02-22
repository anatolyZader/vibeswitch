const FindingsStore = require('../../../../../business_modules/agents/infrastructure/store/findingsStore');

describe('FindingsStore', () => {
    let store;
    let mockContext;
    let mockLog;

    beforeEach(() => {
        mockLog = jest.fn();
        mockContext = {
            workspaceState: {
                get: jest.fn().mockReturnValue({}),
                update: jest.fn()
            }
        };
        store = new FindingsStore(mockContext, mockLog);
    });

    test('storeFindings then getFindings returns array', () => {
        store.storeFindings('ws1', 'main', 'abc', 'corr-1', [
            { category: 'qa', severity: 'error', message: 'm1', ruleId: 'r1', evidence: { file: 'a.js' } }
        ]);
        const out = store.getFindings('ws1', 'main', 'abc');
        expect(out).toHaveLength(1);
        expect(out[0].message).toBe('m1');
    });

    test('getFindings with filters.category returns only matching', () => {
        store.storeFindings('ws1', 'main', 'abc', 'c1', [
            { category: 'qa', severity: 'error', message: 'm1', ruleId: 'r1', evidence: {} },
            { category: 'security', severity: 'warn', message: 'm2', ruleId: 'r2', evidence: {} }
        ]);
        expect(store.getFindings('ws1', 'main', 'abc', { category: 'qa' })).toHaveLength(1);
    });

    test('getFindings with filters.severity returns only matching', () => {
        store.storeFindings('ws1', 'main', 'abc', 'c1', [
            { category: 'qa', severity: 'error', message: 'm1', ruleId: 'r1', evidence: {} },
            { category: 'qa', severity: 'warn', message: 'm2', ruleId: 'r2', evidence: {} }
        ]);
        expect(store.getFindings('ws1', 'main', 'abc', { severity: 'error' })).toHaveLength(1);
    });

    test('getAllFindings returns all for workspaceId prefix', () => {
        store.storeFindings('ws1', 'main', 'c1', 'corr-1', [{ category: 'qa', severity: 'info', message: 'a', ruleId: 'r', evidence: {} }]);
        store.storeFindings('ws1', 'feat', 'c2', 'corr-2', [{ category: 'security', severity: 'warn', message: 'b', ruleId: 'r2', evidence: {} }]);
        const all = store.getAllFindings('ws1');
        expect(all).toHaveLength(2);
    });

    test('clearFindings removes key and persist called', () => {
        store.storeFindings('ws1', 'main', 'abc', 'c1', [{ category: 'qa', severity: 'info', message: 'm', ruleId: 'r', evidence: {} }]);
        store.clearFindings('ws1', 'main', 'abc');
        expect(store.getFindings('ws1', 'main', 'abc')).toHaveLength(0);
        expect(mockContext.workspaceState.update).toHaveBeenCalled();
    });

    test('clearAllFindings removes all keys with workspaceId prefix', () => {
        store.storeFindings('ws1', 'main', 'c1', 'c1', [{ category: 'qa', severity: 'info', message: 'm', ruleId: 'r', evidence: {} }]);
        store.clearAllFindings('ws1');
        expect(store.getAllFindings('ws1')).toHaveLength(0);
    });

    test('getSummary returns total, byCategory, bySeverity', () => {
        store.storeFindings('ws1', 'main', 'abc', 'c1', [
            { category: 'qa', severity: 'error', message: 'm1', ruleId: 'r1', evidence: {} },
            { category: 'qa', severity: 'warn', message: 'm2', ruleId: 'r2', evidence: {} }
        ]);
        const summary = store.getSummary('ws1', 'main', 'abc');
        expect(summary.total).toBe(2);
        expect(summary.byCategory.qa).toBe(2);
        expect(summary.bySeverity.error).toBe(1);
        expect(summary.bySeverity.warn).toBe(1);
    });

    test('replace-by-correlationId: same correlationId replaces previous findings for key', () => {
        store.storeFindings('ws1', 'main', 'abc', 'corr-1', [
            { category: 'qa', severity: 'error', message: 'old', ruleId: 'r', evidence: {} }
        ]);
        store.storeFindings('ws1', 'main', 'abc', 'corr-1', [
            { category: 'qa', severity: 'warn', message: 'new', ruleId: 'r', evidence: {} }
        ]);
        const out = store.getFindings('ws1', 'main', 'abc');
        expect(out).toHaveLength(1);
        expect(out[0].message).toBe('new');
    });
});
