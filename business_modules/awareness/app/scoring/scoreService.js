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

const { calculateReviewScore, calculateCriticalScore, calculateAdaptationScore } = require('./scoreCalculations');
const { getRelativePath } = require('../utilities/vscodeDocUtilities');

// Constants
const DEFAULT_RECENT_WINDOW_MS = 10 * 1000; // 10 seconds

class ScoreService {
    /**
     * @param {ILoggerPort} loggerAdapter - Logger adapter (optional)
     */
    constructor(loggerAdapter = null) {
        this.loggerAdapter = loggerAdapter;
        
        // Score state (single source of truth)
        this.currentScore = 0;
        this.scores = {
            review: 0,      // 0-40 points
            critical: 0,    // 0-30 points
            adaptation: 0,  // 0-30 points
            debt: 0         // 0-30 points
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
        if (recentSuggestions.length === 0) {
            if (hasPending) {
                // Core intent: if there are still unreviewed/pending AI suggestions,
                // the meter should not drop just because the activity is older than the "recent" window.
                // Keep a cautious baseline and let it grow with debt.
                const currentScore = Math.min(50 + debtScore, 100);
                const scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
                this.currentScore = currentScore;
                this.scores = scores;
                return { currentScore, scores };
            } else if (debtScore > 0) {
                // Debt without pending suggestions (e.g., file-level debt) should still be reflected
                // in the same 0-100 scale as the rest of the score.
                const currentScore = normalizeDebtToTotalScore(debtScore);
                const scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
                this.currentScore = currentScore;
                this.scores = scores;
                return { currentScore, scores };
            } else if (hasOlderSuggestions && hasDebt) {
                // Preserve minimum score based on debt
                const currentScore = Math.max(debtScore, 20);
                const scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
                this.currentScore = currentScore;
                this.scores = scores;
                return { currentScore, scores };
            } else {
                // No activity
                this.currentScore = 0;
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
                return {
                    currentScore: 0,
                    scores: { review: 0, critical: 0, adaptation: 0, debt: 0 }
                };
            }
        }

        // Filter to completed suggestions for detailed scoring
        const completed = recentSuggestions.filter(s => s.status !== 'pending');

        // Handle pending-only activity
        if (completed.length === 0 && recentSuggestions.length > 0) {
            const currentScore = 50; // Neutral - pending activity detected
            const scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
            this.currentScore = currentScore;
            this.scores = scores;
            return { currentScore, scores };
        }

        // No suggestions at all
        if (completed.length === 0) {
            this.currentScore = 0;
            this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            return {
                currentScore: 0,
                scores: { review: 0, critical: 0, adaptation: 0, debt: 0 }
            };
        }

        // Calculate component scores using pure functions
        const reviewScore = calculateReviewScore(completed);
        const criticalScore = calculateCriticalScore(completed);
        const adaptationScore = calculateAdaptationScore(completed);

        // Total score (max 130, normalized to 100)
        const rawScore = reviewScore + criticalScore + adaptationScore + debtScore;
        const currentScore = Math.round(Math.min(rawScore, 100));

        // Update internal state (single source of truth)
        this.currentScore = currentScore;
        this.scores = {
            review: reviewScore,
            critical: criticalScore,
            adaptation: adaptationScore,
            debt: debtScore
        };

        return {
            currentScore,
            scores: {
                review: reviewScore,
                critical: criticalScore,
                adaptation: adaptationScore,
                debt: debtScore
            }
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
                files: debtSummary.files.map(f => ({
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
     * Filter suggestions by recent time window
     * @private
     * @param {Array} suggestions - All suggestions
     * @param {number} now - Current timestamp
     * @param {number} windowMs - Time window in milliseconds
     * @returns {Array} Filtered recent suggestions
     */
    _filterRecentSuggestions(suggestions, now, windowMs) {
        return suggestions.filter(s => (now - s.timestamp) <= windowMs);
    }
}

module.exports = ScoreService;
