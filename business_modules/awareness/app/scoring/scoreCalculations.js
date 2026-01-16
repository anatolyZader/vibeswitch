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
 * High score = user carefully reviewed code
 * @param {Array<Suggestion>} suggestions - Array of suggestions
 * @returns {number} Review score (0-40)
 */
function calculateReviewScore(suggestions) {
    if (!suggestions || suggestions.length === 0) return 0;

    const reviewedCount = suggestions.filter(s => s.reviewed).length;
    const totalReviewTime = suggestions.reduce((sum, s) => sum + (s.reviewTime || 0), 0);
    const avgReviewTime = totalReviewTime / suggestions.length;
    
    // Review rate (0-20): % of suggestions reviewed
    const reviewRate = (reviewedCount / suggestions.length) * 20;
    
    // Review depth (0-20): Average time spent reviewing
    // Good: 10+ seconds per suggestion = 20 points
    // Fair: 5-10 seconds = 10-20 points
    // Poor: <5 seconds = 0-10 points
    const reviewDepth = Math.min((avgReviewTime / 10000) * 20, 20);
    
    return Math.round(reviewRate + reviewDepth);
}

/**
 * Calculate critical evaluation score (0-30)
 * High score = user is selective (accepts some, rejects some)
 * LOW SCORE = GOOD in DEV mode (means careful, not blind acceptance)
 * @param {Array<Suggestion>} suggestions - Array of suggestions
 * @returns {number} Critical score (0-30)
 */
function calculateCriticalScore(suggestions) {
    if (!suggestions || suggestions.length === 0) return 0;

    const accepted = suggestions.filter(s => s.status === 'accepted').length;
    const rejected = suggestions.filter(s => s.status === 'rejected').length;
    const total = suggestions.length;
    
    const acceptRate = accepted / total;
    const rejectRate = rejected / total;
    
    // INVERTED: In DEV mode, blind acceptance = HIGH score (bad)
    // We want LOW scores (careful review, selective acceptance)
    
    if (acceptRate === 1.0) {
        // Accepts everything blindly - WORST (high score = bad in DEV)
        return 30;
    } else if (rejectRate === 1.0) {
        // Rejects everything (not using AI effectively)
        return 20;
    } else if (acceptRate >= 0.6 && acceptRate <= 0.8) {
        // Moderate acceptance - not great, not terrible
        return 15;
    } else if (acceptRate < 0.5) {
        // Low acceptance rate = careful review = BEST
        return 0;
    } else {
        // Linear interpolation for other cases
        return Math.round(acceptRate * 30);
    }
}

/**
 * Calculate adaptation score (0-30)
 * High score = user customizes AI suggestions
 * @param {Array<Suggestion>} suggestions - Array of suggestions
 * @returns {number} Adaptation score (0-30)
 */
function calculateAdaptationScore(suggestions) {
    if (!suggestions || suggestions.length === 0) return 0;

    const adapted = suggestions.filter(s => s.status === 'adapted').length;
    const adaptRate = adapted / suggestions.length;
    
    // Average edits per suggestion
    const totalEdits = suggestions.reduce((sum, s) => sum + (s.editCount || 0), 0);
    const avgEdits = totalEdits / suggestions.length;
    
    // Adaptation rate (0-15): % of suggestions user edited
    const adaptationRate = adaptRate * 15;
    
    // Adaptation depth (0-15): How much editing per suggestion
    // Good: 2+ edits = 15 points
    // Fair: 1 edit = 7.5 points
    // Poor: 0 edits = 0 points
    const adaptationDepth = Math.min((avgEdits / 2) * 15, 15);
    
    return Math.round(adaptationRate + adaptationDepth);
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
        
        // Base risk: footprint (total changes) and file criticality
        const footprint = fileDebt.totalChanges || 0;
        const baseRisk = Math.min((footprint / 1000) * fileCriticality, 5); // Cap at 5 per file
        
        // Age multiplier (older = higher risk)
        const ageHours = (now - (fileDebt.modifiedAt || now)) / (1000 * 60 * 60);
        const ageMultiplier = 1 + Math.min(ageHours * 0.1, 1.0); // Max 2x multiplier
        
        const fileDebtValue = baseRisk * ageMultiplier;
        totalDebt += fileDebtValue;
    }

    // Calculate suggestion-level debt (risk-based)
    for (const suggestion of pending) {
        const fileUri = suggestion.document || '';
        const fileCriticality = getFileCriticality(fileUri);
        
        // Base risk: footprint (size), scatter (rangeCount), and file criticality
        const footprint = suggestion.size || 0;
        const scatter = suggestion.rangeCount || 1;
        const baseRisk = Math.min(
            ((footprint / 500) + (scatter / 10)) * fileCriticality,
            3 // Cap at 3 per suggestion
        );
        
        // Provenance multiplier: AI-likelihood increases risk
        const provenanceScore = suggestion.provenanceScore || suggestion.classificationConfidence || 0.5;
        const provenanceMultiplier = 1 + (alpha * provenanceScore);
        
        // Verification penalty: lack of verification increases debt
        const hasVerification = suggestion.hasVerification ? suggestion.hasVerification() : false;
        const verificationPenalty = hasVerification ? 0.5 : 1.0;
        
        // Age multiplier (older = higher risk)
        const ageHours = (now - (suggestion.timestamp || now)) / (1000 * 60 * 60);
        const ageMultiplier = 1 + Math.min(ageHours * 0.1, 1.0); // Max 2x multiplier
        
        const suggestionDebt = baseRisk * provenanceMultiplier * verificationPenalty * ageMultiplier;
        totalDebt += suggestionDebt;
    }

    // Normalize to 0-30 range
    return Math.round(Math.min(totalDebt, 30));
}

module.exports = {
    calculateReviewScore,
    calculateCriticalScore,
    calculateAdaptationScore,
    calculateDebtScore, // Legacy: count-based approach (backward compatible)
    calculateRiskBasedDebtScore // New: risk-based approach (research-aligned)
};



// ============================================================================
