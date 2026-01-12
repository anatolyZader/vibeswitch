/**
 * SuggestionBatchServiceD - Domain service for suggestion batch operations
 * 
 * Encapsulates business logic for managing suggestion batches and detecting patterns.
 * This is a domain service that uses ID generator port for batch creation.
 */

const SuggestionBatch = require('../entities/suggestionBatch');

class SuggestionBatchServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Create a new batch
     * @param {IIdGeneratorPort} idGeneratorPort - ID generator port
     * @param {string} documentUri - Document URI
     * @param {string} suggestionId - First suggestion ID
     * @param {number} size - Suggestion size
     * @returns {SuggestionBatch} New batch entity
     */
    createBatch(idGeneratorPort, documentUri, suggestionId, size) {
        if (!idGeneratorPort) {
            throw new Error('SuggestionBatchServiceD.createBatch requires idGeneratorPort');
        }
        if (!documentUri || !suggestionId || size === undefined) {
            throw new Error('SuggestionBatchServiceD.createBatch requires documentUri, suggestionId, and size');
        }

        let batchId;
        try {
            batchId = idGeneratorPort.generateUUID();
        } catch (e) {
            batchId = idGeneratorPort.generateId();
        }

        const batch = new SuggestionBatch(batchId, documentUri, Date.now());
        batch.addSuggestion(suggestionId, size);

        return batch;
    }

    /**
     * Add suggestion to batch
     * @param {SuggestionBatch} batch - Batch entity
     * @param {string} suggestionId - Suggestion ID
     * @param {number} size - Suggestion size
     */
    addSuggestionToBatch(batch, suggestionId, size) {
        if (!batch || !(batch instanceof SuggestionBatch)) {
            throw new Error('SuggestionBatchServiceD.addSuggestionToBatch requires SuggestionBatch entity');
        }
        if (!suggestionId || size === undefined) {
            throw new Error('SuggestionBatchServiceD.addSuggestionToBatch requires suggestionId and size');
        }

        batch.addSuggestion(suggestionId, size);
    }

    /**
     * Update batch outcome
     * @param {SuggestionBatch} batch - Batch entity
     * @param {string} suggestionId - Suggestion ID
     * @param {string} outcome - Outcome: 'accepted' | 'rejected' | 'modified'
     */
    updateBatchOutcome(batch, suggestionId, outcome) {
        if (!batch || !(batch instanceof SuggestionBatch)) {
            throw new Error('SuggestionBatchServiceD.updateBatchOutcome requires SuggestionBatch entity');
        }
        if (!suggestionId || !outcome) {
            throw new Error('SuggestionBatchServiceD.updateBatchOutcome requires suggestionId and outcome');
        }

        const validOutcomes = ['accepted', 'rejected', 'modified'];
        if (!validOutcomes.includes(outcome)) {
            throw new Error(`SuggestionBatchServiceD.updateBatchOutcome: invalid outcome '${outcome}'`);
        }

        batch.recordOutcome(suggestionId, outcome);
    }

    /**
     * Detect keep-all pattern
     * @param {SuggestionBatch} batch - Batch entity
     * @returns {boolean} True if keep-all pattern
     */
    detectKeepAllPattern(batch) {
        if (!batch || !(batch instanceof SuggestionBatch)) {
            return false;
        }

        return batch.isKeepAllPattern();
    }

    /**
     * Calculate batch acceptance rate
     * @param {SuggestionBatch} batch - Batch entity
     * @returns {number} Acceptance rate (0-1)
     */
    calculateBatchAcceptanceRate(batch) {
        if (!batch || !(batch instanceof SuggestionBatch)) {
            return 0;
        }

        return batch.getAcceptanceRate();
    }

    /**
     * Determine if batches should merge
     * @param {SuggestionBatch} batch1 - First batch
     * @param {SuggestionBatch} batch2 - Second batch
     * @param {number} timeWindow - Time window in milliseconds
     * @returns {boolean} True if should merge
     */
    shouldMergeBatches(batch1, batch2, timeWindow) {
        if (!batch1 || !batch2 || !(batch1 instanceof SuggestionBatch) || !(batch2 instanceof SuggestionBatch)) {
            return false;
        }

        // Check if same file
        const filePath1 = batch1.filePath instanceof Object ? batch1.filePath.toString() : String(batch1.filePath);
        const filePath2 = batch2.filePath instanceof Object ? batch2.filePath.toString() : String(batch2.filePath);
        
        if (filePath1 !== filePath2) {
            return false;
        }

        // Check if within time window
        const timeDiff = Math.abs(batch1.timestamp - batch2.timestamp);
        return timeDiff <= timeWindow;
    }

    /**
     * Get batch metrics
     * @param {SuggestionBatch} batch - Batch entity
     * @returns {Object} Batch metrics
     */
    getBatchMetrics(batch) {
        if (!batch || !(batch instanceof SuggestionBatch)) {
            return {
                totalSuggestions: 0,
                acceptedCount: 0,
                rejectedCount: 0,
                modifiedCount: 0,
                acceptanceRate: 0,
                totalSize: 0,
                age: 0,
                status: 'unknown'
            };
        }

        return {
            totalSuggestions: batch.suggestionIds.length,
            acceptedCount: batch.acceptedCount,
            rejectedCount: batch.rejectedCount,
            modifiedCount: batch.modifiedCount,
            acceptanceRate: batch.getAcceptanceRate(),
            totalSize: batch.totalSize,
            age: batch.getAge(),
            status: batch.status,
            isFullyResolved: batch.isFullyResolved(),
            isKeepAllPattern: batch.isKeepAllPattern()
        };
    }
}

module.exports = SuggestionBatchServiceD;
