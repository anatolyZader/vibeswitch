/**
 * Evidence - Value object for per-change/batch evidence (tests, lint, trace, spec, rationale).
 * Suggestion.verificationSignals remain the primary in-memory signal for verification debt;
 * this shape is used for optional evidence registry keyed by batchId and extended detectors.
 */

/**
 * Create an empty evidence shape (all optional fields null/false).
 * @returns {EvidenceShape}
 */
function createEmpty() {
    return {
        tests_run: null,
        lint: null,
        trace_log_added: false,
        spec_link: false,
        explain_back: null
    };
}

/**
 * Merge partial evidence into a base shape (does not mutate; returns new object).
 * @param {EvidenceShape} base
 * @param {Partial<EvidenceShape>} partial
 * @returns {EvidenceShape}
 */
function merge(base, partial) {
    const out = { ...base };
    if (partial && typeof partial === 'object') {
        if (partial.tests_run !== undefined) out.tests_run = partial.tests_run;
        if (partial.lint !== undefined) out.lint = partial.lint;
        if (partial.trace_log_added !== undefined) out.trace_log_added = partial.trace_log_added;
        if (partial.spec_link !== undefined) out.spec_link = partial.spec_link;
        if (partial.explain_back !== undefined) out.explain_back = partial.explain_back;
    }
    return out;
}

/**
 * Check if evidence has any non-empty signal (for "has any evidence" gauges).
 * Does not replace Suggestion.hasVerificationSignal() for verification-debt logic.
 * @param {EvidenceShape} evidence
 * @returns {boolean}
 */
function hasAnyEvidence(evidence) {
    if (!evidence || typeof evidence !== 'object') return false;
    if (evidence.tests_run != null && typeof evidence.tests_run === 'object') return true;
    if (evidence.lint != null && typeof evidence.lint === 'object') return true;
    if (evidence.trace_log_added === true) return true;
    if (evidence.spec_link === true) return true;
    if (evidence.explain_back != null && String(evidence.explain_back).trim() !== '') return true;
    return false;
}

module.exports = {
    createEmpty,
    merge,
    hasAnyEvidence
};
