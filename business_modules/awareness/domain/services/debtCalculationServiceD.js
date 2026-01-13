/**
 * DebtCalculationServiceD - Domain service for debt calculation operations
 * 
 * Encapsulates business logic for calculating debt scores and aggregating debt metrics.
 * This is a domain service (stateless, no ports needed).
 */

class DebtCalculationServiceD {
    constructor() {
        // No constructor dependencies - stateless domain service
    }

    /**
     * Calculate debt score (0-30) - combines file-level and suggestion-level debt
     * 
     * Properly separates:
     * - FileDebt: Unreviewed changes in files (file-level)
     * - SuggestionDebt: Pending AI suggestions (suggestion-level)
     * 
     * @param {Map<string, FileDebt>} fileDebts - Map of file-level debt entities
     * @param {Array<Suggestion>} pendingSuggestions - Pending suggestions (suggestion-level debt)
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(fileDebts, pendingSuggestions) {
        if (!fileDebts) fileDebts = new Map();
        if (!pendingSuggestions) pendingSuggestions = [];

        // File-level debt: unreviewed file changes
        const unreviewedFiles = Array.from(fileDebts.values())
            .filter(d => d && !d.isReviewed());

        // Suggestion-level debt: pending AI suggestions (tracked separately)
        const pending = pendingSuggestions.filter(s => s && s.status === 'pending');

        // If no debt at all, return 0
        if (unreviewedFiles.length === 0 && pending.length === 0) {
            return 0;
        }

        const now = Date.now();

        // Calculate debt severity
        let debtScore = 0;

        // 1. Number of unreviewed files (0-10 points)
        debtScore += this.calculateDebtCountScore(unreviewedFiles.length);

        // 2. Number of pending suggestions (0-10 points)
        debtScore += this.calculateDebtPendingScore(pending.length);

        // 3. Age of oldest unreviewed file OR pending suggestion (0-10 points)
        // Combines both file-level and suggestion-level debt timestamps
        const fileDebtTimestamps = unreviewedFiles.map(d => d.modifiedAt || now);
        const suggestionDebtTimestamps = pending.map(s => s.timestamp || now);
        const allDebtTimestamps = [...fileDebtTimestamps, ...suggestionDebtTimestamps];

        if (allDebtTimestamps.length > 0) {
            const oldestDebt = Math.min(...allDebtTimestamps);
            debtScore += this.calculateDebtAgeScore(oldestDebt, now);
        }

        return Math.round(Math.min(debtScore, 30));
    }

    /**
     * Calculate debt age component (0-10)
     * @param {number} oldestDebtTimestamp - Oldest debt timestamp
     * @param {number} now - Current timestamp
     * @returns {number} Age score (0-10)
     */
    calculateDebtAgeScore(oldestDebtTimestamp, now) {
        if (!oldestDebtTimestamp || !now) return 0;

        const ageHours = (now - oldestDebtTimestamp) / (1000 * 60 * 60);
        return Math.min(ageHours * 1.5, 10);
    }

    /**
     * Calculate debt count component (0-10)
     * @param {number} unreviewedFileCount - Count of unreviewed files
     * @returns {number} Count score (0-10)
     */
    calculateDebtCountScore(unreviewedFileCount) {
        if (!unreviewedFileCount || unreviewedFileCount <= 0) return 0;
        return Math.min(unreviewedFileCount * 2, 10);
    }

    /**
     * Calculate debt pending component (0-10)
     * @param {number} pendingSuggestionCount - Count of pending suggestions
     * @returns {number} Pending score (0-10)
     */
    calculateDebtPendingScore(pendingSuggestionCount) {
        if (!pendingSuggestionCount || pendingSuggestionCount <= 0) return 0;
        return Math.min(pendingSuggestionCount * 2, 10);
    }

    /**
     * Aggregate file-level debt metrics
     * Note: This aggregates file-level debt only. Suggestion debt is tracked separately.
     * @param {Map<string, FileDebt>} fileDebts - Map of file-level debt entities
     * @returns {Object} Aggregated metrics
     */
    aggregateDebtMetrics(fileDebts) {
        if (!fileDebts) fileDebts = new Map();

        const debtArray = Array.from(fileDebts.values()).filter(d => d);
        const unreviewed = debtArray.filter(d => !d.isReviewed());

        const totalChanges = debtArray.reduce((sum, d) => sum + (d.totalChanges || 0), 0);
        const totalReviewTime = debtArray.reduce((sum, d) => sum + (d.totalReviewTime || 0), 0);
        const totalSessions = debtArray.reduce((sum, d) => sum + (d.reviewSessions || 0), 0);

        const timestamps = unreviewed.map(d => d.modifiedAt || 0).filter(t => t > 0);
        const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : null;
        const newestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;

        const ages = timestamps.map(t => Date.now() - t);
        const avgAge = ages.length > 0 
            ? ages.reduce((sum, age) => sum + age, 0) / ages.length 
            : 0;

        return {
            total: debtArray.length,
            unreviewed: unreviewed.length,
            totalChanges,
            totalReviewTime,
            totalSessions,
            oldestTimestamp,
            newestTimestamp,
            avgAge,
            oldestAge: oldestTimestamp ? Date.now() - oldestTimestamp : 0
        };
    }

    /**
     * Determine if file-level debt should be evicted
     * @param {FileDebt} fileDebt - File-level debt entity
     * @param {number} evictionThreshold - Eviction threshold in milliseconds
     * @returns {boolean} True if should evict
     */
    shouldEvictDebt(fileDebt, evictionThreshold) {
        if (!fileDebt || !evictionThreshold) return false;

        const age = Date.now() - (fileDebt.modifiedAt || 0);
        return age > evictionThreshold;
    }
}

module.exports = DebtCalculationServiceD;
