/**
 * ScoreCalculatorD - Domain service for calculating awareness scores
 * 
 * Encapsulates business logic for calculating awareness scores based on
 * user review behavior and AI suggestions. This is a domain service.
 */

const { getRelativePath } = require('../utils/utils');

class ScoreCalculatorD {
    /**
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface, optional)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(vscodePort = null, loggerPort = null) {
        this.vscodePort = vscodePort;
        this.loggerPort = loggerPort;
        this.currentScore = 0;
        this.scores = {
            review: 0,      // 0-40 points
            critical: 0,    // 0-30 points
            adaptation: 0,  // 0-30 points
            debt: 0         // 0-30 points
        };
    }

    /**
     * Calculate awareness score based on suggestions and review debt
     * @param {Array} aiSuggestions - Array of AI suggestions
     * @param {Function} getDebtScore - Function to get debt score
     * @param {Function} getReviewDebtSummary - Function to get debt summary
     * @param {Function} onScoreUpdate - Callback when score updates
     * @returns {Object} Score object with total and components
     */
    updateScore(aiSuggestions, getDebtScore, getReviewDebtSummary, onScoreUpdate) {
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for "recent activity" calculation
        const recentSuggestions = aiSuggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // BUT: If we have older suggestions but no recent ones, and we have review debt,
        // preserve the score based on debt rather than resetting to zero
        const hasOlderSuggestions = aiSuggestions.length > 0 && recentSuggestions.length === 0;
        const debtScore = getDebtScore();
        const hasDebt = debtScore > 0;
        
        // Rate-limited debug logging via logger port
        if (this.loggerPort) {
            this.loggerPort.debug(`Updating score: ${recentSuggestions.length} recent, ${aiSuggestions.length} total, debt: ${debtScore}`, 'scoreCalculator:updateScore');
        }
        
        // Only calculate if we have suggestions in the last 10 seconds
        if (recentSuggestions.length === 0) {
            // Even with no recent suggestions, calculate debt score if there's review debt
            if (debtScore > 0) {
                // If there's review debt but no pending, show debt score
                this.currentScore = Math.min(debtScore, 100); // Cap at 100
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
            } else if (hasOlderSuggestions && hasDebt) {
                // We have older suggestions and debt - preserve a minimum score based on debt
                // This prevents the meter from dropping to zero when monitor restarts
                this.currentScore = Math.max(debtScore, 20); // Minimum 20 to show activity
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
            } else {
                // No recent activity and no debt
                this.currentScore = -1; // Special value: no data yet
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            }
            // Trigger callback for meter update
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        // Include pending suggestions in score calculation (they count as activity)
        // This ensures meter shows activity even when suggestions are still pending
        const allRecent = recentSuggestions;
        
        // Filter to completed suggestions only for detailed scoring
        const completed = recentSuggestions.filter(s => s.status !== 'pending');
        const pending = recentSuggestions.filter(s => s.status === 'pending');
        
        if (completed.length === 0 && allRecent.length > 0) {
            // Still pending, but we have activity - show partial score based on pending count
            // This ensures meter shows activity instead of "No Activity"
            this.currentScore = 50; // Neutral - pending activity detected
            this.scores = { 
                review: 0, 
                critical: 0, 
                adaptation: 0, 
                debt: debtScore // Still calculate debt
            };
            
            // Trigger callback for meter update
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        if (completed.length === 0) {
            // No suggestions at all
            this.currentScore = -1;
            this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        // 1. Code Review Rate (40 points)
        this.scores.review = this.calculateReviewScore(completed);
        
        // 2. Critical Evaluation (30 points)
        this.scores.critical = this.calculateCriticalScore(completed);
        
        // 3. Code Adaptation (30 points)
        this.scores.adaptation = this.calculateAdaptationScore(completed);
        
        // 4. Review Debt (30 points)
        this.scores.debt = debtScore;
        
        // Total score (max 130, normalized to 100)
        const rawScore = this.scores.review + 
                        this.scores.critical + 
                        this.scores.adaptation + 
                        this.scores.debt;
        
        this.currentScore = Math.round(Math.min(rawScore, 100));
        
        // Trigger callback for immediate meter update
        if (onScoreUpdate) {
            onScoreUpdate();
        }
    }

    /**
     * Calculate review score (0-40)
     * High score = user carefully reviewed code
     */
    calculateReviewScore(suggestions) {
        const reviewedCount = suggestions.filter(s => s.reviewed).length;
        const totalReviewTime = suggestions.reduce((sum, s) => sum + s.reviewTime, 0);
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
     */
    calculateCriticalScore(suggestions) {
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
     */
    calculateAdaptationScore(suggestions) {
        const adapted = suggestions.filter(s => s.status === 'adapted').length;
        const adaptRate = adapted / suggestions.length;
        
        // Average edits per suggestion
        const totalEdits = suggestions.reduce((sum, s) => sum + s.editCount, 0);
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
     * Get current awareness score and breakdown
     * @param {Array} aiSuggestions - Array of AI suggestions
     * @param {Function} getReviewDebtSummary - Function to get debt summary
     */
    getScore(aiSuggestions, getReviewDebtSummary) {
        const debtSummary = getReviewDebtSummary();
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for score calculation
        const recentSuggestions = aiSuggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // For display: show ALL suggestions (not just last 10 seconds) so meter shows activity
        // But use recentSuggestions for actual score calculation
        const allSuggestions = aiSuggestions;
        
        // Get pending suggestions with file paths
        const pendingSuggestions = allSuggestions
            .filter(s => s.status === 'pending')
            .map(s => {
                // Extract file path from document URI
                let filePath = null;
                if (s.document) {
                    try {
                        // Use VS Code port for URI creation
                        const Uri = this.vscodePort ? this.vscodePort.Uri : null;
                        if (!Uri) {
                            return null; // Skip if no port available
                        }
                        const uri = Uri.parse(s.document);
                        if (uri.scheme === 'file') {
                            filePath = uri.fsPath;
                        }
                    } catch (err) {
                        if (this.loggerPort) {
                            this.loggerPort.error('AwarenessMonitor: Error parsing document URI', err);
                        }
                    }
                }
                return {
                    path: filePath ? getRelativePath(filePath) : 'Unknown',
                    fullPath: filePath || '',
                    ageMinutes: Math.round((now - s.timestamp) / (1000 * 60)),
                    type: s.isFileCreation ? 'file creation' : 
                          s.isExternalCreation ? 'external file' :
                          s.isFileWrite ? 'file write' : 'text change'
                };
            })
            .filter(Boolean); // Remove null entries
        
        return {
            total: this.currentScore,
            components: { ...this.scores },
            suggestions: {
                // Show all suggestions for meter display (so it doesn't disappear after 10s)
                total: allSuggestions.length,
                pending: allSuggestions.filter(s => s.status === 'pending').length,
                accepted: allSuggestions.filter(s => s.status === 'accepted').length,
                rejected: allSuggestions.filter(s => s.status === 'rejected').length,
                adapted: allSuggestions.filter(s => s.status === 'adapted').length,
                // Also include recent count for debugging
                recentTotal: recentSuggestions.length,
                // Include pending suggestions with file info
                pendingFiles: pendingSuggestions
            },
            // Review debt information
            debt: {
                unreviewedFiles: debtSummary.total,
                files: debtSummary.files.map(f => ({
                    path: getRelativePath(f.path), // Relative path instead of just filename
                    fullPath: f.path,
                    ageMinutes: Math.round(f.age / (1000 * 60)),
                    modifications: f.modificationCount
                }))
            },
            // Add debug info for troubleshooting
            debug: {
                lastActivity: recentSuggestions.length > 0 ? 
                    new Date(recentSuggestions[recentSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                    (aiSuggestions.length > 0 ? 
                    new Date(aiSuggestions[aiSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                        'None'),
                monitoringActive: true, // Will be set by main class
                totalDebtEntries: debtSummary.total,
                recentWindowCount: recentSuggestions.length,
                totalTrackedCount: aiSuggestions.length
            }
        };
    }

    /**
     * Get current score value
     */
    getCurrentScore() {
        return this.currentScore;
    }

    /**
     * Get score components
     */
    getScoreComponents() {
        return { ...this.scores };
    }
}

module.exports = ScoreCalculatorD;

