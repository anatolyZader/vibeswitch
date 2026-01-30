/**
 * ScoreService - Application service for awareness score calculation
 * 
 * Handles all score calculation logic:
 * - Calculates awareness scores from suggestions and debt
 * - Filters suggestions by time windows
 * - Formats score data for display
 * - Provides score breakdown and metadata
 * 
 * Note: This is separate from classification functionality.
 * - Classification: Determines if changes are AI/user/formatter (in classification/ directory)
 * - Scoring: Calculates awareness metrics from classified suggestions (in scoring/ directory)
 */

const { 
    calculateReviewScore, 
    calculateBlindAcceptanceScore, 
    calculateAdaptationScore,
    SCORING_CONSTANTS 
} = require('./scoreCalculations');
const { getRelativePath } = require('../utilities/vscodeDocUtilities');

// Import constants from centralized module
const {
    DEFAULT_RECENT_WINDOW_MS,
    SCORING_HORIZON_MS,
    SCORING_HORIZON_COUNT,
    EMA_ALPHA,
    PENDING_SOFT_CAP = 5 // Default if not in constants (backward compat)
} = SCORING_CONSTANTS;

// Risk score weights (sum to 1.0, directly map to 0-100 scale)
// All components are now in "risk" terms (higher = worse)
const RISK_WEIGHTS = {
    review: 0.30,        // 30% weight (converted from "good" score)
    blindAcceptance: 0.30, // 30% weight (already risk)
    adaptation: 0.20,    // 20% weight (converted from "good" score)
    debt: 0.20          // 20% weight (already risk)
};

// Pending risk calibration (can be moved to SCORING_CONSTANTS if needed)
const PENDING_SOFT_CAP_LOCAL = 5; // Tunable: adjust to calibrate pending risk impact (replaces hard floor)

class ScoreService {
    /**
     * @param {ILoggerPort} loggerAdapter - Logger adapter (optional)
     */
    constructor(loggerAdapter = null) {
        this.loggerAdapter = loggerAdapter;
        
        // Score state (single source of truth)
        this.currentScore = 0;
        this.scores = {
            review: 0,              // 0-40 points
            blindAcceptance: 0,     // 0-30 points (compliance risk)
            adaptation: 0,          // 0-30 points
            debt: 0                 // 0-30 points
        };
    }
    
    /**
     * Get current score state
     * @returns {Object} Current score state
     */
    getScoreState() {
        return {
            currentScore: this.currentScore,
            scores: { ...this.scores }
        };
    }

    /**
     * Reset score state to zero (for reset/restart). Clears current score and EMA smoothing.
     */
    resetScoreState() {
        this.currentScore = 0;
        this.scores = { review: 0, blindAcceptance: 0, adaptation: 0, debt: 0 };
        this.smoothedScore = 0;
        this.hasSmoothedScore = false;
    }

