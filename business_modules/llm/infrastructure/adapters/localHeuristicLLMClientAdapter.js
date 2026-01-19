/**
 * LocalHeuristicLLMClientAdapter
 *
 * A "local" provider that does NOT call external APIs.
 * It returns deterministic, structured insights based on heuristics + file path keywords.
 *
 * This enables the LLM pipeline and scoring integration to function without network access.
 */

class LocalHeuristicLLMClientAdapter {
    async analyzeBatch({ prompt }) {
        // Prompt is JSON; parse best-effort.
        let payload;
        try {
            payload = JSON.parse(prompt);
        } catch {
            payload = null;
        }

        const file = payload?.input?.file || '';
        const metrics = payload?.input?.metrics || {};
        const label = payload?.input?.classification?.label || 'unknown';
        const diffBullets = payload?.input?.diff_bullets || [];

        const inserted = Number(metrics.inserted || 0);
        const deleted = Number(metrics.deleted || 0);
        const lineSpan = Number(metrics.lineSpan || 0);
        const distinctRangeCount = Number(metrics.distinctRangeCount || 0);

        // Intent heuristic
        const bulletsText = Array.isArray(diffBullets) ? diffBullets.join(' ').toLowerCase() : '';
        let intent = 'unknown';
        if (/\bfix\b|\bbug\b|\bnull\b|\bundefined\b|\bcrash\b/.test(bulletsText)) intent = 'bugfix';
        else if (/\brefactor\b|\brename\b|\bextract\b|\bcleanup\b/.test(bulletsText)) intent = 'refactor';
        else if (/\badd\b|\bcreate\b|\bnew\b|\bimplement\b/.test(bulletsText)) intent = 'feature';
        else if (/\bchore\b|\blint\b|\bformat\b/.test(bulletsText)) intent = 'chore';

        // Risk heuristic
        const lowerPath = String(file).toLowerCase();
        const touchesCriticalArea = /(auth|payment|billing|money|crypto|token|permission|security|session|oauth|jwt)/.test(lowerPath);
        const bigChange = (inserted + deleted) > 600 || lineSpan > 80;
        const scattered = distinctRangeCount > 5;

        let risk = 'low';
        if (touchesCriticalArea) risk = 'high';
        else if (bigChange || scattered) risk = 'medium';

        // Behavior change heuristic: assume uncertain unless signals say otherwise.
        let behavior_change = 'uncertain';
        if (intent === 'refactor' && !bigChange) behavior_change = 'no';
        if (intent === 'feature' || intent === 'bugfix') behavior_change = 'yes';

        const risk_factors = [];
        if (touchesCriticalArea) risk_factors.push('critical subsystem');
        if (bigChange) risk_factors.push('large diff footprint');
        if (scattered) risk_factors.push('scattered edits');
        if (label === 'ai') risk_factors.push('ai-labeled batch');

        const recommended_checks = [];
        if (risk !== 'low') {
            recommended_checks.push('run tests for affected module');
        }
        if (touchesCriticalArea) {
            recommended_checks.push('verify auth/permission edge-cases');
        }
        if (behavior_change === 'yes') {
            recommended_checks.push('add or update test covering behavior change');
        }
        if (label === 'ai') {
            recommended_checks.push('review diff carefully before accepting');
        }

        // Confidence: deterministic but conservative.
        const confidence = risk === 'high' ? 0.7 : risk === 'medium' ? 0.55 : 0.45;

        return {
            intent,
            risk,
            risk_factors,
            behavior_change,
            recommended_checks,
            confidence,
            explanation: 'local provider: deterministic heuristics (no external API)'
        };
    }
}

module.exports = LocalHeuristicLLMClientAdapter;

