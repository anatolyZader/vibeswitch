/**
 * Review Debt Manager
 * Manages persistent tracking of unreviewed files and calculates debt scores
 */

const { getLogger } = require('../logger');

class ReviewDebtManager {
    constructor(context, onScoreUpdate) {
        this.context = context;
        this.onScoreUpdate = onScoreUpdate;
        this.reviewDebt = new Map(); // filepath -> debt object
    }

    /**
     * Load review debt from workspace storage
     */
    loadReviewDebt() {
        if (!this.context) return;
        
        try {
            const stored = this.context.workspaceState.get('reviewDebt', {});
            this.reviewDebt = new Map(Object.entries(stored));
            
            getLogger().log(`AwarenessMonitor: Loaded ${this.reviewDebt.size} files with review debt`);
            
            // Clean up old debt (older than 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            for (const [path, debt] of this.reviewDebt.entries()) {
                if (debt.modifiedAt < sevenDaysAgo) {
                    this.reviewDebt.delete(path);
                    getLogger().log(`AwarenessMonitor: Removed stale debt for ${path}`);
                }
            }
            
            this.saveReviewDebt();
        } catch (error) {
            console.error('AwarenessMonitor: Error loading review debt', error);
            this.reviewDebt = new Map();
        }
    }

    /**
     * Save review debt to workspace storage
     */
    saveReviewDebt() {
        if (!this.context) return;
        
        try {
            const debtObject = Object.fromEntries(this.reviewDebt);
            this.context.workspaceState.update('reviewDebt', debtObject);
        } catch (error) {
            console.error('AwarenessMonitor: Error saving review debt', error);
        }
    }

    /**
     * Add file to review debt
     * @param {string} filePath - Path to the file
     * @param {number} changeSize - Size of the change
     * @param {Function} updateScore - Callback to trigger score update
     */
    addToReviewDebt(filePath, changeSize, updateScore) {
        const existing = this.reviewDebt.get(filePath);
        const now = Date.now();
        
        if (existing && !existing.reviewed) {
            // File already has debt, accumulate it
            existing.totalChanges += changeSize;
            existing.lastModifiedAt = now;
            existing.modificationCount++;
        } else if (existing && existing.reviewed) {
            // File was reviewed but new changes came in - create new entry
            this.reviewDebt.set(filePath, {
                modifiedAt: now,
                lastModifiedAt: now,
                totalChanges: changeSize,
                modificationCount: 1,
                reviewed: false,
                firstOpenedAt: null,
                totalReviewTime: 0,
                lastVisitedAt: null,
                reviewSessions: 0
            });
        } else {
            // New debt entry
            this.reviewDebt.set(filePath, {
                modifiedAt: now,
                lastModifiedAt: now,
                totalChanges: changeSize,
                modificationCount: 1,
                reviewed: false,
                firstOpenedAt: null,
                totalReviewTime: 0,
                lastVisitedAt: null,
                reviewSessions: 0
            });
        }
        
        this.saveReviewDebt();
        
        // Trigger immediate score update to refresh file decorations
        if (updateScore) {
            updateScore();
        }
    }

    /**
     * Get debt entry for a file
     * @param {string} filePath - Path to the file
     * @returns {Object|null} Debt object or null
     */
    getDebt(filePath) {
        return this.reviewDebt.get(filePath) || null;
    }

    /**
     * Mark debt as reviewed
     * @param {string} filePath - Path to the file
     * @param {number} reviewTime - Time spent reviewing
     */
    markAsReviewed(filePath, reviewTime) {
        const debt = this.reviewDebt.get(filePath);
        if (debt) {
            debt.reviewed = true;
            debt.reviewedAt = Date.now();
            debt.totalReviewTime += reviewTime;
            this.saveReviewDebt();
        }
    }

    /**
     * Update debt with review session info
     * @param {string} filePath - Path to the file
     * @param {Object} sessionData - Review session data
     */
    updateReviewSession(filePath, sessionData) {
        const debt = this.reviewDebt.get(filePath);
        if (debt) {
            if (!debt.firstOpenedAt) {
                debt.firstOpenedAt = sessionData.sessionStart;
            }
            debt.lastVisitedAt = Date.now();
            debt.reviewSessions = (debt.reviewSessions || 0) + 1;
            this.saveReviewDebt();
        }
    }

    /**
     * Calculate debt score (0-30)
     * High score = lots of unreviewed files (BAD in DEV mode)
     * @param {Array} aiSuggestions - Array of AI suggestions (for pending count)
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(aiSuggestions) {
        const unreviewedFiles = Array.from(this.reviewDebt.values())
            .filter(d => !d.reviewed);
        
        // Pending suggestions are also debt - they represent unreviewed AI-generated code
        const pendingSuggestions = aiSuggestions ? aiSuggestions.filter(s => s.status === 'pending') : [];
        
        // If no debt at all, return 0
        if (unreviewedFiles.length === 0 && pendingSuggestions.length === 0) {
            return 0;
        }
        
        const now = Date.now();
        
        // Calculate debt severity
        let debtScore = 0;
        
        // 1. Number of unreviewed files (0-10 points)
        debtScore += Math.min(unreviewedFiles.length * 2, 10);
        
        // 2. Number of pending suggestions (0-10 points)
        // Each pending suggestion is unreviewed code that needs attention
        debtScore += Math.min(pendingSuggestions.length * 2, 10);
        
        // 3. Age of oldest unreviewed file or pending suggestion (0-10 points)
        const allDebtTimestamps = [
            ...unreviewedFiles.map(d => d.modifiedAt),
            ...pendingSuggestions.map(s => s.timestamp)
        ];
        
        if (allDebtTimestamps.length > 0) {
            const oldestDebt = Math.min(...allDebtTimestamps);
            const ageHours = (now - oldestDebt) / (1000 * 60 * 60);
            debtScore += Math.min(ageHours * 1.5, 10);
        }
        
        return Math.round(Math.min(debtScore, 30));
    }

    /**
     * Get review debt summary for UI
     * @returns {Object} Summary with total count and top 10 oldest files
     */
    getReviewDebtSummary() {
        const unreviewedFiles = Array.from(this.reviewDebt.entries())
            .filter(([_, debt]) => !debt.reviewed)
            .map(([path, debt]) => ({
                path: path,
                modifiedAt: debt.modifiedAt,
                age: Date.now() - debt.modifiedAt,
                modificationCount: debt.modificationCount,
                totalChanges: debt.totalChanges
            }))
            .sort((a, b) => b.age - a.age); // Oldest first
        
        return {
            total: unreviewedFiles.length,
            files: unreviewedFiles.slice(0, 10) // Top 10 oldest
        };
    }

    /**
     * Get the review debt Map (for direct access when needed)
     * @returns {Map} Review debt Map
     */
    getDebtMap() {
        return this.reviewDebt;
    }

    /**
     * Get size of review debt
     * @returns {number} Number of files in debt
     */
    getDebtSize() {
        return this.reviewDebt.size;
    }

    /**
     * Check if file has unreviewed debt
     * @param {string} filePath - Path to the file
     * @returns {boolean} True if file has unreviewed debt
     */
    hasUnreviewedDebt(filePath) {
        const debt = this.reviewDebt.get(filePath);
        return debt && !debt.reviewed;
    }
}

module.exports = ReviewDebtManager;

