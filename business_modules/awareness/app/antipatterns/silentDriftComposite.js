/**
 * SilentDriftComposite - Composite of boundary, refactor, clone, additive trends => architectural deviation.
 * Baseline comparison (e.g. last 30 vs 90 days) optional; MVP uses current breakdown risks.
 */

const WEIGHTS = {
    boundaryViolations: 0.25,
    refactorAtrophy: 0.2,
    additiveBias: 0.2,
    semanticClones: 0.15,
    iterativeChurn: 0.2
};

/**
 * Compute silent drift from precomputed breakdown (or partial).
 * @param {Object} ctx - { breakdown: Object (keys risk0To100 or value.risk0To100) }
 * @returns {{ risk0To100: number, driftTimeline: Array<{ ts: number, score: number }>, hotspots: string[], rootContributors: string[] }}
 */
function compute(ctx) {
    const breakdown = ctx.breakdown || {};
    const now = Date.now();

    const risk = (key) => {
        const v = breakdown[key];
        if (v == null) return 0;
        if (typeof v === 'object' && 'value' in v && typeof v.value === 'object' && typeof v.value.risk0To100 === 'number') {
            return v.value.risk0To100;
        }
        if (typeof v === 'object' && typeof v.risk0To100 === 'number') return v.risk0To100;
        return 0;
    };

    const boundary = risk('boundaryViolations');
    const refactor = risk('refactorAtrophy');
    const additive = risk('additiveBias');
    const semantic = risk('semanticClones');
    const churn = risk('iterativeChurn');

    const weighted = boundary * WEIGHTS.boundaryViolations
        + refactor * WEIGHTS.refactorAtrophy
        + additive * WEIGHTS.additiveBias
        + semantic * WEIGHTS.semanticClones
        + churn * WEIGHTS.iterativeChurn;
    const risk0To100 = Math.min(100, Math.round(weighted));

    const driftTimeline = [{ ts: now, score: risk0To100 }];
    const rootContributors = [];
    if (boundary >= 30) rootContributors.push('Boundary violations');
    if (refactor >= 30) rootContributors.push('Refactor atrophy');
    if (additive >= 30) rootContributors.push('Additive bias');
    if (semantic >= 30) rootContributors.push('Semantic clones');
    if (churn >= 30) rootContributors.push('Iterative churn');

    const hotspots = [...rootContributors];

    return {
        risk0To100,
        driftTimeline,
        hotspots,
        rootContributors
    };
}

module.exports = {
    compute,
    WEIGHTS
};
