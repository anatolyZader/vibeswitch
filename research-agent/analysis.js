/**
 * Stateless research analysis: computes findings from current + history.
 * Includes basic stats (latest vs average), correlations, regression, and trends.
 * No persistence; used by the Fastify ingest handler.
 */

const { mean, pearsonCorrelation, linearRegression, trendDirection } = require('./statistics');

/** Minimum sample size for correlation/trend findings */
const MIN_SAMPLE = 3;

/** Minimum |r| to report a correlation */
const MIN_CORRELATION = 0.3;

/**
 * Extract aligned pairs (x, y) from points where both getters return a number.
 * @param {Object[]} points - time-ordered (current first)
 * @param {function(Object): number|null} getX
 * @param {function(Object): number|null} getY
 * @returns {{ xs: number[], ys: number[] }}
 */
function pairedSeries(points, getX, getY) {
    const xs = [];
    const ys = [];
    for (let i = 0; i < points.length; i++) {
        const x = getX(points[i]);
        const y = getY(points[i]);
        if (x != null && typeof x === 'number' && !Number.isNaN(x) && y != null && typeof y === 'number' && !Number.isNaN(y)) {
            xs.push(x);
            ys.push(y);
        }
    }
    return { xs, ys };
}

/**
 * Extract single series for trend (y over time index).
 * @param {Object[]} points
 * @param {function(Object): number|null} getVal
 * @returns {{ xs: number[], ys: number[] }} xs = 0,1,2,...
 */
function timeSeries(points, getVal) {
    const xs = [];
    const ys = [];
    for (let i = 0; i < points.length; i++) {
        const y = getVal(points[i]);
        if (y != null && typeof y === 'number' && !Number.isNaN(y)) {
            xs.push(i);
            ys.push(y);
        }
    }
    return { xs, ys };
}

