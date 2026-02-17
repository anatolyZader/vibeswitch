/**
 * Simple statistics for research analysis: correlation, regression, trends.
 * No external dependencies; used by analysis.js for relationship discovery.
 */

/**
 * Sample mean.
 * @param {number[]} xs
 * @returns {number|null}
 */
function mean(xs) {
    if (!Array.isArray(xs) || xs.length === 0) return null;
    const sum = xs.reduce((a, b) => a + b, 0);
    return sum / xs.length;
}

/**
 * Sample standard deviation (n-1).
 * @param {number[]} xs
 * @returns {number|null}
 */
function stdDev(xs) {
    if (!Array.isArray(xs) || xs.length < 2) return null;
    const m = mean(xs);
    const sqDiffs = xs.map((x) => (x - m) * (x - m));
    const variance = sqDiffs.reduce((a, b) => a + b, 0) / (xs.length - 1);
    return Math.sqrt(variance);
}

/**
 * Pearson correlation coefficient between two same-length arrays.
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {number|null} -1 to 1, or null if insufficient data
 */
function pearsonCorrelation(xs, ys) {
    if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 2) return null;
    const n = xs.length;
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - mx;
        const dy = ys[i] - my;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    if (den === 0) return null;
    const r = num / den;
    return Math.max(-1, Math.min(1, r));
}

/**
 * Simple linear regression: y = slope * x + intercept (least squares).
 * Returns slope and intercept; slope indicates direction of relationship.
 * @param {number[]} xs - predictor
 * @param {number[]} ys - outcome
 * @returns {{ slope: number, intercept: number, sampleSize: number }|null}
 */
function linearRegression(xs, ys) {
    if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 2) return null;
    const n = xs.length;
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        den += (xs[i] - mx) * (xs[i] - mx);
    }
    if (den === 0) return null;
    const slope = num / den;
    const intercept = my - slope * mx;
    return { slope, intercept, sampleSize: n };
}

/**
 * Trend direction from slope (for time-ordered data: index 0 = oldest).
 * @param {number} slope
 * @param {boolean} lowerIsBetter - e.g. true for bugs, false for score
 * @returns {'improving'|'stable'|'degrading'}
 */
function trendDirection(slope, lowerIsBetter) {
    const thresh = 0.5;
    if (Math.abs(slope) < thresh) return 'stable';
    if (lowerIsBetter) return slope > 0 ? 'degrading' : 'improving';
    return slope > 0 ? 'improving' : 'degrading';
}

module.exports = {
    mean,
    stdDev,
    pearsonCorrelation,
    linearRegression,
    trendDirection
};
