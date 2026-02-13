/**
 * StatisticalAnalyzer: Pearson correlation and simple linear regression.
 * Heuristic method selection based on data shape.
 */

const MIN_SAMPLE_SIZE = 5;

function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const sqDiffs = arr.map((x) => (x - m) * (x - m));
    return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (arr.length - 1));
}

function pearsonCorrelation(x, y) {
    if (x.length !== y.length || x.length < MIN_SAMPLE_SIZE) return null;
    const n = x.length;
    const mx = mean(x);
    const my = mean(y);
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (let i = 0; i < n; i++) {
        const dx = x[i] - mx;
        const dy = y[i] - my;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    if (den === 0) return null;
    return num / den;
}

/**
 * Two-tailed p-value for Pearson r using t-test: t = r * sqrt((n-2)/(1-r^2))
 * @param {number} r - Correlation coefficient
 * @param {number} n - Sample size
 * @returns {number} Approximate p-value
 */
function correlationPValue(r, n) {
    if (n < 3 || Math.abs(r) >= 1) return 1;
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    const df = n - 2;
    return 2 * (1 - studentTCDF(Math.abs(t), df));
}

/**
 * Approximate Student t CDF (simplified)
 */
function studentTCDF(t, df) {
    if (t <= 0) return 0;
    if (df <= 0) return 0.5;
    const x = df / (df + t * t);
    return 1 - 0.5 * incompleteBeta(x, df / 2, 0.5);
}

function incompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = x === 0 || x === 1 ? 0 : Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) {
        return (bt * continuedFraction(x, a, b)) / a;
    }
    return 1 - (bt * continuedFraction(1 - x, b, a)) / b;
}

function logGamma(z) {
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    z -= 1;
    let x = 0.99999999999980993;
    const cof = [
        676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    for (let i = 0; i < 8; i++) x += cof[i] / (z + i + 1);
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function continuedFraction(x, a, b) {
    const maxIter = 200;
    const eps = 3e-7;
    let m = 1;
    let aa, del, qab, qap, qam;
    qab = a + b;
    qap = a + 1;
    qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    let h = d;
    for (let i = 1; i <= maxIter; i++) {
        const m2 = 2 * m;
        aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        h *= d * c;
        aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        del = d * c;
        h *= del;
        if (Math.abs(del - 1) < eps) break;
        m++;
    }
    return h;
}

function simpleLinearRegression(x, y) {
    if (x.length !== y.length || x.length < MIN_SAMPLE_SIZE) return null;
    const n = x.length;
    const mx = mean(x);
    const my = mean(y);
    let ssx = 0;
    let ssxy = 0;
    for (let i = 0; i < n; i++) {
        const dx = x[i] - mx;
        const dy = y[i] - my;
        ssx += dx * dx;
        ssxy += dx * dy;
    }
    if (ssx === 0) return null;
    const b = ssxy / ssx;
    const a = my - b * mx;

    let ssr = 0;
    let sst = 0;
    for (let i = 0; i < n; i++) {
        const pred = a + b * x[i];
        ssr += (pred - my) * (pred - my);
        sst += (y[i] - my) * (y[i] - my);
    }
    const r2 = sst > 0 ? ssr / sst : 0;

    const se = Math.sqrt(sst > 0 ? (sst - ssr) / (n - 2) : 0);
    const seB = ssx > 0 ? se / Math.sqrt(ssx) : 0;
    const tStat = seB > 0 ? Math.abs(b) / seB : 0;
    const pValue = n > 2 ? 2 * (1 - studentTCDF(tStat, n - 2)) : 1;

    return { a, b, r2, pValue, equation: `y = ${a.toFixed(4)} + ${b.toFixed(4)} * x` };
}

/**
 * Pivot time-series rows by measure_name. Each measure gets array of values (one per timestamp).
 * For correlation we need aligned pairs: use timestamps where both measures have values.
 */
function pivotByMeasure(rows) {
    const byTs = new Map();
    for (const r of rows) {
        if (!byTs.has(r.timestamp)) byTs.set(r.timestamp, {});
        byTs.get(r.timestamp)[r.measure_name] = r.value;
    }
    const timestamps = [...byTs.keys()].sort();
    const measures = new Set();
    for (const ts of timestamps) {
        Object.keys(byTs.get(ts)).forEach((m) => measures.add(m));
    }
    const byMeasure = {};
    for (const m of measures) {
        byMeasure[m] = timestamps.map((ts) => byTs.get(ts)[m]);
    }
    return { timestamps, byMeasure };
}

/**
 * @param {Array<{ timestamp: string, measure_name: string, value: number }>} rows
 * @returns {Array<{ method: string, design: string, equations: string, findings: string, pValues: object, xMeasure?: string, yMeasure?: string }>}
 */
function analyze(rows) {
    const results = [];
    if (!rows || rows.length < MIN_SAMPLE_SIZE) {
        return [{ method: 'none', design: 'Insufficient data', equations: '', findings: 'Sample size < ' + MIN_SAMPLE_SIZE, pValues: {} }];
    }

    const { byMeasure } = pivotByMeasure(rows);
    const measureNames = Object.keys(byMeasure);
    const validMeasures = measureNames.filter((m) => byMeasure[m].length >= MIN_SAMPLE_SIZE);

    if (validMeasures.length < 2) {
        return [{ method: 'none', design: 'Need at least 2 measures with enough data', equations: '', findings: 'Measures: ' + validMeasures.join(', '), pValues: {} }];
    }

    for (let i = 0; i < validMeasures.length; i++) {
        for (let j = i + 1; j < validMeasures.length; j++) {
            const xName = validMeasures[i];
            const yName = validMeasures[j];
            const xRaw = byMeasure[xName];
            const yRaw = byMeasure[yName];
            const xArr = [];
            const yArr = [];
            for (let k = 0; k < xRaw.length; k++) {
                if (xRaw[k] != null && yRaw[k] != null && !Number.isNaN(xRaw[k]) && !Number.isNaN(yRaw[k])) {
                    xArr.push(xRaw[k]);
                    yArr.push(yRaw[k]);
                }
            }
            const n = xArr.length;
            if (n < MIN_SAMPLE_SIZE) continue;

            const r = pearsonCorrelation(xArr, yArr);
            if (r != null) {
                const pCorr = correlationPValue(r, n);
                const reg = simpleLinearRegression(xArr, yArr);
                results.push({
                    method: 'correlation_regression',
                    design: `Pearson correlation and simple linear regression: ${xName} vs ${yName}`,
                    equations: reg ? reg.equation : `r = ${r.toFixed(4)}`,
                    findings: `r = ${r.toFixed(4)} (p = ${pCorr.toFixed(4)}); n = ${n}` + (reg ? `; R² = ${reg.r2.toFixed(4)}` : ''),
                    pValues: { correlation: pCorr, regression: reg ? reg.pValue : null },
                    xMeasure: xName,
                    yMeasure: yName
                });
            }
        }
    }

    if (results.length === 0) {
        results.push({ method: 'none', design: 'No valid pairs', equations: '', findings: 'Could not compute pairwise correlations', pValues: {} });
    }
    return results;
}

module.exports = {
    analyze,
    pearsonCorrelation,
    simpleLinearRegression,
    correlationPValue,
    pivotByMeasure
};
