/**
 * ScoreService - Application service for score orchestration
 * 
 * Handles orchestration logic for score calculation:
 * - Time-based filtering (recent activity window)
 * - State management (current score, components)
 * - Callback orchestration
 * - Display formatting
 * 
 * Pure scoring calculations are delegated to ScoreCalculationServiceD (domain layer).
 */

const { getRelativePath } = require('../domain/utils/utils');

class ScoreService {
    /**
     * @param {ScoreCalculationServiceD} scoreCalculationServiceD - Domain service for score calculations
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface, optional)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(scoreCalculationServiceD, vscodePort = null, loggerPort = null) {
        if (!scoreCalculationServiceD) {
            throw new Error('ScoreService requires scoreCalculationServiceD');
        }
        this.scoreCalculationServiceD = scoreCalculationServiceD;
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
     * Update awareness score based on suggestions and review debt
     * @param {Array} aiSuggestions - Array of AI suggestions
     * @param {Function} getDebtScore - Function to get debt score
     * @param {Function} getReviewDebtSummary - Function to get debt summary
     * @param {Function} onScoreUpdate - Callback when score updates
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
            this.loggerPort.debug(`Updating score: ${recentSuggestions.length} recent, ${aiSuggestions.length} total, debt: ${debtScore}`, 'scoreService:updateScore');
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
                // Use explicit state: score of 0 represents "no activity" (not magic value -1)
                this.currentScore = 0;
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
            // Use explicit state: score of 0 represents "no activity" (not magic value -1)
            this.currentScore = 0;
            this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        // Delegate to domain service for pure scoring calculations
        // 1. Code Review Rate (40 points)
        this.scores.review = this.scoreCalculationServiceD.calculateReviewScore(completed);
        
        // 2. Critical Evaluation (30 points)
        this.scores.critical = this.scoreCalculationServiceD.calculateCriticalScore(completed);
        
        // 3. Code Adaptation (30 points)
        this.scores.adaptation = this.scoreCalculationServiceD.calculateAdaptationScore(completed);
        
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
     * Get current awareness score and breakdown
     * @param {Array} aiSuggestions - Array of AI suggestions
     * @param {Function} getReviewDebtSummary - Function to get debt summary
     * @returns {Object} Score data with total, components, suggestions, debt, and debug info
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
                            this.loggerPort.error('ScoreService: Error parsing document URI', err);
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
     * @returns {number} Current score
     */
    getCurrentScore() {
        return this.currentScore;
    }

    /**
     * Get score components
     * @returns {Object} Score components
     */
    getScoreComponents() {
        return { ...this.scores };
    }
}

module.exports = ScoreService;
