// FILE 8/14: app/scoreCalculations.js
// ============================================================================

/**
 * Score Calculations - Pure functions for calculating awareness score components
 * 
 * Moved from domain layer - these are pure calculations, not invariant protectors.
 * No state, no dependencies, just pure business logic functions.
 */

/**
 * Calculate review score (0-40)
 * High score = user carefully reviewed code (GOOD)
 * 
 * NOTE: This returns a "good" score (higher = better). 
 * It will be converted to risk (inverted) before summing in the risk calculation.
 * 
 * @param {Array<Suggestion>} suggestions - Array of suggestions
 * @returns {number} Review score (0-40, higher = better)
 */
function calculateReviewScore(suggestions) {
    // Guard: empty input returns 0
    if (!Array.isArray(suggestions) || suggestions.length === 0) return 0;

    const reviewedCount = suggestions.filter(s => s.reviewed).length;
    
    // Review rate (0-20): % of suggestions reviewed
    const reviewRate = (reviewedCount / suggestions.length) * 20;
    
    // Review depth (0-20): Time spent per 1000 characters (size-aware)
    // FIXED: Use reviewed suggestions only, not total size (prevents gaming)
    // This prevents gaming: reviewing only tiny suggestions shouldn't give depth credit
    const reviewed = suggestions.filter(s => s.reviewed);
    const reviewedSize = reviewed.reduce((sum, s) => sum + (s.size || 0), 0);
    const reviewedTime = reviewed.reduce((sum, s) => sum + (s.reviewTime || 0), 0);
    
    // Calculate depth over reviewed suggestions only
    // FIXED: Add minimum size gate to prevent tiny-size loophole (review 5 chars for 5 seconds → decent depth)
    const MIN_REVIEWED_SIZE = 200; // Minimum characters reviewed to count depth (prevents gaming)
    const reviewedSizeInKChars = Math.max(reviewedSize / 1000, 0.1); // Avoid division by zero, min 0.1k
    const reviewSecondsPerKChar = reviewedSize > 0 ? (reviewedTime / 1000) / reviewedSizeInKChars : 0;
    
    // Use configurable target (TARGET_SEC_PER_KCHAR) for calibration
    // FIXED: Non-linear saturating function to prevent "farming" depth by hovering longer
    // Uses exponential saturation: depth = 20 * (1 - Math.exp(-secPerKChar / TARGET))
    // This saturates quickly, making it harder to game by just spending more time
    // FIXED: Gate depth on minimum reviewed size to prevent tiny-size loophole
    const reviewDepth = reviewedSize >= MIN_REVIEWED_SIZE && reviewSecondsPerKChar > 0
        ? 20 * (1 - Math.exp(-reviewSecondsPerKChar / TARGET_SEC_PER_KCHAR))
        : 0;
    
    // Bonus: Reviewed + decision made (accepted/rejected/adapted)
    // Penalize "reviewed" that never results in a decision (can be noise)
    // FIXED: Use Set for proper status checking (was buggy: 'rejected' || 'adapted' always truthy)
    // FIXED: Use effectiveReviewed helper for consistency
    const resolvedStatuses = new Set(['accepted', 'rejected', 'adapted']);
    const resolvedAfterReview = suggestions.filter(s => 
        isEffectivelyReviewed(s) && resolvedStatuses.has(s.status)
    ).length;
    const reviewedButUnresolved = reviewedCount - resolvedAfterReview;
    
    // FIXED: Allow negative values (clamp -5 to +5, not just max(0, ...))
    const resolutionBonus = Math.max(-5, Math.min(5, 
        (resolvedAfterReview / suggestions.length) * 5 - (reviewedButUnresolved / suggestions.length) * 5
    ));
    
    // FIXED: Clamp final reviewScore to 0-40 range (prevents NaN/Infinity/negative from bubbling into EMA)
    const rawScore = reviewRate + reviewDepth + resolutionBonus;
    return Math.max(0, Math.min(40, Math.round(rawScore)));
}

/**
 * Calculate blind acceptance risk score (0-30)
 * High score = user accepts AI suggestions WITHOUT REVIEW (BAD - compliance risk)
 * 
 * Redefined to measure "accepted without review" instead of just acceptance rate.
 * This properly distinguishes:
 * - Accepted without review = high risk (blind acceptance)
 * - Accepted after review = mild risk or neutral (careful acceptance)
 * - Adapted = reduces risk (mitigation, shows engagement)
 * 
 * @param {Array<Suggestion>} suggestions - Array of suggestions
 * @returns {number} Blind acceptance risk score (0-30, higher = worse)
 */