    /**
     * Calculate awareness score from suggestions and debt
     * @param {Object} params - Calculation parameters
     * @param {Array} params.suggestions - All suggestions
     * @param {DebtService} params.debtService - Debt service for debt calculation
     * @param {number} params.recentWindowMs - Time window for recent activity (default: DEFAULT_RECENT_WINDOW_MS)
     * @returns {Object} Score result with currentScore and scores breakdown
     */
    calculateScore({ suggestions, debtService, recentWindowMs = DEFAULT_RECENT_WINDOW_MS }) {
        const pendingSuggestions = suggestions.filter(s => s && s.status === 'pending');
        
        const getDebtScore = () => {
            if (!debtService) return 0;
            // Use risk-based debt calculation (research-aligned, default)
            return debtService.calculateDebtScore(pendingSuggestions, { useRiskBased: true });
        };

        const normalizeDebtToTotalScore = (debtScore) => {
            // debtScore is naturally 0-30. Normalize to 0-100 so the total score remains comparable.
            const safe = (typeof debtScore === 'number' && Number.isFinite(debtScore)) ? debtScore : 0;
            return Math.max(0, Math.min(100, Math.round((safe / 30) * 100)));
        };

        const now = Date.now();
        const recentSuggestions = this._filterRecentSuggestions(suggestions, now, recentWindowMs);
        
        // Extended horizon: evaluate completed suggestions over last 15 minutes or last 20 resolved
        // This provides stability beyond the 10s "recent activity" window
        const completedSuggestions = suggestions.filter(s => s && s.status !== 'pending');
        const horizonSuggestions = this._filterHorizonSuggestions(completedSuggestions, now);
        
        // Check if we have older suggestions but no recent ones
        const hasOlderSuggestions = suggestions.length > 0 && recentSuggestions.length === 0;
        const debtScore = getDebtScore();
        const hasDebt = debtScore > 0;
        const hasPending = pendingSuggestions.length > 0;

        // Rate-limited debug logging
        if (this.loggerAdapter) {
            this.loggerAdapter.debug(
                `Updating score: ${recentSuggestions.length} recent, ${suggestions.length} total, debt: ${debtScore}`,
                'scoreService:calculateScore'
            );
        }

        // Handle no recent activity
        // FIXED: Use smooth debt-based target instead of hard discontinuity
        // Note: If user has only pending suggestions and no resolved ones, blind acceptance returns 0.
        // This is correct - pending risk is handled by debtRisk (which counts pending suggestions).
        if (recentSuggestions.length === 0) {
            // Compute target score using debt-only risk (same model, empty completed set)
            // FIXED: Naming consistency - use debtRisk (0-30) consistently
            const debtRisk = debtScore; // debtScore is already 0-30 range
            const debtRisk01 = Math.max(0, Math.min(1, debtRisk / 30));
            
            // If there are pending suggestions, ensure minimum floor (tunable pending risk)
            // FIXED: Replace hard floor with tunable pending risk (removes magic behavior, gives calibration knobs)
            let targetScore = debtRisk01 * 100;
            if (hasPending && pendingSuggestions.length > 0) {
                const pendingCount = pendingSuggestions.length;
                const pendingRisk01 = Math.max(0, Math.min(1, pendingCount / PENDING_SOFT_CAP_LOCAL));
                targetScore = Math.max(targetScore, pendingRisk01 * 60); // Up to 60 points from pending risk
            }
            
            // Apply EMA smoothing to glide toward debt-based target (smooth transition)
            const targetClamped = Math.max(0, Math.min(100, targetScore));
            const currentScore = this._applySmoothing(targetClamped);
            
            const scores = { review: 0, blindAcceptance: 0, adaptation: 0, debt: debtRisk };
            this.currentScore = currentScore;
            this.scores = scores;
            return { currentScore, scores };
        }

        // Filter to completed suggestions for detailed scoring
        // Use extended horizon for stability (15 min or last 20 resolved)
        const completed = horizonSuggestions.length > 0 ? horizonSuggestions : 
                         recentSuggestions.filter(s => s.status !== 'pending');

        // Handle pending-only activity
        // FIXED: Use same targetScore model as "no recent activity" regime for consistency
        if (completed.length === 0 && recentSuggestions.length > 0) {
            // Compute target score using debt-only risk (same model, empty completed set)
            const debtRisk = debtScore; // debtScore is already 0-30 range
            const debtRisk01 = Math.max(0, Math.min(1, debtRisk / 30));
            
            // Apply tunable pending risk (same as regime B)
            const pendingCount = pendingSuggestions.filter(s => s && s.status === 'pending').length;
            let targetScore = debtRisk01 * 100;
            if (pendingCount > 0) {
                const pendingRisk01 = Math.max(0, Math.min(1, pendingCount / PENDING_SOFT_CAP_LOCAL));
                targetScore = Math.max(targetScore, pendingRisk01 * 60); // Up to 60 points from pending risk
            }
            
            const rawScore = Math.max(0, Math.min(100, targetScore));
            const currentScore = this._applySmoothing(rawScore);
            const scores = { review: 0, blindAcceptance: 0, adaptation: 0, debt: debtRisk };
            this.currentScore = currentScore;
            this.scores = scores;
            return { currentScore, scores };
        }

        // No suggestions at all
        if (completed.length === 0) {
            const rawScore = 0;
            const currentScore = this._applySmoothing(rawScore);
            this.currentScore = currentScore;
            this.scores = { review: 0, blindAcceptance: 0, adaptation: 0, debt: 0 };
            return {
                currentScore,
                scores: { review: 0, blindAcceptance: 0, adaptation: 0, debt: 0 }
            };
        }

        // Calculate component scores using pure functions (based on extended horizon)
        // Note: Review and Adaptation return "good" scores (higher = better)
        // Blind Acceptance and Debt already return "risk" scores (higher = worse)
        const reviewScore = calculateReviewScore(completed);
        const blindAcceptanceRisk = calculateBlindAcceptanceScore(completed);
        const adaptationScore = calculateAdaptationScore(completed);

        // Convert "good" scores to risk (invert) and normalize to 0-1 range
        // FIXED: Scale by component's native max for consistent scaling (not clamp to 30)
        // This ensures worst-case review (score=0) contributes full risk weight
        const reviewRisk01 = Math.max(0, Math.min(1, (40 - reviewScore) / 40));
        const adaptationRisk01 = Math.max(0, Math.min(1, (30 - adaptationScore) / 30));
        const blindAcceptanceRisk01 = Math.max(0, Math.min(1, blindAcceptanceRisk / 30));
        const debtRisk01 = Math.max(0, Math.min(1, debtScore / 30));

        // Weighted combination (weights sum to 1.0, directly map to 0-100)
        // All components normalized to 0-1 range for consistent scaling
        const riskScore = 
            RISK_WEIGHTS.review * reviewRisk01 +
            RISK_WEIGHTS.blindAcceptance * blindAcceptanceRisk01 +
            RISK_WEIGHTS.adaptation * adaptationRisk01 +
            RISK_WEIGHTS.debt * debtRisk01;
        
        const rawScore = Math.round(riskScore * 100); // Scale to 0-100
        const rawScoreNormalized = Math.max(0, Math.min(100, rawScore)); // Clamp to 0-100
        
        // Apply EMA smoothing to prevent UI thrashing
        const currentScore = this._applySmoothing(rawScoreNormalized);

        // Update internal state (single source of truth)
        // Store both "good" scores (for display) and risk scores (for calculation)
        this.currentScore = currentScore;
        this.scores = {
            // Store original "good" scores for UI display (higher = better for review/adaptation)
            review: reviewScore,              // 0-40, higher = better
            adaptation: adaptationScore,      // 0-30, higher = better
            // Store risk scores (higher = worse)
            blindAcceptance: blindAcceptanceRisk, // 0-30, higher = worse
            debt: debtScore                   // 0-30, higher = worse
        };

        return {
            currentScore, // Risk score: 0-100, higher = worse
            scores: {
                review: reviewScore,              // 0-40, higher = better
                adaptation: adaptationScore,      // 0-30, higher = better
                blindAcceptance: blindAcceptanceRisk, // 0-30, higher = worse
                debt: debtScore                   // 0-30, higher = worse
            }
        };
    }

