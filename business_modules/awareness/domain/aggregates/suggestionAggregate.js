/**
 * SuggestionAggregate - Aggregate root managing the collection of Suggestion entities
 * 
 * This aggregate manages the collection of suggestions, enforces invariants,
 * and provides query methods. It does NOT handle orchestration or callbacks.
 * 
 **Access Rules**:
- ✅ Only `SuggestionAggregate` can create `Suggestion` entities
- ✅ Only `SuggestionAggregate` can create `SuggestionBatch` entities
- ✅ Only `SuggestionAggregate` can modify suggestion status (via `updateSuggestionStatus()`)
- ✅ Only `SuggestionAggregate` can add suggestions to batches (via `addSuggestionToBatch()`)
- ✅ Only `SuggestionAggregate` can mutate review state (via `markSuggestionReviewed()`, `addSuggestionReviewTime()`)
- ✅ Only `SuggestionAggregate` can record user edits (via `recordUserEditOnSuggestion()`)
 */

const Suggestion = require('../entities/suggestion');
const SuggestionBatch = require('../entities/suggestionBatch');
const IIdGeneratorPort = require('../ports/IIdGeneratorPort');
const ILoggerPort = require('../ports/ILoggerPort');

class SuggestionAggregate {
    /**
     * @param {IIdGeneratorPort} idGeneratorPort - ID generator port (required)
     * @param {ILoggerPort} loggerPort - Logger port (optional)
     */
    constructor(idGeneratorPort, loggerPort = null) {
        if (!idGeneratorPort) {
            throw new Error('SuggestionAggregate requires idGeneratorPort');
        }
        
        this.idGeneratorPort = idGeneratorPort;
        this.loggerPort = loggerPort;
        
        // Collection storage
        this.suggestionsById = new Map(); // id -> Suggestion entity
        this.recentIds = []; // Capped to 10 for UI/quick feedback
        this.maxRecentSuggestions = 10;
        
        // Eviction policy
        this.MAX_TOTAL_SUGGESTIONS = 5000; // Global cap
        this._evictionThreshold = 0.9; // Evict when 90% full (4500)
        
        // Batch tracking
        this.batchesById = new Map(); // batchId -> SuggestionBatch
        this.suggestionsToBatch = new Map(); // suggestionId -> batchId
        
        // Per-document index for O(1) lookup
        this.pendingByDocUri = new Map(); // uri -> Set<id>
        
        // Legacy: aiSuggestions array for backward compatibility (derived from Map)
        Object.defineProperty(this, 'aiSuggestions', {
            get: () => Array.from(this.suggestionsById.values()),
            enumerable: true,
            configurable: true
        });
    }

    /**
     * Create a new Suggestion entity
     * @param {Object} options - Suggestion properties
     * @returns {Suggestion} New Suggestion entity
     */
    createSuggestion(options) {
        const {
            document,
            range,
            text,
            size,
            isFileCreation = false,
            isExternalCreation = false,
            isFileWrite = false,
            timestamp = Date.now(),
            classificationLabel,
            classificationConfidence,
            classificationReasons
        } = options;

        // Use ID generator port for ID generation
        let id;
        try {
            id = this.idGeneratorPort.generateUUID();
        } catch (e) {
            // Fallback if UUID generation fails
            id = this.idGeneratorPort.generateId();
        }
        
        return new Suggestion(id, document, range, text, size, {
            isFileCreation,
            isExternalCreation,
            isFileWrite,
            timestamp,
            classificationLabel,
            classificationConfidence,
            classificationReasons
        });
    }

    /**
     * Add a suggestion to the aggregate
     * Enforces eviction policy and maintains indexes
     * @param {Suggestion} suggestion - Suggestion entity to add
     */
    addSuggestion(suggestion) {
        if (!(suggestion instanceof Suggestion)) {
            throw new Error('SuggestionAggregate.addSuggestion requires a Suggestion entity');
        }
        
        const id = suggestion.id;
        
        // Enforce global cap with eviction policy
        if (this.suggestionsById.size >= this.MAX_TOTAL_SUGGESTIONS * this._evictionThreshold) {
            this._evictSuggestions();
        }
        
        // Store in authoritative Map
        this.suggestionsById.set(id, suggestion);
        
        // Update per-document index for O(1) lookup
        const docUri = suggestion.document;
        if (!this.pendingByDocUri.has(docUri)) {
            this.pendingByDocUri.set(docUri, new Set());
        }
        if (suggestion.isPending()) {
            this.pendingByDocUri.get(docUri).add(id);
        }
        
        // Add to recent IDs for UI (capped)
        if (!this.recentIds.includes(id)) {
            this.recentIds.push(id);
        }
        
        // Keep only last maxRecentSuggestions in recent list
        if (this.recentIds.length > this.maxRecentSuggestions) {
            const removedId = this.recentIds.shift();
            // Only remove from Map if suggestion is resolved (not pending)
            const removed = this.suggestionsById.get(removedId);
            if (removed && !removed.isPending()) {
                this.suggestionsById.delete(removedId);
            }
        }
    }

