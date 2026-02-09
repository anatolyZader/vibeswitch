/**
 * CargoCultDetector - High AI contribution, no inspection/evidence, minimal edits => cargo cult risk.
 * Complements existing blind acceptance score; weight by criticality when available.
 */

const COMPOSITE_WINDOW_MS = 15 * 60 * 1000;
const AI_COUNT_THRESHOLD = 2;
const MIN_EDITS_FOR_SAFE = 1;

function isAcceptedOrAdapted(s) {
    return s && (s.status === 'accepted' || s.status === 'adapted' ||
        s.status === 'fully_accepted' || s.status === 'partially_accepted');
}

/**
 * Compute cargo cult risk from suggestions and optional sessions (sync).
 * @param {Object} ctx - { suggestions: Array<Suggestion>, sessions?: Array<{ aiEventCount: number, humanEditCount: number }> }
 * @returns {{ risk0To100: number, highBlindAcceptSessions: number, missingEvidenceCount: number }}
 */
function compute(ctx) {
    const suggestions = ctx.suggestions || [];
    const sessions = ctx.sessions || [];

    const now = Date.now();
    const recent = suggestions.filter(s => (now - (s.timestamp || 0)) <= COMPOSITE_WINDOW_MS);
    const accepted = recent.filter(isAcceptedOrAdapted);
    const withoutVerification = accepted.filter(s => !(s.hasVerification && s.hasVerification()));
    const withoutEdit = accepted.filter(s => !(s.userEdited || (s.editCount || 0) >= MIN_EDITS_FOR_SAFE));

    const missingEvidenceCount = withoutVerification.length;
    let highBlindAcceptSessions = 0;
    for (const sess of sessions) {
        const ai = sess.aiEventCount || 0;
        const human = sess.humanEditCount || 0;
        if (ai >= AI_COUNT_THRESHOLD && human < MIN_EDITS_FOR_SAFE) {
            highBlindAcceptSessions++;
        }
    }

    const riskFromAccept = accepted.length > 0
        ? Math.min(100, Math.round((withoutVerification.length / accepted.length) * 50))
        : 0;
    const riskFromEdit = accepted.length > 0
        ? Math.min(100, Math.round((withoutEdit.length / accepted.length) * 50))
        : 0;
    const riskFromSessions = Math.min(100, highBlindAcceptSessions * 25);
    const risk0To100 = Math.min(100, riskFromAccept + riskFromEdit * 0.5 + riskFromSessions * 0.5);

    return {
        risk0To100,
        highBlindAcceptSessions,
        missingEvidenceCount
    };
}

module.exports = {
    compute
};
