/**
 * Unit tests for research-agent statistics (correlation, regression, trend).
 */
const { mean, stdDev, pearsonCorrelation, linearRegression, trendDirection } = require('../../research-agent/statistics');

describe('statistics', () => {
    describe('mean', () => {
        test('returns mean of array', () => {
            expect(mean([1, 2, 3])).toBe(2);
            expect(mean([10, 20])).toBe(15);
        });
        test('returns null for empty array', () => {
            expect(mean([])).toBeNull();
        });
    });

    describe('stdDev', () => {
        test('returns sample std dev', () => {
            const s = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
            expect(s).toBeGreaterThan(0);
        });
        test('returns null for length < 2', () => {
            expect(stdDev([1])).toBeNull();
            expect(stdDev([])).toBeNull();
        });
    });

    describe('pearsonCorrelation', () => {
        test('perfect positive correlation', () => {
            const r = pearsonCorrelation([1, 2, 3], [2, 4, 6]);
            expect(r).toBe(1);
        });
        test('perfect negative correlation', () => {
            const r = pearsonCorrelation([1, 2, 3], [6, 4, 2]);
            expect(r).toBe(-1);
        });
        test('no correlation', () => {
            const r = pearsonCorrelation([1, 2, 3], [1, 1, 1]);
            expect(r).toBeNull();
        });
        test('returns null for insufficient data', () => {
            expect(pearsonCorrelation([1], [1])).toBeNull();
            expect(pearsonCorrelation([1, 2], [1])).toBeNull();
        });
    });

    describe('linearRegression', () => {
        test('fits y = 2x + 1', () => {
            const xs = [0, 1, 2, 3];
            const ys = [1, 3, 5, 7];
            const reg = linearRegression(xs, ys);
            expect(reg).not.toBeNull();
            expect(reg.slope).toBe(2);
            expect(reg.intercept).toBe(1);
            expect(reg.sampleSize).toBe(4);
        });
        test('returns null for length < 2', () => {
            expect(linearRegression([1], [1])).toBeNull();
        });
    });

    describe('trendDirection', () => {
        test('lowerIsBetter: positive slope = degrading', () => {
            expect(trendDirection(1, true)).toBe('degrading');
        });
        test('lowerIsBetter: negative slope = improving', () => {
            expect(trendDirection(-1, true)).toBe('improving');
        });
        test('higherIsBetter: positive slope = improving', () => {
            expect(trendDirection(1, false)).toBe('improving');
        });
        test('small slope = stable', () => {
            expect(trendDirection(0.1, true)).toBe('stable');
        });
    });
});