function calculateBlindAcceptanceScore(suggestions) {
    if (!suggestions || suggestions.length === 0) return 0;

    const resolved = suggestions.filter(s => 
        s.status === 'accepted' || s.status === 'rejected' || s.status === 'adapted'
    );
    
    if (resolved.length === 0) return 0; // No resolved suggestions = no risk data
    
    const total = resolved.length;
    
    // Key distinction: accepted WITHOUT effective review vs accepted AFTER effective review
    // FIXED: Use effectiveReviewed helper for consistency (eliminates "reviewed=true but 0ms" drift)
    const acceptedWithoutReview = resolved.filter(s => 
        s.status === 'accepted' && !isEffectivelyReviewed(s)
    ).length;
    
    const acceptedAfterReview = resolved.filter(s => 
        s.status === 'accepted' && isEffectivelyReviewed(s)
    ).length;
    
    // FIXED: Require effective review for adapted mitigation (makes "adaptation reduces blind risk" defensible)
    const adapted = resolved.filter(s => s.status === 'adapted' && isEffectivelyReviewed(s)).length;
    const rejected = resolved.filter(s => s.status === 'rejected').length;
    
    // Calculate rates (simplified, stable formula)
    const blindRate = acceptedWithoutReview / total;
    const carefulAcceptRate = acceptedAfterReview / total;
    const adaptRate = adapted / total;
    
    // Risk calculation (simplified, stable):
    // - Core: blind acceptance dominates (85% weight), careful acceptance is mild (15% weight)
    // - Mitigation: adaptation reduces risk (up to -6 points, reduced from -10 to avoid double-counting)
    //   Note: Adaptation already has its own component (0.20 weight), so mitigation is capped tighter
    let risk = 30 * Math.min(0.85 * blindRate + 0.15 * carefulAcceptRate, 1.0);
    
    // Mitigation: adaptation reduces risk (cap at -6 points to avoid double-counting with adaptation component)
    risk = Math.max(0, risk - 6 * adaptRate);
    
    // Clamp output to prevent NaN/Infinity/negative from bubbling into EMA
    return Math.max(0, Math.min(30, Math.round(risk)));
}

/**
 * Calculate adaptation score (0-30)
 * High score = user customizes AI suggestions (GOOD)
 * 
 * NOTE: This returns a "good" score (higher = better). 
 * It will be converted to risk (inverted) before summing in the risk calculation.
 * 
 * @param {Array<Suggestion>} suggestions - Array of suggestions
 * @returns {number} Adaptation score (0-30, higher = better)
 */
function calculateAdaptationScore(suggestions) {
    // Guard: empty input returns 0
    if (!Array.isArray(suggestions) || suggestions.length === 0) return 0;

    // FIXED: Base calculation on "accepted surface" (accepted or adapted), not all suggestions
    // This prevents penalizing sessions with many rejections/pending, and aligns with what we measure
    const resolvedAcceptedSurface = suggestions.filter(s => 
        s.status === 'accepted' || s.status === 'adapted'
    );
    
    // Guard: no accepted/adapted = no adaptation data
    if (resolvedAcceptedSurface.length === 0) return 0;
    
    const adapted = resolvedAcceptedSurface.filter(s => s.status === 'adapted');
    const adaptedCount = adapted.length;
    
    // Adaptation rate (0-15): % of accepted/adapted suggestions that were adapted
    const adaptRate = adaptedCount / resolvedAcceptedSurface.length;
    const adaptationRate = adaptRate * 15;
    
    // Adaptation depth (0-15): Average edits per adapted suggestion (not all suggestions)
    // FIXED: Only count edits on adapted suggestions, not all suggestions
    // FIXED: Non-linear saturating function to prevent "farming" depth with many small edits
    const totalEditsOnAdapted = adapted.reduce((sum, s) => sum + (s.editCount || 0), 0);
    const avgEditsPerAdapted = adaptedCount > 0 ? totalEditsOnAdapted / adaptedCount : 0;
    
    // Non-linear saturation: depth = 15 * (1 - exp(-avgEditsPerAdapted / 2))
    // This prevents farming and allows future swap to "meaningful edits" metric without touching score shape
    const adaptationDepth = 15 * (1 - Math.exp(-avgEditsPerAdapted / 2));
    
    // Clamp output to prevent NaN/Infinity/negative from bubbling into EMA
    const rawScore = adaptationRate + adaptationDepth;
    return Math.max(0, Math.min(30, Math.round(rawScore)));
}