    /**
     * Get structured breakdown for explainability (why did the meter move?).
     * @param {Object} params - Same as calculateScore
     * @returns {Object} { contributions, counts, topFactors }
     */
    getScoreBreakdown({ suggestions, debtService, recentWindowMs = DEFAULT_RECENT_WINDOW_MS }) {
        const pendingSuggestions = suggestions.filter(s => s && s.status === 'pending');
        const getDebtScore = () => {
            if (!debtService) return 0;
            return debtService.calculateDebtScore(pendingSuggestions, { useRiskBased: true });
        };
        const now = Date.now();
        const recentSuggestions = this._filterRecentSuggestions(suggestions, now, recentWindowMs);
        const completedSuggestions = suggestions.filter(s => s && s.status !== 'pending');
        const horizonSuggestions = this._filterHorizonSuggestions(completedSuggestions, now);
        const completed = horizonSuggestions.length > 0 ? horizonSuggestions : recentSuggestions.filter(s => s.status !== 'pending');
        const debtScore = getDebtScore();

        const counts = {
            total: suggestions.length,
            completed: completedSuggestions.length,
            pending: pendingSuggestions.length,
            reviewed: suggestions.filter(s => s && s.reviewed).length,
            recent: recentSuggestions.length
        };

        if (completed.length === 0) {
            const debtRisk01 = Math.max(0, Math.min(1, debtScore / 30));
            const debtContribution = Math.round(RISK_WEIGHTS.debt * debtRisk01 * 100);
            return {
                contributions: { review: 0, blindAcceptance: 0, adaptation: 0, debt: debtContribution },
                counts,
                topFactors: debtScore > 0 ? [{ name: 'debt', contribution: debtContribution, direction: 'risk' }] : []
            };
        }

        const reviewScore = calculateReviewScore(completed);
        const blindAcceptanceRisk = calculateBlindAcceptanceScore(completed);
        const adaptationScore = calculateAdaptationScore(completed);
        const reviewRisk01 = Math.max(0, Math.min(1, (40 - reviewScore) / 40));
        const adaptationRisk01 = Math.max(0, Math.min(1, (30 - adaptationScore) / 30));
        const blindAcceptanceRisk01 = Math.max(0, Math.min(1, blindAcceptanceRisk / 30));
        const debtRisk01 = Math.max(0, Math.min(1, debtScore / 30));

        const reviewContribution = Math.round(RISK_WEIGHTS.review * reviewRisk01 * 100);
        const blindAcceptanceContribution = Math.round(RISK_WEIGHTS.blindAcceptance * blindAcceptanceRisk01 * 100);
        const adaptationContribution = Math.round(RISK_WEIGHTS.adaptation * adaptationRisk01 * 100);
        const debtContribution = Math.round(RISK_WEIGHTS.debt * debtRisk01 * 100);

        const factors = [
            { name: 'review', contribution: reviewContribution, direction: 'risk' },
            { name: 'blindAcceptance', contribution: blindAcceptanceContribution, direction: 'risk' },
            { name: 'adaptation', contribution: adaptationContribution, direction: 'risk' },
            { name: 'debt', contribution: debtContribution, direction: 'risk' }
        ].filter(f => f.contribution > 0).sort((a, b) => b.contribution - a.contribution);

        return {
            contributions: { review: reviewContribution, blindAcceptance: blindAcceptanceContribution, adaptation: adaptationContribution, debt: debtContribution },
            counts,
            topFactors: factors.slice(0, 5)
        };
    }

