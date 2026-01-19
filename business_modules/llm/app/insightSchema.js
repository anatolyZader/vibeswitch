/**
 * Insight schema + validator/normalizer
 *
 * We only accept structured JSON-like output. No free-form prose is consumed by the pipeline.
 */

const ALLOWED_INTENTS = new Set(['bugfix', 'feature', 'refactor', 'chore', 'unknown']);
const ALLOWED_RISKS = new Set(['low', 'medium', 'high']);
const ALLOWED_BEHAVIOR = new Set(['yes', 'no', 'uncertain']);

function toStringSafe(v) {
    if (v === null || v === undefined) return '';
    return String(v);
}

function toNumberSafe(v, fallback = 0) {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}

function uniqStrings(arr, max = 20) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    const seen = new Set();
    for (const item of arr) {
        const s = toStringSafe(item).trim();
        if (!s) continue;
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(s);
        if (out.length >= max) break;
    }
    return out;
}

/**
 * Normalize an arbitrary object into an InsightBundle.
 * Returns null if the object is too malformed to use.
 */
function normalizeInsight(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const intentRaw = toStringSafe(raw.intent).trim().toLowerCase() || 'unknown';
    const riskRaw = toStringSafe(raw.risk).trim().toLowerCase() || 'low';
    const behaviorRaw = toStringSafe(raw.behavior_change).trim().toLowerCase() || 'uncertain';

    const intent = ALLOWED_INTENTS.has(intentRaw) ? intentRaw : 'unknown';
    const risk = ALLOWED_RISKS.has(riskRaw) ? riskRaw : 'low';
    const behavior_change = ALLOWED_BEHAVIOR.has(behaviorRaw) ? behaviorRaw : 'uncertain';

    const confidence = clamp01(toNumberSafe(raw.confidence, 0));

    const risk_factors = uniqStrings(raw.risk_factors, 10);
    const recommended_checks = uniqStrings(raw.recommended_checks, 10);

    // Keep it purely data. No raw code. Small explanatory text is okay but optional.
    const explanation = toStringSafe(raw.explanation || raw.summary).trim().slice(0, 280);

    return {
        intent,
        risk,
        risk_factors,
        behavior_change,
        recommended_checks,
        confidence,
        explanation
    };
}

module.exports = {
    normalizeInsight,
    INSIGHT_SCHEMA: {
        intent: 'bugfix|feature|refactor|chore|unknown',
        risk: 'low|medium|high',
        risk_factors: 'string[]',
        behavior_change: 'yes|no|uncertain',
        recommended_checks: 'string[]',
        confidence: '0..1',
        explanation: 'string (optional)'
    }
};