/**
 * Calculate debt score (0-30) - combines file-level and suggestion-level debt
 * 
 * Properly separates:
 * - FileDebt: Unreviewed changes in files (file-level)
 * - SuggestionDebt: Pending AI suggestions (suggestion-level)
 * 
 * @param {Map<string, FileDebt>} fileDebts - Map of file-level debt entities
 * @param {Array<Suggestion>} pendingSuggestions - Pending suggestions (suggestion-level debt)
 * @returns {number} Debt score (0-30)
 */
function calculateDebtScore(fileDebts, pendingSuggestions) {
    if (!fileDebts) fileDebts = new Map();
    if (!pendingSuggestions) pendingSuggestions = [];

    // File-level debt: unreviewed file changes
    const unreviewedFiles = Array.from(fileDebts.values())
        .filter(d => d && !d.isReviewed());

    // Suggestion-level debt: pending AI suggestions (tracked separately)
    const pending = pendingSuggestions.filter(s => s && s.status === 'pending');

    // If no debt at all, return 0
    if (unreviewedFiles.length === 0 && pending.length === 0) {
        return 0;
    }

    const now = Date.now();

    // Calculate debt severity
    let debtScore = 0;

    // 1. Number of unreviewed files (0-10 points)
    debtScore += Math.min(unreviewedFiles.length * 2, 10);

    // 2. Number of pending suggestions (0-10 points)
    debtScore += Math.min(pending.length * 2, 10);

    // 3. Age of oldest unreviewed file OR pending suggestion (0-10 points)
    const fileDebtTimestamps = unreviewedFiles.map(d => d.modifiedAt || now);
    const suggestionDebtTimestamps = pending.map(s => s.timestamp || now);
    const allDebtTimestamps = [...fileDebtTimestamps, ...suggestionDebtTimestamps];

    if (allDebtTimestamps.length > 0) {
        const oldestDebt = Math.min(...allDebtTimestamps);
        const ageHours = (now - oldestDebt) / (1000 * 60 * 60);
        debtScore += Math.min(ageHours * 1.5, 10);
    }

    return Math.round(Math.min(debtScore, 30));
}

/**
 * Calculate age multiplier for debt (piecewise: fast first hour, slower after)
 * Prevents runaway growth while still penalizing stale debt
 * @param {number} ageHours - Age in hours
 * @returns {number} Age multiplier (1.0 to 2.0)
 */
function calculateAgeMultiplier(ageHours) {
    if (ageHours <= 0) return 1.0;
    
    // Piecewise approach:
    // - First hour: fast ramp (0.5x per hour) → 1.5x at 1 hour
    // - After 1 hour: slower ramp (0.1x per hour) → max 2.0x at 6 hours
    if (ageHours <= 1.0) {
        // Fast ramp: 1.0 + (0.5 * ageHours)
        return 1.0 + (0.5 * ageHours);
    } else {
        // Slower ramp: 1.5 + (0.1 * (ageHours - 1)), capped at 2.0
        return Math.min(1.5 + (0.1 * (ageHours - 1)), 2.0);
    }
}

/**
 * Calculate risk-based debt score (0-30) - research-aligned approach
 * 
 * Separates provenance (AI-likelihood) from debt (risk/audit effort).
 * Debt = BaseRisk(footprint, scatter, fileCriticality) × (1 + α × ProvenanceScore) × VerificationPenalty
 * 
 * This is the new approach that aligns with research recommendations.
 * The old calculateDebtScore() is kept for backward compatibility.
 * 
 * @param {Map<string, FileDebt>} fileDebts - Map of file-level debt entities
 * @param {Array<Suggestion>} pendingSuggestions - Pending suggestions (suggestion-level debt)
 * @param {Object} options - Optional configuration
 * @param {number} options.alpha - Provenance multiplier coefficient (default: 0.5)
 * @param {Function} options.getFileCriticality - Function to get file criticality (default: uses fileCriticality utility)
 * @returns {number} Risk-based debt score (0-30)
 */
