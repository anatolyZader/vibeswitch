/**
 * Debt Manager
 * Manages persistent tracking of unreviewed files and calculates debt scores
 */

const { getLogger } = require('../logger');
const PersistInContext = require('./persistInContext');

class DebtManager {
    constructor(context, onScoreUpdate, updateFileColorsInExplorer = null) {
        this.context = context;
        this.onScoreUpdate = onScoreUpdate;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.debt = new Map(); // filepath -> debt object
        
        // Initialize persistence manager for workspace storage
        this.persistence = context ? new PersistInContext(context, 'workspace') : null;
    }

    /**
     * Load debt from workspace storage
     */
    loadDebt() {
        if (!this.persistence) return;
        
        try {
            // Load debt data as Map using persistence manager
            this.debt = this.persistence.loadAsMap('debt', new Map());
            
            getLogger().log(`AwarenessMonitor: Loaded ${this.debt.size} files with debt`);
            
            // Clean up old debt (older than 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            for (const [path, debt] of this.debt.entries()) {
                if (debt.modifiedAt < sevenDaysAgo) {
                    this.debt.delete(path);
                    getLogger().log(`AwarenessMonitor: Removed stale debt for ${path}`);
                }
            }
            
            // Save cleaned up data
            this.saveDebt();
        } catch (error) {
            console.error('AwarenessMonitor: Error loading debt', error);
            this.debt = new Map();
        }
    }

    /**
     * Save debt to workspace storage
     */
    saveDebt() {
        if (!this.persistence) return;
        
        // Use persistence manager to save debt data
        this.persistence.saveSync('debt', this.debt);
    }

    /**
     * Add file to debt
     * @param {string} filePath - Path to the file
     * @param {number} changeSize - Size of the change
     * @param {Function} updateScore - Callback to trigger score update
     */
    addToDebt(filePath, changeSize, updateScore) {
        const existing = this.debt.get(filePath);
        const now = Date.now();
        
        if (existing && !existing.reviewed) {
            // File already has debt, accumulate it
            existing.totalChanges += changeSize;
            existing.lastModifiedAt = now;
            existing.modificationCount++;
        } else if (existing && existing.reviewed) {
            // File was reviewed but new changes came in - create new entry
            this.debt.set(filePath, {
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
            this.debt.set(filePath, {
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
        
        this.saveDebt();
        
        // Update file colors immediately when debt changes
        if (this.updateFileColorsInExplorer) {
            this.updateFileColorsInExplorer();
        }
        
        // Trigger immediate score update
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
        return this.debt.get(filePath) || null;
    }

    /**
     * Mark debt as reviewed
     * @param {string} filePath - Path to the file
     * @param {number} reviewTime - Time spent reviewing
     */
    markAsReviewed(filePath, reviewTime) {
        const debt = this.debt.get(filePath);
        if (debt) {
            debt.reviewed = true;
            debt.reviewedAt = Date.now();
            debt.totalReviewTime += reviewTime;
            this.saveDebt();
            
            // Update file colors immediately when debt is cleared
            if (this.updateFileColorsInExplorer) {
                this.updateFileColorsInExplorer();
            }
        }
    }

    /**
     * Update debt with session info
     * @param {string} filePath - Path to the file
     * @param {Object} sessionData - Session data
     */
    updateSession(filePath, sessionData) {
        const debt = this.debt.get(filePath);
        if (debt) {
            if (!debt.firstOpenedAt) {
                debt.firstOpenedAt = sessionData.sessionStart;
            }
            debt.lastVisitedAt = Date.now();
            debt.reviewSessions = (debt.reviewSessions || 0) + 1;
            this.saveDebt();
        }
    }

    /**
     * Calculate debt score (0-30)
     * High score = lots of unreviewed files (BAD in DEV mode)
     * @param {Array} aiSuggestions - Array of AI suggestions (for pending count)
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(aiSuggestions) {
        const unreviewedFiles = Array.from(this.debt.values())
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
     * Get debt summary for UI
     * @returns {Object} Summary with total count and top 10 oldest files
     */
    getDebtSummary() {
        const unreviewedFiles = Array.from(this.debt.entries())
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
     * Get the debt Map (for direct access when needed)
     * @returns {Map} Debt Map
     */
    getDebtMap() {
        return this.debt;
    }

    /**
     * Get size of debt
     * @returns {number} Number of files in debt
     */
    getDebtSize() {
        return this.debt.size;
    }

    /**
     * Check if file has unreviewed debt
     * @param {string} filePath - Path to the file
     * @returns {boolean} True if file has unreviewed debt
     */
    hasUnreviewedDebt(filePath) {
        const debt = this.debt.get(filePath);
        return debt && !debt.reviewed;
    }
}

module.exports = DebtManager;