    /**
     * Update suggestion status and maintain index consistency
     * @param {Suggestion} suggestion - Suggestion entity
     * @param {string} newStatus - New status
     */
    updateSuggestionStatus(suggestion, newStatus) {
        if (!(suggestion instanceof Suggestion)) {
            throw new Error('SuggestionAggregate.updateSuggestionStatus requires a Suggestion entity');
        }
        
        const wasPending = suggestion.isPending();
        suggestion.updateStatus(newStatus);
        
        // Update index if status changed from pending to resolved
        if (wasPending && suggestion.isResolved()) {
            this._removeFromPendingIndex(suggestion);
        }
    }

    /**
     * Mark suggestion as reviewed (single authority for review state)
     * @param {string} suggestionId - Suggestion ID
     * @param {Object} options - Review options
     * @param {number} options.reviewTimeDeltaMs - Additional review time in milliseconds (accumulated)
     * @param {number} options.reviewStartedAt - Timestamp when review started (optional)
     */
    markSuggestionReviewed(suggestionId, options = {}) {
        const suggestion = this.suggestionsById.get(suggestionId);
        if (!suggestion) {
            return; // Suggestion not found
        }

        const { reviewTimeDeltaMs = 0, reviewStartedAt = null } = options;

        // Accumulate review time (not overwrite)
        suggestion.reviewed = true;
        suggestion.reviewTime = (suggestion.reviewTime || 0) + reviewTimeDeltaMs;
        
        if (reviewStartedAt !== null) {
            suggestion.reviewStarted = reviewStartedAt;
        } else if (!suggestion.reviewStarted) {
            suggestion.reviewStarted = Date.now();
        }
    }

    /**
     * Add review time to suggestion (accumulates)
     * @param {string} suggestionId - Suggestion ID
     * @param {number} deltaMs - Additional review time in milliseconds
     */
    addSuggestionReviewTime(suggestionId, deltaMs) {
        const suggestion = this.suggestionsById.get(suggestionId);
        if (!suggestion) {
            return; // Suggestion not found
        }

        // Accumulate review time
        suggestion.reviewTime = (suggestion.reviewTime || 0) + deltaMs;
    }

    /**
     * Record user edit on suggestion (single authority)
     * @param {string} suggestionId - Suggestion ID
     */
    recordUserEditOnSuggestion(suggestionId) {
        const suggestion = this.suggestionsById.get(suggestionId);
        if (!suggestion) {
            return; // Suggestion not found
        }

        suggestion.recordUserEdit();
    }

    /**
     * Get all suggestions
     * @returns {Array<Suggestion>} Array of Suggestion entities
     */
    getSuggestions() {
        return Array.from(this.suggestionsById.values());
    }

    /**
     * Get suggestions by status
     * @param {string} status - Status to filter by
     * @returns {Array<Suggestion>} Filtered suggestions
     */
    getSuggestionsByStatus(status) {
        return this.getSuggestions().filter(s => s.status === status);
    }

    /**
     * Find a suggestion by ID
     * @param {string} id - Suggestion ID
     * @returns {Suggestion|null} Suggestion entity or null
     */
    findSuggestion(id) {
        return this.suggestionsById.get(id) || null;
    }

    /**
     * Check if file has pending suggestions
     * @param {string} documentUri - Document URI string
     * @returns {boolean} True if file has pending suggestions
     */
    hasPendingSuggestions(documentUri) {
        const pendingIds = this.pendingByDocUri.get(documentUri);
        return !!pendingIds && pendingIds.size > 0;
    }

    /**
     * Get pending suggestions for a file
     * @param {string} documentUri - Document URI string
     * @returns {Array<Suggestion>} Array of pending suggestions
     */
    getPendingSuggestionsForFile(documentUri) {
        const pendingIds = this.pendingByDocUri.get(documentUri);
        if (!pendingIds || pendingIds.size === 0) {
            return [];
        }
        
        return Array.from(pendingIds)
            .map(id => this.suggestionsById.get(id))
            .filter(s => s && s.isPending());
    }

    /**
     * Add suggestion to batch (first-class aggregate operation)
     * Sets batchId on suggestion entity and maintains batch mapping
     * @param {string} documentUri - Document URI
     * @param {string} suggestionId - Suggestion ID
     * @param {number} size - Size of the suggestion
     * @returns {string} Batch ID
     */
    addSuggestionToBatch(documentUri, suggestionId, size) {
        const suggestion = this.suggestionsById.get(suggestionId);
        if (!suggestion) {
            throw new Error(`Suggestion ${suggestionId} not found in aggregate`);
        }

        // Check if suggestion is already in a batch
        let batchId = this.suggestionsToBatch.get(suggestionId);
        
        if (batchId) {
            // Update existing batch
            const batch = this.batchesById.get(batchId);
            if (batch) {
                batch.addSuggestion(suggestionId, size);
                // Ensure batchId is set on entity (invariant enforcement)
                suggestion.batchId = batchId;
                return batchId;
            }
        }
        
        // Create new batch
        try {
            batchId = this.idGeneratorPort.generateUUID();
        } catch (e) {
            batchId = this.idGeneratorPort.generateId();
        }
        const batch = new SuggestionBatch(batchId, documentUri, Date.now());
        batch.addSuggestion(suggestionId, size);
        
        this.batchesById.set(batchId, batch);
        this.suggestionsToBatch.set(suggestionId, batchId);
        
        // Set batchId on entity (invariant enforcement - aggregate owns this)
        suggestion.batchId = batchId;
        
        return batchId;
    }