    /**
     * Get formatted score data for display
     * @param {Object} params - Parameters
     * @param {Array} params.suggestions - All suggestions
     * @param {DebtService} params.debtService - Debt service
     * @param {number} params.currentScore - Current total score
     * @param {Object} params.scores - Score components
     * @param {Object} params.vscodeAdapter - VS Code adapter for path operations
     * @param {number} params.recentWindowMs - Time window for recent activity (default: 10000ms)
     * @param {number} params.updateTimer - Update timer reference (for debug info)
     * @returns {Object} Formatted score data
     */
    getScoreData({ suggestions, debtService, currentScore, scores, vscodeAdapter, recentWindowMs = DEFAULT_RECENT_WINDOW_MS, updateTimer = null }) {
        const getReviewDebtSummary = () => {
            if (!debtService) {
                return { total: 0, files: [] };
            }
            return debtService.getDebtSummary();
        };

        const debtSummary = getReviewDebtSummary();
        const now = Date.now();
        const recentSuggestions = this._filterRecentSuggestions(suggestions, now, recentWindowMs);
        const allSuggestions = suggestions;
        const debtAllFiles = debtSummary.allFiles || debtSummary.files || [];

        // Get pending suggestions with file paths
        const pendingSuggestions = allSuggestions
            .filter(s => s.status === 'pending')
            .map(s => {
                let filePath = null;
                if (s.document) {
                    try {
                        const Uri = vscodeAdapter ? vscodeAdapter.Uri : null;
                        if (!Uri) {
                            return null;
                        }
                        const uri = Uri.parse(s.document);
                        if (uri.scheme === 'file') {
                            filePath = uri.fsPath;
                        }
                    } catch (err) {
                        if (this.loggerAdapter) {
                            this.loggerAdapter.error('ScoreService: Error parsing document URI', err);
                        }
                    }
                }
                return {
                    path: filePath ? getRelativePath(vscodeAdapter, filePath) : 'Unknown',
                    fullPath: filePath || '',
                    ageMinutes: Math.round((now - s.timestamp) / (1000 * 60)),
                    type: s.isFileCreation ? 'file creation' : 
                          s.isExternalCreation ? 'external file' :
                          s.isFileWrite ? 'file write' : 'text change'
                };
            })
            .filter(Boolean);

        return {
            total: currentScore,
            components: { ...scores },
            suggestions: {
                total: allSuggestions.length,
                pending: allSuggestions.filter(s => s.status === 'pending').length,
                accepted: allSuggestions.filter(s => s.status === 'accepted').length,
                rejected: allSuggestions.filter(s => s.status === 'rejected').length,
                adapted: allSuggestions.filter(s => s.status === 'adapted').length,
                recentTotal: recentSuggestions.length,
                pendingFiles: pendingSuggestions
            },
            debt: {
                unreviewedFiles: debtSummary.total,
                files: (debtSummary.files || []).map(f => ({
                    path: getRelativePath(vscodeAdapter, f.path),
                    fullPath: f.path,
                    ageMinutes: Math.round(f.age / (1000 * 60)),
                    modifications: f.modificationCount
                })),
                allFiles: debtAllFiles.map(f => ({
                    path: getRelativePath(vscodeAdapter, f.path),
                    fullPath: f.path,
                    ageMinutes: Math.round(f.age / (1000 * 60)),
                    modifications: f.modificationCount
                }))
            },
            debug: {
                lastActivity: recentSuggestions.length > 0 ? 
                    new Date(recentSuggestions[recentSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                    (suggestions.length > 0 ? 
                    new Date(suggestions[suggestions.length - 1].timestamp).toLocaleTimeString() : 
                        'None'),
                monitoringActive: updateTimer !== null,
                totalDebtEntries: debtSummary.total,
                recentWindowCount: recentSuggestions.length,
                totalTrackedCount: suggestions.length
            }
        };
    }

    /**
     * Filter suggestions by recent time window (for activity state)
     * @private
     * @param {Array} suggestions - All suggestions
     * @param {number} now - Current timestamp
     * @param {number} windowMs - Time window in milliseconds
     * @returns {Array} Filtered recent suggestions
     */
    _filterRecentSuggestions(suggestions, now, windowMs) {
        // FIXED: Add null checks to prevent runtime errors
        if (!Array.isArray(suggestions)) {
            return [];
        }
        return suggestions.filter(s => 
            s && 
            typeof s.timestamp === 'number' && 
            (now - s.timestamp) <= windowMs
        );
    }

    /**
     * Filter suggestions by extended horizon (for risk evaluation stability)
     * Uses either time-based (15 min) or count-based (last 20 resolved) horizon
     * @private
     * @param {Array} completedSuggestions - Completed suggestions
     * @param {number} now - Current timestamp
     * @returns {Array} Filtered horizon suggestions
     */
    _filterHorizonSuggestions(completedSuggestions, now) {
        // Sort by timestamp (most recent first)
        const sorted = [...completedSuggestions].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        // Time-based horizon: last 15 minutes
        const timeBased = sorted.filter(s => (now - (s.timestamp || now)) <= SCORING_HORIZON_MS);
        
        // Count-based horizon: last 20 resolved
        const countBased = sorted.slice(0, SCORING_HORIZON_COUNT);
        
        // Use whichever gives more suggestions (more stable)
        return timeBased.length >= countBased.length ? timeBased : countBased;
    }

    /**
     * Apply EMA smoothing to score (prevents UI thrashing)
     * @private
     * @param {number} newScore - New raw score
     * @returns {number} Smoothed score
     */
    _applySmoothing(newScore) {
        if (!this.hasSmoothedScore) {
            // Initialize with first score
            this.smoothedScore = newScore;
            this.hasSmoothedScore = true;
            return newScore;
        }
        
        // EMA: smoothed = alpha * new + (1 - alpha) * old
        this.smoothedScore = EMA_ALPHA * newScore + (1 - EMA_ALPHA) * this.smoothedScore;
        return Math.round(this.smoothedScore);
    }
}

module.exports = ScoreService;
