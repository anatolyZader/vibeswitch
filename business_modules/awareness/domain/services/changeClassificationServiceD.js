/**
 * ChangeClassificationServiceD - Domain service for change classification operations
 * 
 * Encapsulates business logic for classifying changes as AI, user, or formatter.
 * This is a domain service that uses classification detectors and scorers.
 */

const { accumulateScores, determineLabel } = require('../utils/classificationScorer');

class ChangeClassificationServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Classify a change based on detectors
     * @param {Change} change - Change entity
     * @param {Object} detectors - Classification detectors
     * @param {Object} config - Classification configuration
     * @returns {Object} Classification result {label, confidence, reasons, meta}
     */
    classifyChange(change, detectors, config) {
        if (!change) {
            return { label: 'unknown', confidence: 0, reasons: ['No change provided'] };
        }

        // Calculate scores from detectors
        const scores = this.calculateClassificationScore(detectors, change);
        
        // Determine label from scores
        const label = this.determineClassificationLabel(
            scores.aiScore,
            scores.formatterScore,
            scores.userScore
        );

        // Calculate confidence (normalized to 0-1)
        const totalScore = scores.aiScore + scores.formatterScore + scores.userScore;
        const confidence = totalScore > 0 
            ? Math.max(scores.aiScore, scores.formatterScore, scores.userScore) / totalScore
            : 0;

        // Collect reasons from detectors
        const reasons = scores.reasons || [];

        // Validate classification
        const classification = { label, confidence, reasons, meta: scores.meta || {} };
        if (!this.validateClassification(classification)) {
            return { label: 'unknown', confidence: 0, reasons: ['Invalid classification'] };
        }

        return classification;
    }

    /**
     * Calculate classification scores from detectors
     * @param {Object} detectors - Classification detectors
     * @param {Change} change - Change entity
     * @returns {Object} Scores {aiScore, formatterScore, userScore, reasons, meta}
     */
    calculateClassificationScore(detectors, change) {
        if (!detectors || !change) {
            return { aiScore: 0, formatterScore: 0, userScore: 0, reasons: [] };
        }

        // Use accumulateScores utility if available
        if (typeof accumulateScores === 'function') {
            return accumulateScores(detectors);
        }

        // Fallback: manual accumulation
        let aiScore = 0;
        let formatterScore = 0;
        let userScore = 0;
        const reasons = [];
        const meta = {};

        // Run each detector and accumulate scores
        for (const [name, detector] of Object.entries(detectors)) {
            if (typeof detector === 'function') {
                try {
                    const result = detector(change);
                    if (result) {
                        if (result.label === 'ai') {
                            aiScore += result.scoreDelta || 0;
                        } else if (result.label === 'formatter') {
                            formatterScore += result.scoreDelta || 0;
                        } else if (result.label === 'user') {
                            userScore += result.scoreDelta || 0;
                        }
                        
                        if (result.reason) {
                            reasons.push(result.reason);
                        }
                        
                        if (result.meta) {
                            meta[name] = result.meta;
                        }
                    }
                } catch (error) {
                    // Skip detector on error
                }
            }
        }

        return { aiScore, formatterScore, userScore, reasons, meta };
    }

    /**
     * Determine classification label from scores
     * @param {number} aiScore - AI score
     * @param {number} formatterScore - Formatter score
     * @param {number} userScore - User score
     * @returns {string} Label: 'ai' | 'formatter' | 'user' | 'unknown'
     */
    determineClassificationLabel(aiScore, formatterScore, userScore) {
        if (typeof determineLabel === 'function') {
            return determineLabel(aiScore, formatterScore, userScore);
        }

        // Fallback: manual determination
        const maxScore = Math.max(aiScore, formatterScore, userScore);
        
        if (maxScore <= 0) {
            return 'unknown';
        }

        if (formatterScore === maxScore) {
            return 'formatter';
        }
        
        if (aiScore === maxScore) {
            return 'ai';
        }
        
        if (userScore === maxScore) {
            return 'user';
        }

        return 'unknown';
    }

    /**
     * Validate classification result
     * @param {Object} classification - Classification result
     * @returns {boolean} True if valid
     */
    validateClassification(classification) {
        if (!classification) return false;
        
        const validLabels = ['ai', 'formatter', 'user', 'unknown'];
        if (!validLabels.includes(classification.label)) {
            return false;
        }

        if (typeof classification.confidence !== 'number' || 
            classification.confidence < 0 || 
            classification.confidence > 1) {
            return false;
        }

        if (!Array.isArray(classification.reasons)) {
            return false;
        }

        return true;
    }

    /**
     * Merge classifications for a batch of changes
     * @param {Array<Change>} changes - Array of changes
     * @returns {Object} Merged classification
     */
    mergeBatchClassifications(changes) {
        if (!changes || changes.length === 0) {
            return { label: 'unknown', confidence: 0, reasons: [] };
        }

        // Get all classifications
        const classifications = changes
            .filter(c => c.classification)
            .map(c => c.classification);

        if (classifications.length === 0) {
            return { label: 'unknown', confidence: 0, reasons: [] };
        }

        // Count labels
        const labelCounts = { ai: 0, formatter: 0, user: 0, unknown: 0 };
        let totalConfidence = 0;
        const allReasons = [];

        for (const classification of classifications) {
            labelCounts[classification.label] = (labelCounts[classification.label] || 0) + 1;
            totalConfidence += classification.confidence || 0;
            if (classification.reasons) {
                allReasons.push(...classification.reasons);
            }
        }

        // Determine dominant label
        const dominantLabel = Object.entries(labelCounts)
            .sort((a, b) => b[1] - a[1])[0][0];

        // Calculate average confidence
        const avgConfidence = totalConfidence / classifications.length;

        // Deduplicate reasons
        const uniqueReasons = [...new Set(allReasons)];

        return {
            label: dominantLabel,
            confidence: avgConfidence,
            reasons: uniqueReasons,
            meta: {
                totalChanges: changes.length,
                classifiedChanges: classifications.length,
                labelDistribution: labelCounts
            }
        };
    }
}

module.exports = ChangeClassificationServiceD;
