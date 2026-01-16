/**
 * Classification Scorer
 * Accumulates detector scores and determines final classification label and confidence
 * 
 * Moved from domain/utils to app/classification - these are pure functions, not domain logic.
 */

function accumulateScores(detectors) {
    // Fix: Use probabilistic OR instead of additive scoring
    // Formula: combined = 1 - Π(1 - score_i) per label
    // This prevents score inflation from multiple weak signals
    // and is easier to calibrate than additive with capping
    
    const aiScores = [];
    const formatterScores = [];
    const userScores = [];
    
    // Fix: Store reasons as paired objects to prevent misalignment
    // Some detectors may return reason without reasonTag (e.g., marker detection)
    const reasonObjects = [];
    
    // Track contributors for explainable UX
    const contributors = [];
    
    for (const detector of detectors) {
        const result = detector();
        if (!result) continue;
        
        if (result.label === 'formatter') {
            formatterScores.push(result.score);
        } else if (result.label === 'ai') {
            aiScores.push(result.score);
        } else if (result.label === 'user') {
            userScores.push(result.score);
        }
        
        if (result.reason) {
            reasonObjects.push({ tag: result.reasonTag || null, text: result.reason });
        }
        
        // Track contributors for explainability
        if (result.score > 0) {
            contributors.push({
                feature: result.reasonTag || 'unknown',
                score: result.score,
                label: result.label,
                reason: result.reason
            });
        }
    }
    
    // Probabilistic OR: 1 - Π(1 - score_i)
    // If no scores, product is 1, so result is 0 (correct)
    const aiScore = aiScores.length > 0
        ? 1 - aiScores.reduce((product, score) => product * (1 - score), 1)
        : 0;
    
    const formatterScore = formatterScores.length > 0
        ? 1 - formatterScores.reduce((product, score) => product * (1 - score), 1)
        : 0;
    
    const userScore = userScores.length > 0
        ? 1 - userScores.reduce((product, score) => product * (1 - score), 1)
        : 0;
    
    return { aiScore, formatterScore, userScore, reasonObjects, contributors };
}

function determineLabel(aiScore, formatterScore, userScore) {
    let label = 'unknown';
    let confidence = 0;
    
    if (formatterScore > aiScore && formatterScore > userScore && formatterScore > 0.5) {
        label = 'formatter';
        confidence = Math.min(formatterScore, 1.0);
    } else if (aiScore > userScore && aiScore > 0.3) {
        label = 'ai';
        confidence = Math.min(aiScore, 1.0);
    } else if (userScore > 0) {
        // Fix: Only label 'user' when we have positive user evidence
        label = 'user';
        confidence = Math.max(0.3, Math.min(userScore, 1.0));
    } else {
        // Fix: If all scores are 0, return 'unknown' (not 'user')
        // This matches the documented behavior where 'unknown' exists
        label = 'unknown';
        confidence = 0.2;
    }
    
    return { label, confidence };
}

/**
 * Calculate top contributors for explainable UX
 * Returns top 3 features that contributed to the final classification
 * 
 * @param {Array<Object>} contributors - Array of contributor objects from accumulateScores
 * @param {string} finalLabel - Final classification label
 * @param {number} finalScore - Final classification score
 * @returns {Array<Object>} Top contributors with contribution percentages
 */
function getTopContributors(contributors, finalLabel, finalScore) {
    if (!contributors || contributors.length === 0 || !finalScore || finalScore === 0) {
        return [];
    }
    
    // Filter contributors for the final label
    const relevantContributors = contributors
        .filter(c => c.label === finalLabel)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(c => ({
            feature: c.feature,
            contribution: finalScore > 0 ? (c.score / finalScore) : 0,
            score: c.score,
            reason: c.reason
        }));
    
    return relevantContributors;
}

/**
 * Calculate uncertainty level for classification
 * 
 * @param {number} aiScore - AI score
 * @param {number} formatterScore - Formatter score
 * @param {number} userScore - User score
 * @returns {string} Uncertainty level ('low', 'medium', 'high')
 */
function calculateUncertainty(aiScore, formatterScore, userScore) {
    const maxScore = Math.max(aiScore, formatterScore, userScore);
    
    // If max score is very low, high uncertainty
    if (maxScore < 0.5) {
        return 'high';
    }
    
    // Calculate score difference between top 2
    const scores = [aiScore, formatterScore, userScore].sort((a, b) => b - a);
    const scoreDiff = scores[0] - scores[1];
    
    // If scores are close, medium uncertainty
    if (scoreDiff < 0.2) {
        return 'medium';
    }
    
    // Otherwise, low uncertainty
    return 'low';
}

module.exports = {
    accumulateScores,
    determineLabel,
    getTopContributors,
    calculateUncertainty
};

