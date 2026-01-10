/**
 * Classification Scorer
 * Accumulates detector scores and determines final classification label and confidence
 */

function accumulateScores(detectors) {
    let aiScore = 0;
    let formatterScore = 0;
    let userScore = 0;
    
    // Fix: Store reasons as paired objects to prevent misalignment
    // Some detectors may return reason without reasonTag (e.g., marker detection)
    const reasonObjects = [];
    
    for (const detector of detectors) {
        const result = detector();
        if (!result) continue;
        
        if (result.label === 'formatter') {
            formatterScore += result.score;
        } else if (result.label === 'ai') {
            aiScore += result.score;
        } else if (result.label === 'user') {
            userScore += result.score;
        }
        
        if (result.reason) {
            reasonObjects.push({ tag: result.reasonTag || null, text: result.reason });
        }
    }
    
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

