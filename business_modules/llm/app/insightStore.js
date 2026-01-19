/**
 * InsightStore - in-memory store for most recent LLM insights.
 *
 * This is intentionally lightweight:
 * - It provides a semantic risk multiplier for scoring (debt risk amplification).
 * - It does NOT store raw code.
 * - It is safe to drop on restart (ledger is the audit trail).
 */

class InsightStore {
    constructor() {
        this._byFileUri = new Map(); // fileUri -> { insight, ts, batchId }
    }

    record({ fileUri, insight, batchId = null, ts = Date.now() }) {
        if (!fileUri) return;
        if (!insight) return;
        this._byFileUri.set(String(fileUri), { insight, ts, batchId });
    }

    getLatestForFile(fileUri) {
        return this._byFileUri.get(String(fileUri)) || null;
    }

    /**
     * Semantic risk multiplier used by risk-based debt scoring.
     * Returns >= 1.
     *
     * The idea: high-meaningfulness/high-risk changes are more costly to leave unreviewed.
     */
    getSemanticRiskMultiplier(fileUri) {
        const entry = this.getLatestForFile(fileUri);
        if (!entry?.insight) return 1;

        const { risk, behavior_change, confidence } = entry.insight;
        const c = typeof confidence === 'number' ? confidence : 0;

        // Low confidence => don't amplify much.
        const confidenceMultiplier = 1 + (Math.min(Math.max(c, 0), 1) * 0.25); // 1..1.25

        let riskMultiplier = 1;
        if (risk === 'medium') riskMultiplier = 1.25;
        if (risk === 'high') riskMultiplier = 1.6;

        // If likely behavioral change, amplify slightly more.
        const behaviorMultiplier = behavior_change === 'yes' ? 1.15 : 1.0;

        return riskMultiplier * behaviorMultiplier * confidenceMultiplier;
    }
}

module.exports = InsightStore;

