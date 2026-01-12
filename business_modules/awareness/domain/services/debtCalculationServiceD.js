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
     * Calculate debt score (0-30)
     * @param {Map<string, Debt>} debts - Map of debt entities
     * @param {Array<Suggestion>} pendingSuggestions - Pending suggestions
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(debts, pendingSuggestions) {
        if (!debts) debts = new Map();
        if (!pendingSuggestions) pendingSuggestions = [];

        const unreviewedFiles = Array.from(debts.values())
            .filter(d => d && !d.isReviewed());

        // Pending suggestions are also debt - they represent unreviewed AI-generated code
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

        // 3. Age of oldest unreviewed file or pending suggestion (0-10 points)
        const allDebtTimestamps = [
            ...unreviewedFiles.map(d => d.modifiedAt || now),
            ...pending.map(s => s.timestamp || now)
        ];

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
     * Aggregate debt metrics
     * @param {Map<string, Debt>} debts - Map of debt entities
     * @returns {Object} Aggregated metrics
     */
    aggregateDebtMetrics(debts) {
        if (!debts) debts = new Map();

        const debtArray = Array.from(debts.values()).filter(d => d);
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
     * Determine if debt should be evicted
     * @param {Debt} debt - Debt entity
     * @param {number} evictionThreshold - Eviction threshold in milliseconds
     * @returns {boolean} True if should evict
     */
    shouldEvictDebt(debt, evictionThreshold) {
        if (!debt || !evictionThreshold) return false;

        const age = Date.now() - (debt.modifiedAt || 0);
        return age > evictionThreshold;
    }
}

module.exports = DebtCalculationServiceD;