    /**
     * Get batch ID for a suggestion
     * @param {string} suggestionId - Suggestion ID
     * @returns {string|null} Batch ID or null
     */
    getBatchIdForSuggestion(suggestionId) {
        return this.suggestionsToBatch.get(suggestionId) || null;
    }

    /**
     * Create or update a batch for a suggestion (deprecated - use addSuggestionToBatch)
     * @deprecated Use addSuggestionToBatch instead
     * @param {string} documentUri - Document URI
     * @param {string} suggestionId - Suggestion ID
     * @param {number} size - Size of the suggestion
     * @returns {string} Batch ID
     */
    createOrUpdateBatch(documentUri, suggestionId, size) {
        return this.addSuggestionToBatch(documentUri, suggestionId, size);
    }

    /**
     * Get batch by ID
     * @param {string} batchId - Batch ID
     * @returns {SuggestionBatch|null} Batch entity or null
     */
    getBatch(batchId) {
        return this.batchesById.get(batchId) || null;
    }

    /**
     * Update batch outcome when suggestion status changes
     * Uses aggregate's batch mapping (not suggestion.batchId) for consistency
     * @param {Suggestion} suggestion - Suggestion entity
     */
    updateBatchOutcome(suggestion) {
        // Use aggregate's mapping (single source of truth)
        const batchId = this.suggestionsToBatch.get(suggestion.id);
        if (!batchId) return;
        
        const batch = this.batchesById.get(batchId);
        if (!batch) return;
        
        batch.recordOutcome(suggestion.id, suggestion.status);
    }

    /**
     * Get suggestion metrics
     * @returns {Object} Metrics object with total and pending counts
     */
    getSuggestionMetrics() {
        const total = this.suggestionsById.size;
        const pending = this.getSuggestionsByStatus('pending').length;
        
        return { total, pending };
    }

    _evictSuggestions() {
        const targetSize = Math.floor(this.MAX_TOTAL_SUGGESTIONS * 0.8);
        const currentSize = this.suggestionsById.size;
        
        if (currentSize < targetSize) {
            return; // Not at threshold yet
        }
        
        // Collect non-pending suggestions first (safe to evict)
        const nonPending = [];
        const pending = [];
        
        for (const [id, suggestion] of this.suggestionsById.entries()) {
            if (suggestion.isPending()) {
                pending.push({ id, suggestion, timestamp: suggestion.timestamp || 0 });
            } else {
                nonPending.push({ id, suggestion, timestamp: suggestion.statusTimestamp || suggestion.timestamp || 0 });
            }
        }
        
        // Sort by timestamp (oldest first)
        nonPending.sort((a, b) => a.timestamp - b.timestamp);
        pending.sort((a, b) => a.timestamp - b.timestamp);
        
        // Evict non-pending first
        let evicted = 0;
        for (const { id } of nonPending) {
            if (this.suggestionsById.size <= targetSize) break;
            this.suggestionsById.delete(id);
            // Remove from recentIds if present
            const recentIndex = this.recentIds.indexOf(id);
            if (recentIndex >= 0) {
                this.recentIds.splice(recentIndex, 1);
            }
            evicted++;
        }
        
        // If still over limit, evict oldest pending (last resort)
        for (const { id, suggestion } of pending) {
            if (this.suggestionsById.size <= targetSize) break;
            
            // Remove from authoritative Map
            this.suggestionsById.delete(id);
            
            // Remove from index to maintain consistency
            this._removeFromPendingIndex(suggestion);
            
            // Also remove from recentIds if present
            const recentIndex = this.recentIds.indexOf(id);
            if (recentIndex >= 0) {
                this.recentIds.splice(recentIndex, 1);
            }
            
            evicted++;
        }
        
        // Log eviction for monitoring
        if (evicted > 0) {
            const { total, pending: pendingCount } = this.getSuggestionMetrics();
            if (this.loggerPort) {
                this.loggerPort.log(`[SuggestionAggregate] Evicted ${evicted} suggestions (total: ${total}, pending: ${pendingCount})`);
            }
        }
    }

    _removeFromPendingIndex(suggestion) {
        const docUri = suggestion.document;
        const pendingIds = this.pendingByDocUri.get(docUri);
        if (pendingIds) {
            pendingIds.delete(suggestion.id);
            // Clean up empty sets
            if (pendingIds.size === 0) {
                this.pendingByDocUri.delete(docUri);
            }
        }
    }
}

module.exports = SuggestionAggregate;
