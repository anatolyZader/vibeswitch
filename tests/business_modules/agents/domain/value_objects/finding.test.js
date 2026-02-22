const { createFinding } = require('../../../../../business_modules/agents/domain/value_objects/finding');

describe('createFinding', () => {
    test('returns object with category, severity, message, ruleId, evidence', () => {
        const params = {
            category: 'qa',
            severity: 'error',
            message: 'Use strict',
            ruleId: 'rule-1',
            evidence: { file: 'src/a.js', range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } } }
        };
        const out = createFinding(params);
        expect(out).not.toBeNull();
        expect(out.category).toBe('qa');
        expect(out.severity).toBe('error');
        expect(out.message).toBe('Use strict');
        expect(out.ruleId).toBe('rule-1');
        expect(out.evidence).toEqual(params.evidence);
    });

    test('evidence omitted defaults to empty object', () => {
        const out = createFinding({ category: 'security', severity: 'warn', message: 'm', ruleId: 'r' });
        expect(out.evidence).toEqual({});
    });

    test('recommendation and correlationId optional', () => {
        const out = createFinding({
            category: 'architecture',
            severity: 'info',
            message: 'm',
            ruleId: 'r',
            recommendation: 'Do X',
            correlationId: 'corr-1'
        });
        expect(out.recommendation).toBe('Do X');
        expect(out.correlationId).toBe('corr-1');
    });

    test('params null returns null', () => {
        expect(createFinding(null)).toBeNull();
    });
});