function calculateRiskBasedDebtScore(fileDebts, pendingSuggestions, options = {}) {
    if (!fileDebts) fileDebts = new Map();
    if (!pendingSuggestions) pendingSuggestions = [];

    const alpha = options.alpha !== undefined ? options.alpha : 0.5;
    const getFileCriticality = options.getFileCriticality || (() => {
        const { getFileCriticality: defaultGetFileCriticality } = require('../utilities/fileCriticality');
        return defaultGetFileCriticality;
    })();
    const getSemanticRiskMultiplier = typeof options.getSemanticRiskMultiplier === 'function'
        ? options.getSemanticRiskMultiplier
        : (() => 1);

    // File-level debt: unreviewed file changes
    const unreviewedFiles = Array.from(fileDebts.values())
        .filter(d => d && !d.isReviewed());

    // Suggestion-level debt: pending AI suggestions (tracked separately)
    const pending = pendingSuggestions.filter(s => s && s.status === 'pending');

    // If no debt at all, return 0
    if (unreviewedFiles.length === 0 && pending.length === 0) {
        return 0;
    }

    const now = Date.now();
    let totalDebt = 0;

    // Calculate file-level debt (risk-based)
    for (const fileDebt of unreviewedFiles) {
        const fileUri = fileDebt.fileUri || fileDebt.path || '';
        const fileCriticality = getFileCriticality(fileUri);
        const semanticMultiplier = getSemanticRiskMultiplier(fileUri, { kind: 'fileDebt', fileDebt }) || 1;
        
        // Base risk: footprint (total changes) and file criticality
        const footprint = fileDebt.totalChanges || 0;
        const baseRisk = Math.min(((footprint / 1000) * fileCriticality) * semanticMultiplier, 6); // Cap per file (slightly higher with semantic multiplier)
        
        // Age multiplier (piecewise: fast first hour, slower after)
        const ageHours = (now - (fileDebt.modifiedAt || now)) / (1000 * 60 * 60);
        const ageMultiplier = calculateAgeMultiplier(ageHours);
        
        const fileDebtValue = baseRisk * ageMultiplier;
        totalDebt += fileDebtValue;
    }

    // Calculate suggestion-level debt (risk-based)
    for (const suggestion of pending) {
        const fileUri = suggestion.document || '';
        const fileCriticality = getFileCriticality(fileUri);
        const semanticMultiplier = getSemanticRiskMultiplier(fileUri, { kind: 'suggestion', suggestion }) || 1;
        
        // Base risk: footprint (size), scatter (rangeCount), and file criticality
        // FIXED: Use sqrt for scatter to reduce outliers from multi-range edits
        const footprint = suggestion.size || 0;
        const scatter = suggestion.rangeCount || 0; // Default to 0, not 1
        // Scatter term: sqrt to reduce impact of outliers (multi-cursor edits can spike rangeCount)
        // FIXED: Guard for undefined/0 - sqrt(0)=0, ensure scatter defaults consistently
        const scatterTerm = Math.sqrt(Math.max(scatter, 0)) / 3; // Tunable: adjust divisor to calibrate
        const baseRisk = Math.min(
            (((footprint / 500) + scatterTerm) * fileCriticality) * semanticMultiplier,
            3 // Cap at 3 per suggestion
        );
        
        // Provenance multiplier: AI-likelihood increases risk
        // Only apply when provenance is confidently AI (>0.7), otherwise it amplifies noise
        // FIXED: Use ?? instead of || to handle provenanceScore=0 correctly (|| would coerce 0 to 0.5)
        const provenanceScore = suggestion.provenanceScore ?? suggestion.classificationConfidence ?? 0.5;
        const provenanceMultiplier = provenanceScore > 0.7 
            ? 1 + (alpha * provenanceScore) 
            : 1.0; // No amplification for uncertain/low-confidence classifications
        
        // Verification penalty: lack of verification increases debt
        const hasVerification = suggestion.hasVerification ? suggestion.hasVerification() : false;
        const verificationPenalty = hasVerification ? 0.5 : 1.0;
        
        // Age multiplier (piecewise: fast first hour, slower after)
        const ageHours = (now - (suggestion.timestamp || now)) / (1000 * 60 * 60);
        const ageMultiplier = calculateAgeMultiplier(ageHours);
        
        const suggestionDebt = baseRisk * provenanceMultiplier * verificationPenalty * ageMultiplier;
        totalDebt += suggestionDebt;
    }

    // Clamp output to prevent NaN/Infinity/negative from bubbling into EMA
    return Math.max(0, Math.min(30, Math.round(totalDebt)));
}

module.exports = {
    calculateReviewScore,
    calculateBlindAcceptanceScore,
    calculateAdaptationScore,
    calculateDebtScore, // Legacy: count-based approach (backward compatible)
    calculateRiskBasedDebtScore // New: risk-based approach (research-aligned)
};



// ============================================================================
