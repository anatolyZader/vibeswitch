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
    
    return { aiScore, formatterScore, userScore, reasonObjects };
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

module.exports = {
    accumulateScores,
    determineLabel
};