function runAnalysis(payload) {
    const cur = payload.current || null;
    const history = Array.isArray(payload.history) ? payload.history : [];
    const points = cur ? [cur, ...history] : history;
    const findings = [];

    // --- Basic stats (existing behavior) ---
    if (points.length >= 2) {
        const bugs = points.map(function (p) { return (p.sonarMeasures && p.sonarMeasures.bugs != null) ? p.sonarMeasures.bugs : null; }).filter(function (v) { return v != null; });
        if (bugs.length >= 2) {
            const avg = bugs.reduce(function (a, b) { return a + b; }, 0) / bugs.length;
            findings.push({ metric: 'sonar.bugs', latest: bugs[0], average: Math.round(avg * 10) / 10, sampleSize: bugs.length });
        }
        const totals = points.map(function (p) { return (p.scoreData && p.scoreData.total != null) ? p.scoreData.total : null; }).filter(function (v) { return v != null; });
        if (totals.length >= 2) {
            const avg = totals.reduce(function (a, b) { return a + b; }, 0) / totals.length;
            findings.push({ metric: 'scoreData.total', latest: totals[0], average: Math.round(avg * 10) / 10, sampleSize: totals.length });
        }
    }

    // --- Correlations and regression (profound statistics) ---
    if (points.length >= MIN_SAMPLE) {
        const getScore = (p) => (p.scoreData && p.scoreData.total != null) ? p.scoreData.total : null;
        const getBugs = (p) => (p.sonarMeasures && p.sonarMeasures.bugs != null) ? p.sonarMeasures.bugs : null;
        const getCodeSmells = (p) => (p.sonarMeasures && p.sonarMeasures.code_smells != null) ? p.sonarMeasures.code_smells : null;
        const getEslintErrors = (p) => (p.eslintMeasures && p.eslintMeasures.errorCount != null) ? p.eslintMeasures.errorCount : null;
        const getTotalTokens = (p) => (p.tokenUsage && p.tokenUsage.totalTokens != null) ? p.tokenUsage.totalTokens : null;
        const getPlanDev = (p) => (p.projectProgressMeasures && p.projectProgressMeasures.planDeviation != null) ? p.projectProgressMeasures.planDeviation : null;
        const getCompDebt = (p) => (p.antipatternBreakdown && p.antipatternBreakdown.comprehensionDebt && p.antipatternBreakdown.comprehensionDebt.risk0To100 != null) ? p.antipatternBreakdown.comprehensionDebt.risk0To100 : null;

        // Correlation: awareness score vs code quality (negative = lower score correlates with more bugs)
        const scoreBugs = pairedSeries(points, getScore, getBugs);
        if (scoreBugs.xs.length >= MIN_SAMPLE) {
            const r = pearsonCorrelation(scoreBugs.xs, scoreBugs.ys);
            if (r != null && Math.abs(r) >= MIN_CORRELATION) {
                findings.push({
                    type: 'correlation',
                    x: 'scoreData.total',
                    y: 'sonar.bugs',
                    correlation: Math.round(r * 100) / 100,
                    sampleSize: scoreBugs.xs.length,
                    interpretation: r < 0 ? 'Higher awareness score correlates with fewer Sonar bugs.' : 'Higher awareness score correlates with more Sonar bugs.'
                });
            }
        }

        // Correlation: token usage vs ESLint errors
        const tokensEslint = pairedSeries(points, getTotalTokens, getEslintErrors);
        if (tokensEslint.xs.length >= MIN_SAMPLE) {
            const r = pearsonCorrelation(tokensEslint.xs, tokensEslint.ys);
            if (r != null && Math.abs(r) >= MIN_CORRELATION) {
                findings.push({
                    type: 'correlation',
                    x: 'tokenUsage.totalTokens',
                    y: 'eslintMeasures.errorCount',
                    correlation: Math.round(r * 100) / 100,
                    sampleSize: tokensEslint.xs.length,
                    interpretation: r > 0 ? 'Higher token usage correlates with more ESLint errors.' : 'Higher token usage correlates with fewer ESLint errors.'
                });
            }
        }

        // Correlation: awareness score vs ESLint errors
        const scoreEslint = pairedSeries(points, getScore, getEslintErrors);
        if (scoreEslint.xs.length >= MIN_SAMPLE) {
            const r = pearsonCorrelation(scoreEslint.xs, scoreEslint.ys);
            if (r != null && Math.abs(r) >= MIN_CORRELATION) {
                findings.push({
                    type: 'correlation',
                    x: 'scoreData.total',
                    y: 'eslintMeasures.errorCount',
                    correlation: Math.round(r * 100) / 100,
                    sampleSize: scoreEslint.xs.length,
                    interpretation: r < 0 ? 'Higher awareness score correlates with fewer ESLint errors.' : 'Higher awareness score correlates with more ESLint errors.'
                });
            }
        }

        // Correlation: comprehension debt (antipattern) vs Sonar code_smells
        const compSmells = pairedSeries(points, getCompDebt, getCodeSmells);
        if (compSmells.xs.length >= MIN_SAMPLE) {
            const r = pearsonCorrelation(compSmells.xs, compSmells.ys);
            if (r != null && Math.abs(r) >= MIN_CORRELATION) {
                findings.push({
                    type: 'correlation',
                    x: 'antipatternBreakdown.comprehensionDebt.risk0To100',
                    y: 'sonarMeasures.code_smells',
                    correlation: Math.round(r * 100) / 100,
                    sampleSize: compSmells.xs.length,
                    interpretation: r > 0 ? 'Higher comprehension-debt risk correlates with more code smells.' : 'Higher comprehension-debt risk correlates with fewer code smells.'
                });
            }
        }

        // Simple regression: score vs bugs (slope = change in bugs per unit change in score)
        if (scoreBugs.xs.length >= MIN_SAMPLE) {
            const reg = linearRegression(scoreBugs.xs, scoreBugs.ys);
            if (reg && Math.abs(reg.slope) > 0.01) {
                findings.push({
                    type: 'regression',
                    predictor: 'scoreData.total',
                    outcome: 'sonar.bugs',
                    slope: Math.round(reg.slope * 100) / 100,
                    intercept: Math.round(reg.intercept * 10) / 10,
                    sampleSize: reg.sampleSize,
                    interpretation: reg.slope < 0 ? 'Per 1-point increase in awareness score, Sonar bugs decrease by about ' + Math.abs(reg.slope).toFixed(2) + ' on average.' : 'Per 1-point increase in awareness score, Sonar bugs increase by about ' + reg.slope.toFixed(2) + ' on average.'
                });
            }
        }

        // Trends over time (index 0 = oldest)
        const scoreTs = timeSeries(points, getScore);
        if (scoreTs.xs.length >= MIN_SAMPLE) {
            const reg = linearRegression(scoreTs.xs, scoreTs.ys);
            if (reg) {
                const direction = trendDirection(reg.slope, false);
                findings.push({
                    type: 'trend',
                    metric: 'scoreData.total',
                    slope: Math.round(reg.slope * 100) / 100,
                    direction,
                    sampleSize: reg.sampleSize,
                    interpretation: direction === 'improving' ? 'Awareness score is improving over time.' : direction === 'degrading' ? 'Awareness score is degrading over time.' : 'Awareness score is stable over time.'
                });
            }
        }

        const bugsTs = timeSeries(points, getBugs);
        if (bugsTs.xs.length >= MIN_SAMPLE) {
            const reg = linearRegression(bugsTs.xs, bugsTs.ys);
            if (reg) {
                const direction = trendDirection(reg.slope, true);
                findings.push({
                    type: 'trend',
                    metric: 'sonar.bugs',
                    slope: Math.round(reg.slope * 100) / 100,
                    direction,
                    sampleSize: reg.sampleSize,
                    interpretation: direction === 'improving' ? 'Sonar bugs are decreasing over time.' : direction === 'degrading' ? 'Sonar bugs are increasing over time.' : 'Sonar bugs are stable over time.'
                });
            }
        }

        const eslintTs = timeSeries(points, getEslintErrors);
        if (eslintTs.xs.length >= MIN_SAMPLE) {
            const reg = linearRegression(eslintTs.xs, eslintTs.ys);
            if (reg) {
                const direction = trendDirection(reg.slope, true);
                findings.push({
                    type: 'trend',
                    metric: 'eslintMeasures.errorCount',
                    slope: Math.round(reg.slope * 100) / 100,
                    direction,
                    sampleSize: reg.sampleSize,
                    interpretation: direction === 'improving' ? 'ESLint errors are decreasing over time.' : direction === 'degrading' ? 'ESLint errors are increasing over time.' : 'ESLint errors are stable over time.'
                });
            }
        }

        const planTs = timeSeries(points, getPlanDev);
        if (planTs.xs.length >= MIN_SAMPLE) {
            const reg = linearRegression(planTs.xs, planTs.ys);
            if (reg) {
                const direction = trendDirection(reg.slope, true);
                findings.push({
                    type: 'trend',
                    metric: 'projectProgressMeasures.planDeviation',
                    slope: Math.round(reg.slope * 100) / 100,
                    direction,
                    sampleSize: reg.sampleSize,
                    interpretation: direction === 'improving' ? 'Plan deviation is decreasing over time.' : direction === 'degrading' ? 'Plan deviation is increasing over time.' : 'Plan deviation is stable over time.'
                });
            }
        }
    }

    return {
        accepted: true,
        timestamp: (cur && cur.timestamp) ? cur.timestamp : Date.now(),
        pointsUsed: points.length,
        findings: findings.length ? findings : undefined
    };
}

module.exports = { runAnalysis };
