/**
 * Unit tests for StatisticalAnalyzer.
 */

const { analyze, pearsonCorrelation, simpleLinearRegression, pivotByMeasure } = require('../../../business_modules/research/app/StatisticalAnalyzer');

describe('StatisticalAnalyzer', () => {
    describe('pearsonCorrelation', () => {
        it('returns 1 for identical series', () => {
            const x = [1, 2, 3, 4, 5];
            expect(pearsonCorrelation(x, x)).toBeCloseTo(1, 5);
        });

        it('returns -1 for opposite series', () => {
            const x = [1, 2, 3, 4, 5];
            const y = [5, 4, 3, 2, 1];
            expect(pearsonCorrelation(x, y)).toBeCloseTo(-1, 5);
        });

        it('returns null for insufficient data', () => {
            expect(pearsonCorrelation([1, 2], [1, 2])).toBeNull();
        });
    });

    describe('simpleLinearRegression', () => {
        it('fits y = 2x + 1', () => {
            const x = [1, 2, 3, 4, 5];
            const y = x.map((v) => 2 * v + 1);
            const result = simpleLinearRegression(x, y);
            expect(result).not.toBeNull();
            expect(result.b).toBeCloseTo(2, 3);
            expect(result.a).toBeCloseTo(1, 3);
            expect(result.r2).toBeCloseTo(1, 3);
        });

        it('returns null for insufficient data', () => {
            expect(simpleLinearRegression([1, 2], [1, 2])).toBeNull();
        });
    });

    describe('pivotByMeasure', () => {
        it('pivots rows by measure', () => {
            const rows = [
                { timestamp: 't1', measure_name: 'a', value: 1 },
                { timestamp: 't1', measure_name: 'b', value: 2 },
                { timestamp: 't2', measure_name: 'a', value: 3 },
                { timestamp: 't2', measure_name: 'b', value: 4 }
            ];
            const { byMeasure } = pivotByMeasure(rows);
            expect(byMeasure.a).toEqual([1, 3]);
            expect(byMeasure.b).toEqual([2, 4]);
        });
    });

    describe('analyze', () => {
        it('returns none for insufficient data', () => {
            const rows = [
                { timestamp: 't1', measure_name: 'a', value: 1 },
                { timestamp: 't2', measure_name: 'a', value: 2 }
            ];
            const results = analyze(rows);
            expect(results[0].method).toBe('none');
        });

        it('returns correlation for valid pairs', () => {
            const rows = [];
            for (let i = 0; i < 8; i++) {
                rows.push({ timestamp: 't' + i, measure_name: 'x', value: i });
                rows.push({ timestamp: 't' + i, measure_name: 'y', value: 2 * i + 1 });
            }
            const results = analyze(rows);
            expect(results.length).toBeGreaterThan(0);
            const corrResult = results.find((r) => r.method === 'correlation_regression');
            expect(corrResult).toBeDefined();
            expect(corrResult.findings).toContain('r =');
        });
    });
});
