/**
 * ScoreCalculationServiceD - Domain service for calculating awareness score components
 * 
 * Encapsulates pure domain business logic for calculating score components.
 * This is a stateless domain service - no ports, no state, no orchestration.
 * 
 * Orchestration (time filtering, callbacks, state management) is in app layer.
 */

class ScoreCalculationServiceD {
    constructor() {
        // No constructor dependencies - stateless domain service
    }

    /**
     * Calculate review score (0-40)
     * High score = user carefully reviewed code
     * @param {Array<Suggestion>} suggestions - Array of suggestions
     * @returns {number} Review score (0-40)
     */
    calculateReviewScore(suggestions) {
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
    calculateCriticalScore(suggestions) {
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
    calculateAdaptationScore(suggestions) {
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
}

module.exports = ScoreCalculationServiceD;
