/**
 * DOMAIN LAYER - CONSOLIDATED (PART 1/3)
 * 
 * This file contains part 1 of 3 of the domain layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 20/49
 * Generated: 2026-01-13T15:56:48.087Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 1/49: domain/aggregates/suggestionAggregate.js
// ============================================================================

(function() { // IIFE scope for domain/aggregates/suggestionAggregate.js
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
- ✅ Only `SuggestionAggregate` can add suggestions to batches
 */

// const Suggestion = require('../entities/suggestion'); // Commented for consolidation
// const SuggestionBatch = require('../entities/suggestionBatch'); // Commented for consolidation
// const IIdGeneratorPort = require('../ports/IIdGeneratorPort'); // Commented for consolidation
// const ILoggerPort = require('../ports/ILoggerPort'); // Commented for consolidation

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
     * Create or update a batch for a suggestion
     * @param {string} documentUri - Document URI
     * @param {string} suggestionId - Suggestion ID
     * @param {number} size - Size of the suggestion
     * @returns {string} Batch ID
     */
    createOrUpdateBatch(documentUri, suggestionId, size) {
        // Check if suggestion is already in a batch
        let batchId = this.suggestionsToBatch.get(suggestionId);
        
        if (batchId) {
            // Update existing batch
            const batch = this.batchesById.get(batchId);
            if (batch) {
                batch.addSuggestion(suggestionId, size);
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
        
        return batchId;
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
     * @param {Suggestion} suggestion - Suggestion entity
     */
    updateBatchOutcome(suggestion) {
        if (!suggestion.batchId) return;
        
        const batch = this.batchesById.get(suggestion.batchId);
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

// module.exports = SuggestionAggregate; // Commented for consolidation

})(); // End IIFE for domain/aggregates/suggestionAggregate.js


// ============================================================================
// FILE 2/49: domain/entities/change.js
// ============================================================================

(function() { // IIFE scope for domain/entities/change.js
/**
 * Change - Domain entity representing a text document change
 * 
 * This is a core domain entity with identity (id) that encapsulates
 * a single text document change and its classification state.
 */

class Change {
    /**
     * @param {string} id - Unique identifier for the change
     * @param {string} documentUri - Document URI where change occurred
     * @param {Object} range - Text range (start/end positions)
     * @param {string} text - Inserted text content
     * @param {number} rangeLength - Length of deleted text
     * @param {number} timestamp - When change occurred (default: Date.now())
     * @param {Object} options - Additional options
     * @param {string} options.batchId - Batch ID if part of a batch
     * @param {Object} options.classification - Pre-classified result
     */
    constructor(id, documentUri, range, text, rangeLength, timestamp = null, options = {}) {
        if (!id) {
            throw new Error('Change requires an id');
        }
        if (!documentUri) {
            throw new Error('Change requires a documentUri');
        }
        if (!range) {
            throw new Error('Change requires a range');
        }
        if (text === undefined || text === null) {
            throw new Error('Change requires text (can be empty string)');
        }
        if (rangeLength === undefined || rangeLength === null) {
            throw new Error('Change requires rangeLength');
        }
        
        this.id = id;
        this.documentUri = documentUri;
        this.range = range;
        this.text = text;
        this.rangeLength = rangeLength;
        this.timestamp = timestamp || Date.now();
        
        // Calculated properties
        this.size = text.length; // Inserted size
        this.deletedSize = rangeLength; // Deleted size
        this.netSize = this.size - this.deletedSize; // Net change size
        
        // Classification state
        this.classification = options.classification || null; // {label, confidence, reasons, meta}
        this.classifiedAt = null;
        
        // Metadata
        this.batchId = options.batchId || null;
        this.source = 'unknown'; // 'ai', 'user', 'formatter', 'unknown' - updated on classification
    }
    
    /**
     * Classify this change
     * @param {Object} classification - Classification result {label, confidence, reasons, meta}
     */
    classify(classification) {
        if (!classification) {
            throw new Error('Change.classify() requires classification object');
        }
        if (!classification.label) {
            throw new Error('Classification must have a label');
        }
        
        this.classification = classification;
        this.classifiedAt = Date.now();
        this.source = classification.label;
    }
    
    /**
     * Check if change is classified
     * @returns {boolean}
     */
    isClassified() {
        return !!this.classification;
    }
    
    /**
     * Check if change is classified as AI-generated
     * @returns {boolean}
     */
    isAI() {
        return this.classification?.label === 'ai';
    }
    
    /**
     * Check if change is classified as user-made
     * @returns {boolean}
     */
    isUser() {
        return this.classification?.label === 'user';
    }
    
    /**
     * Check if change is classified as formatter
     * @returns {boolean}
     */
    isFormatter() {
        return this.classification?.label === 'formatter';
    }
    
    /**
     * Check if change is unknown/unclassified
     * @returns {boolean}
     */
    isUnknown() {
        return !this.classification || this.classification.label === 'unknown';
    }
    
    /**
     * Get classification confidence (0-1)
     * @returns {number}
     */
    getConfidence() {
        return this.classification?.confidence || 0;
    }
    
    /**
     * Get classification reasons
     * @returns {Array<string>}
     */
    getReasons() {
        return this.classification?.reasons || [];
    }
    
    /**
     * Check if this is a pure insertion (no deletion)
     * @returns {boolean}
     */
    isPureInsertion() {
        return this.deletedSize === 0 && this.size > 0;
    }
    
    /**
     * Check if this is a pure deletion (no insertion)
     * @returns {boolean}
     */
    isPureDeletion() {
        return this.size === 0 && this.deletedSize > 0;
    }
    
    /**
     * Check if this is a replacement (both insertion and deletion)
     * @returns {boolean}
     */
    isReplacement() {
        return this.size > 0 && this.deletedSize > 0;
    }
    
    /**
     * Check if change is multi-line
     * @returns {boolean}
     */
    isMultiLine() {
        return this.text.includes('\n');
    }
    
    /**
     * Get line span (number of lines affected)
     * @returns {number}
     */
    getLineSpan() {
        return this.range.end.line - this.range.start.line;
    }
}

// module.exports = Change; // Commented for consolidation

})(); // End IIFE for domain/entities/change.js


// ============================================================================
// FILE 3/49: domain/entities/debt.js
// ============================================================================

(function() { // IIFE scope for domain/entities/debt.js
/**
 * Debt - Domain entity representing review debt for a single file
 * 
 * Encapsulates the business concept of unreviewed code changes in a file.
 * This is a domain entity with identity (file URI) that tracks review state.
 */

class Debt {
    /**
     * @param {string} fileUri - Canonical URI string for the file
     * @param {Object} options - Optional initial state
     * @param {number} options.modifiedAt - Timestamp when debt was first created
     * @param {number} options.totalChanges - Total size of changes
     * @param {number} options.modificationCount - Number of modifications
     * @param {boolean} options.reviewed - Whether debt has been reviewed
     * @param {number} options.reviewedAt - Timestamp when reviewed
     * @param {number} options.totalReviewTime - Total time spent reviewing
     * @param {number} options.firstOpenedAt - Timestamp when first opened
     * @param {number} options.lastVisitedAt - Timestamp of last visit
     * @param {number} options.reviewSessions - Number of review sessions
     */
    constructor(fileUri, options = {}) {
        if (!fileUri) {
            throw new Error('Debt requires a file URI');
        }
        
        this.fileUri = fileUri;
        const now = Date.now();
        
        this.modifiedAt = options.modifiedAt || now;
        this.lastModifiedAt = options.lastModifiedAt || now;
        this.totalChanges = options.totalChanges || 0;
        this.modificationCount = options.modificationCount || 0;
        this.reviewed = options.reviewed || false;
        this.reviewedAt = options.reviewedAt || null;
        this.totalReviewTime = options.totalReviewTime || 0;
        this.firstOpenedAt = options.firstOpenedAt || null;
        this.lastVisitedAt = options.lastVisitedAt || null;
        this.reviewSessions = options.reviewSessions || 0;
    }

    /**
     * Add a change to this debt
     * @param {number} changeSize - Size of the change
     */
    addChange(changeSize) {
        if (this.reviewed) {
            // File was reviewed but new changes came in - reset to unreviewed
            const now = Date.now();
            this.modifiedAt = now;
            this.lastModifiedAt = now;
            this.totalChanges = changeSize;
            this.modificationCount = 1;
            this.reviewed = false;
            this.reviewedAt = null;
        } else {
            // Accumulate changes
            this.totalChanges += changeSize;
            this.lastModifiedAt = Date.now();
            this.modificationCount++;
        }
    }

    /**
     * Mark debt as reviewed
     * @param {number} reviewTime - Time spent reviewing in milliseconds
     */
    markAsReviewed(reviewTime = 0) {
        this.reviewed = true;
        this.reviewedAt = Date.now();
        this.totalReviewTime += reviewTime;
    }

    /**
     * Update session information
     * @param {Object} sessionData - Session data
     * @param {number} sessionData.sessionStart - Session start timestamp
     */
    updateSession(sessionData) {
        if (!this.firstOpenedAt && sessionData.sessionStart) {
            this.firstOpenedAt = sessionData.sessionStart;
        }
        this.lastVisitedAt = Date.now();
        this.reviewSessions = (this.reviewSessions || 0) + 1;
    }

    /**
     * Check if debt is reviewed
     * @returns {boolean} True if reviewed
     */
    isReviewed() {
        return this.reviewed;
    }

    /**
     * Get age of debt in milliseconds
     * @returns {number} Age in ms
     */
    getAge() {
        return Date.now() - this.modifiedAt;
    }

    /**
     * Convert to plain object for persistence
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            modifiedAt: this.modifiedAt,
            lastModifiedAt: this.lastModifiedAt,
            totalChanges: this.totalChanges,
            modificationCount: this.modificationCount,
            reviewed: this.reviewed,
            reviewedAt: this.reviewedAt,
            totalReviewTime: this.totalReviewTime,
            firstOpenedAt: this.firstOpenedAt,
            lastVisitedAt: this.lastVisitedAt,
            reviewSessions: this.reviewSessions
        };
    }

    /**
     * Create from plain object (for loading from persistence)
     * @param {string} fileUri - File URI
     * @param {Object} data - Plain object data
     * @returns {Debt} Debt instance
     */
    static fromJSON(fileUri, data) {
        return new Debt(fileUri, data);
    }
}

// module.exports = Debt; // Commented for consolidation

})(); // End IIFE for domain/entities/debt.js


// ============================================================================
// FILE 4/49: domain/entities/reviewSession.js
// ============================================================================

(function() { // IIFE scope for domain/entities/reviewSession.js
/**
 * ReviewSession - Entity representing a user's review session for a file
 * 
 * Tracks detailed review engagement metrics for a single file review session.
 * This is a domain entity with identity (filePath + sessionStart).
 */

// const FilePath = require('../value_objects/filePath'); // Commented for consolidation

class ReviewSession {
    /**
     * @param {string|FilePath} filePath - File being reviewed
     * @param {number} sessionStart - Timestamp when session started
     */
    constructor(filePath, sessionStart = Date.now()) {
        this.filePath = filePath instanceof FilePath ? filePath : new FilePath(filePath);
        this.sessionStart = sessionStart;
        this.lastActivity = sessionStart;
        this.cursorMovements = 0;
        this.scrollEvents = 0;
        this.reviewTime = 0;
        this.isActive = true;
        this.completedAt = null;
    }

    /**
     * Update cursor activity
     */
    recordCursorMovement() {
        if (!this.isActive) return;
        this.cursorMovements++;
        this.lastActivity = Date.now();
    }

    /**
     * Update scroll activity
     */
    recordScrollEvent() {
        if (!this.isActive) return;
        this.scrollEvents++;
        this.lastActivity = Date.now();
        // Count scrolling as cursor movement for review purposes
        this.cursorMovements++;
    }

    /**
     * Check if session has sufficient engagement
     * @param {number} minimumReviewTime - Minimum review time in ms (default: 30000)
     * @param {number} minimumMovements - Minimum cursor movements (default: 5)
     * @param {number} minimumScrolls - Minimum scroll events (default: 3)
     * @returns {boolean} True if session meets engagement criteria
     */
    hasSufficientEngagement(minimumReviewTime = 30000, minimumMovements = 5, minimumScrolls = 3) {
        const duration = Date.now() - this.sessionStart;
        return duration >= minimumReviewTime && 
               (this.cursorMovements >= minimumMovements || this.scrollEvents >= minimumScrolls);
    }

    /**
     * Check if session has timed out due to inactivity
     * @param {number} timeoutMs - Inactivity timeout in ms (default: 60000)
     * @returns {boolean} True if session has timed out
     */
    hasTimedOut(timeoutMs = 60000) {
        const timeSinceActivity = Date.now() - this.lastActivity;
        return timeSinceActivity > timeoutMs;
    }

    /**
     * Complete the session
     * @param {number} reviewTime - Total review time in ms
     */
    complete(reviewTime = null) {
        this.isActive = false;
        this.completedAt = Date.now();
        this.reviewTime = reviewTime || (this.completedAt - this.sessionStart);
    }

    /**
     * Get session duration
     * @returns {number} Duration in milliseconds
     */
    getDuration() {
        if (this.completedAt) {
            return this.completedAt - this.sessionStart;
        }
        return Date.now() - this.sessionStart;
    }

    /**
     * Get time since last activity
     * @returns {number} Milliseconds since last activity
     */
    getTimeSinceActivity() {
        return Date.now() - this.lastActivity;
    }

    /**
     * Check if this session is for the given file
     * @param {string|FilePath} filePath - File path to check
     * @returns {boolean} True if session is for this file
     */
    isForFile(filePath) {
        const comparePath = filePath instanceof FilePath ? filePath : new FilePath(filePath);
        return this.filePath.equals(comparePath);
    }

    /**
     * Get engagement score (0-100)
     * Based on duration, movements, and scrolls
     * @returns {number} Engagement score
     */
    getEngagementScore() {
        const duration = this.getDuration();
        const durationScore = Math.min((duration / 60000) * 40, 40); // Max 40 points for duration
        const movementScore = Math.min((this.cursorMovements / 20) * 30, 30); // Max 30 points
        const scrollScore = Math.min((this.scrollEvents / 10) * 30, 30); // Max 30 points
        
        return Math.min(durationScore + movementScore + scrollScore, 100);
    }
}

// module.exports = ReviewSession; // Commented for consolidation

})(); // End IIFE for domain/entities/reviewSession.js


// ============================================================================
// FILE 5/49: domain/entities/suggestion.js
// ============================================================================

(function() { // IIFE scope for domain/entities/suggestion.js
/**
 * Suggestion - Domain entity 
 * 
  **Represents**: An AI-generated code suggestion that needs review
- **Scope**: Only AI-generated changes that become "suggestions"
- **Lifecycle**: Long-lived, tracked until resolved (accepted/rejected/adapted)
- **When Created**: Only after a `Change` is classified as AI-generated
 * This is a core domain entity with identity (id) that encapsulates
 * the business concept of an AI suggestion and its lifecycle state.
 */

class Suggestion {
    /**
     * @param {string} id - Unique identifier for the suggestion
     * @param {string} document - Document URI where suggestion was made
     * @param {Object} range - Text range (start/end positions)
     * @param {string} text - Suggested text content
     * @param {number} size - Size of the suggestion in characters
     * @param {Object} options - Additional options
     * @param {boolean} options.isFileCreation - Whether this is a file creation
     * @param {boolean} options.isExternalCreation - Whether file was created externally
     * @param {boolean} options.isFileWrite - Whether this is a file write operation
     * @param {number} options.timestamp - Creation timestamp (default: Date.now())
     * @param {string} options.classificationLabel - Classification label from Change entity ('ai')
     * @param {number} options.classificationConfidence - Classification confidence (0-1)
     * @param {Array<string>} options.classificationReasons - Classification reasons
     */
    constructor(id, document, range, text, size, options = {}) {
        if (!id) {
            throw new Error('Suggestion requires an id');
        }
        if (!document) {
            throw new Error('Suggestion requires a document URI');
        }
        if (!range) {
            throw new Error('Suggestion requires a range');
        }
        if (size === undefined || size === null) {
            throw new Error('Suggestion requires a size');
        }
        
        this.id = id;
        this.document = document;
        this.range = range;
        this.text = text;
        this.size = size;
        this.timestamp = options.timestamp || Date.now();
        
        // Lifecycle state
        this.reviewed = false;
        this.reviewTime = 0;
        this.reviewStarted = null;
        
        this.status = 'pending'; // 'pending' | 'accepted' | 'rejected' | 'adapted'
        this.statusTimestamp = null;
        
        // User interaction tracking
        this.userEdited = false;
        this.editCount = 0;
        
        // Metadata
        this.isFileCreation = options.isFileCreation || false;
        this.isExternalCreation = options.isExternalCreation || false;
        this.isFileWrite = options.isFileWrite || false;
        
        // Classification metadata (preserved from Change entity)
        this.classificationLabel = options.classificationLabel || 'ai'; // Default to 'ai' since only AI creates suggestions
        this.classificationConfidence = options.classificationConfidence || null;
        this.classificationReasons = options.classificationReasons || [];
    }

    /**
     * Mark suggestion as reviewed
     * @param {number} reviewTime - Time spent reviewing in milliseconds
     * @param {number} reviewStarted - Timestamp when review started (optional, defaults to now)
     */
    markAsReviewed(reviewTime = 0, reviewStarted = null) {
        this.reviewed = true;
        this.reviewTime = reviewTime;
        if (reviewStarted !== null) {
            this.reviewStarted = reviewStarted;
        } else if (!this.reviewStarted) {
            this.reviewStarted = Date.now();
        }
    }

    /**
     * Record user edit interaction
     */
    recordUserEdit() {
        this.userEdited = true;
        this.editCount = (this.editCount || 0) + 1;
    }

    /**
     * Update suggestion status
     * @param {string} status - New status ('pending' | 'accepted' | 'rejected' | 'adapted')
     */
    updateStatus(status) {
        if (!['pending', 'accepted', 'rejected', 'adapted'].includes(status)) {
            throw new Error(`Invalid status: ${status}`);
        }
        this.status = status;
        this.statusTimestamp = Date.now();
    }

    /**
     * Check if suggestion is pending
     * @returns {boolean} True if status is 'pending'
     */
    isPending() {
        return this.status === 'pending';
    }

    /**
     * Check if suggestion is resolved (not pending)
     * @returns {boolean} True if status is not 'pending'
     */
    isResolved() {
        return this.status !== 'pending';
    }

    /**
     * Get age of suggestion in milliseconds
     * @returns {number} Age in ms
     */
    getAge() {
        return Date.now() - this.timestamp;
    }

    /**
     * Check if suggestion is for a specific document
     * @param {string} documentUri - Document URI to check
     * @returns {boolean} True if suggestion is for this document
     */
    isForDocument(documentUri) {
        return this.document === documentUri;
    }
}

// module.exports = Suggestion; // Commented for consolidation

})(); // End IIFE for domain/entities/suggestion.js


// ============================================================================
// FILE 6/49: domain/entities/suggestionBatch.js
// ============================================================================

(function() { // IIFE scope for domain/entities/suggestionBatch.js
/**
 * SuggestionBatch - Entity representing a batch of related AI suggestions
 * 
 * Groups suggestions that were created together (e.g., from a single AI refactor).
 * This helps track batch acceptance patterns and prevents treating each change
 * as a separate suggestion.
 */

// const SuggestionId = require('../value_objects/suggestionId'); // Commented for consolidation
// const FilePath = require('../value_objects/filePath'); // Commented for consolidation

class SuggestionBatch {
    /**
     * @param {string} batchId - Unique batch identifier
     * @param {string|FilePath} filePath - File where batch was created
     * @param {number} timestamp - When batch was created
     */
    constructor(batchId, filePath, timestamp = Date.now()) {
        this.batchId = batchId;
        this.filePath = filePath instanceof FilePath ? filePath : new FilePath(filePath);
        this.timestamp = timestamp;
        this.suggestionIds = []; // Array of SuggestionId
        this.totalSize = 0;
        this.status = 'pending'; // 'pending' | 'partially_accepted' | 'fully_accepted' | 'rejected'
        this.acceptedCount = 0;
        this.rejectedCount = 0;
        this.modifiedCount = 0;
    }

    /**
     * Add a suggestion to this batch
     * @param {string|SuggestionId} suggestionId - Suggestion ID
     * @param {number} size - Size of the suggestion
     */
    addSuggestion(suggestionId, size) {
        // Store as string for simplicity (can convert to SuggestionId if needed)
        const idStr = suggestionId instanceof SuggestionId ? suggestionId.toString() : String(suggestionId);
        if (!this.suggestionIds.find(sid => {
            const sidStr = sid instanceof SuggestionId ? sid.toString() : String(sid);
            return sidStr === idStr;
        })) {
            this.suggestionIds.push(idStr);
            this.totalSize += size;
        }
    }

    /**
     * Record outcome for a suggestion in this batch
     * @param {string|SuggestionId} suggestionId - Suggestion ID
     * @param {string} outcome - 'accepted' | 'rejected' | 'modified'
     */
    recordOutcome(suggestionId, outcome) {
        const idStr = suggestionId instanceof SuggestionId ? suggestionId.toString() : String(suggestionId);
        if (!this.suggestionIds.find(sid => {
            const sidStr = sid instanceof SuggestionId ? sid.toString() : String(sid);
            return sidStr === idStr;
        })) {
            return; // Suggestion not in this batch
        }

        if (outcome === 'accepted') {
            this.acceptedCount++;
        } else if (outcome === 'rejected') {
            this.rejectedCount++;
        } else if (outcome === 'modified') {
            this.modifiedCount++;
        }

        this._updateStatus();
    }

    _updateStatus() {
        const total = this.suggestionIds.length;
        const resolved = this.acceptedCount + this.rejectedCount + this.modifiedCount;

        if (resolved === 0) {
            this.status = 'pending';
        } else if (resolved === total) {
            if (this.acceptedCount === total) {
                this.status = 'fully_accepted';
            } else if (this.rejectedCount === total) {
                this.status = 'rejected';
            } else {
                this.status = 'partially_accepted';
            }
        } else {
            this.status = 'partially_accepted';
        }
    }

    /**
     * Check if batch is fully resolved
     * @returns {boolean} True if all suggestions have outcomes
     */
    isFullyResolved() {
        const total = this.suggestionIds.length;
        const resolved = this.acceptedCount + this.rejectedCount + this.modifiedCount;
        return resolved === total;
    }

    /**
     * Check if batch represents a "keep all" pattern
     * @returns {boolean} True if all suggestions were accepted without modification
     */
    isKeepAllPattern() {
        return this.status === 'fully_accepted' && 
               this.suggestionIds.length >= 3 && // At least 3 suggestions
               this.modifiedCount === 0; // No modifications
    }

    /**
     * Get acceptance rate (0-1)
     * @returns {number} Acceptance rate
     */
    getAcceptanceRate() {
        const total = this.suggestionIds.length;
        if (total === 0) return 0;
        return this.acceptedCount / total;
    }

    /**
     * Get batch age in milliseconds
     * @returns {number} Age in ms
     */
    getAge() {
        return Date.now() - this.timestamp;
    }

    /**
     * Get suggestion IDs as strings (for event publishing)
     * @returns {Array<string>} Array of suggestion ID strings
     */
    getSuggestionIdStrings() {
        return this.suggestionIds.map(id => {
            return id instanceof SuggestionId ? id.toString() : String(id);
        });
    }
}

// module.exports = SuggestionBatch; // Commented for consolidation

})(); // End IIFE for domain/entities/suggestionBatch.js


// ============================================================================
// FILE 7/49: domain/events/aiSuggestionEvent.js
// ============================================================================

(function() { // IIFE scope for domain/events/aiSuggestionEvent.js
/**
 * AISuggestionEvent - Domain event for AI-generated code suggestions
 * 
 * Published when the AI agent generates a code suggestion that needs review.
 */

class AISuggestionEvent {
    constructor({ suggestionId, filePath, range, changeSize, reason, occurredAt = new Date() }) {
        this.suggestionId = suggestionId;
        this.filePath = filePath;
        this.range = range;
        this.changeSize = changeSize;
        this.reason = reason;
        this.occurredAt = occurredAt;
        this.eventType = 'AISuggestionEvent';
    }

    toJSON() {
        return {
            eventType: this.eventType,
            suggestionId: this.suggestionId,
            filePath: this.filePath,
            range: this.range,
            changeSize: this.changeSize,
            reason: this.reason,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

// module.exports = AISuggestionEvent; // Commented for consolidation


})(); // End IIFE for domain/events/aiSuggestionEvent.js


// ============================================================================
// FILE 8/49: domain/events/aiSuggestionOutcomeEvent.js
// ============================================================================

(function() { // IIFE scope for domain/events/aiSuggestionOutcomeEvent.js
/**
 * AISuggestionOutcomeEvent - Domain event for AI suggestion outcomes
 * 
 * Published when a user accepts, rejects, or modifies an AI suggestion.
 */

class AISuggestionOutcomeEvent {
    constructor({ suggestionId, outcome, filePath, occurredAt = new Date() }) {
        if (!['accepted', 'rejected', 'modified'].includes(outcome)) {
            throw new Error(`Invalid outcome: ${outcome}. Must be 'accepted', 'rejected', or 'modified'`);
        }
        
        this.suggestionId = suggestionId;
        this.outcome = outcome;
        this.filePath = filePath;
        this.occurredAt = occurredAt;
        this.eventType = 'AISuggestionOutcomeEvent';
    }

    toJSON() {
        return {
            eventType: this.eventType,
            suggestionId: this.suggestionId,
            outcome: this.outcome,
            filePath: this.filePath,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

// module.exports = AISuggestionOutcomeEvent; // Commented for consolidation


})(); // End IIFE for domain/events/aiSuggestionOutcomeEvent.js


// ============================================================================
// FILE 9/49: domain/events/debtClearedEvent.js
// ============================================================================

(function() { // IIFE scope for domain/events/debtClearedEvent.js
/**
 * DebtClearedEvent - Domain event for debt clearance
 * 
 * Published when review debt is cleared (user reviews all pending files).
 */

class DebtClearedEvent {
    constructor({ clearedFiles, totalDebtCleared, occurredAt = new Date() }) {
        this.clearedFiles = clearedFiles || [];
        this.totalDebtCleared = totalDebtCleared;
        this.occurredAt = occurredAt;
        this.eventType = 'DebtClearedEvent';
    }

    toJSON() {
        return {
            eventType: this.eventType,
            clearedFiles: this.clearedFiles,
            totalDebtCleared: this.totalDebtCleared,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

// module.exports = DebtClearedEvent; // Commented for consolidation


})(); // End IIFE for domain/events/debtClearedEvent.js


// ============================================================================
// FILE 10/49: domain/events/keepAllEvent.js
// ============================================================================

(function() { // IIFE scope for domain/events/keepAllEvent.js
/**
 * KeepAllEvent - Domain event for "keep all" detection
 * 
 * Published when the system detects that a user accepted all AI suggestions without review.
 */

class KeepAllEvent {
    constructor({ suggestionIds, filePath, acceptanceCount, occurredAt = new Date() }) {
        this.suggestionIds = suggestionIds || [];
        this.filePath = filePath;
        this.acceptanceCount = acceptanceCount;
        this.occurredAt = occurredAt;
        this.eventType = 'KeepAllEvent';
    }

    toJSON() {
        return {
            eventType: this.eventType,
            suggestionIds: this.suggestionIds,
            filePath: this.filePath,
            acceptanceCount: this.acceptanceCount,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

// module.exports = KeepAllEvent; // Commented for consolidation


})(); // End IIFE for domain/events/keepAllEvent.js


// ============================================================================
// FILE 11/49: domain/events/reviewSessionCompletedEvent.js
// ============================================================================

(function() { // IIFE scope for domain/events/reviewSessionCompletedEvent.js
/**
 * ReviewSessionCompletedEvent - Domain event for review session completion
 * 
 * Published when a user completes reviewing a file (sufficient engagement or timeout).
 */

class ReviewSessionCompletedEvent {
    constructor({ filePath, sessionStart, completedAt, reviewTime, engagementScore, occurredAt = new Date() }) {
        this.filePath = filePath;
        this.sessionStart = sessionStart;
        this.completedAt = completedAt;
        this.reviewTime = reviewTime;
        this.engagementScore = engagementScore;
        this.occurredAt = occurredAt;
        this.eventType = 'ReviewSessionCompletedEvent';
    }
    
    toJSON() {
        return {
            eventType: this.eventType,
            filePath: this.filePath,
            sessionStart: this.sessionStart,
            completedAt: this.completedAt,
            reviewTime: this.reviewTime,
            engagementScore: this.engagementScore,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

// module.exports = ReviewSessionCompletedEvent; // Commented for consolidation

})(); // End IIFE for domain/events/reviewSessionCompletedEvent.js


// ============================================================================
// FILE 12/49: domain/events/reviewSessionStartedEvent.js
// ============================================================================

(function() { // IIFE scope for domain/events/reviewSessionStartedEvent.js
/**
 * ReviewSessionStartedEvent - Domain event for review session start
 * 
 * Published when a user starts reviewing a file with AI-generated changes.
 */

class ReviewSessionStartedEvent {
    constructor({ filePath, sessionStart, occurredAt = new Date() }) {
        this.filePath = filePath;
        this.sessionStart = sessionStart;
        this.occurredAt = occurredAt;
        this.eventType = 'ReviewSessionStartedEvent';
    }
    
    toJSON() {
        return {
            eventType: this.eventType,
            filePath: this.filePath,
            sessionStart: this.sessionStart,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

// module.exports = ReviewSessionStartedEvent; // Commented for consolidation

})(); // End IIFE for domain/events/reviewSessionStartedEvent.js


// ============================================================================
// FILE 13/49: domain/events/scoreUpdateEvent.js
// ============================================================================

(function() { // IIFE scope for domain/events/scoreUpdateEvent.js
/**
 * ScoreUpdateEvent - Domain event for awareness score updates
 * 
 * Published when the awareness score changes (new suggestions, debt changes, etc.).
 */

class ScoreUpdateEvent {
    constructor({ score, components, suggestions, debt, occurredAt = new Date() }) {
        this.score = score;
        this.components = components || {};
        this.suggestions = suggestions || { total: 0, pending: 0, pendingFiles: [] };
        this.debt = debt || { unreviewedFiles: 0, files: [] };
        this.occurredAt = occurredAt;
        this.eventType = 'ScoreUpdateEvent';
    }

    toJSON() {
        return {
            eventType: this.eventType,
            score: this.score,
            components: this.components,
            suggestions: this.suggestions,
            debt: this.debt,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

// module.exports = ScoreUpdateEvent; // Commented for consolidation


})(); // End IIFE for domain/events/scoreUpdateEvent.js


// ============================================================================
// FILE 14/49: domain/events/suggestionBatchCreatedEvent.js
// ============================================================================

(function() { // IIFE scope for domain/events/suggestionBatchCreatedEvent.js
/**
 * SuggestionBatchCreatedEvent - Domain event for suggestion batch creation
 * 
 * Published when a batch of related AI suggestions is created (e.g., from a single refactor).
 */

class SuggestionBatchCreatedEvent {
    constructor({ batchId, filePath, suggestionCount, totalSize, occurredAt = new Date() }) {
        this.batchId = batchId;
        this.filePath = filePath;
        this.suggestionCount = suggestionCount;
        this.totalSize = totalSize;
        this.occurredAt = occurredAt;
        this.eventType = 'SuggestionBatchCreatedEvent';
    }
    
    toJSON() {
        return {
            eventType: this.eventType,
            batchId: this.batchId,
            filePath: this.filePath,
            suggestionCount: this.suggestionCount,
            totalSize: this.totalSize,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

// module.exports = SuggestionBatchCreatedEvent; // Commented for consolidation

})(); // End IIFE for domain/events/suggestionBatchCreatedEvent.js


// ============================================================================
// FILE 15/49: domain/ports/IAwarenessMessagingPort.js
// ============================================================================

(function() { // IIFE scope for domain/ports/IAwarenessMessagingPort.js
/**
 * IAwarenessMessagingPort - Interface for publishing domain events used by the Awareness module
 * 
 * This port defines the contract for publishing awareness domain events.
 * Implementations can use event emitters, Pub/Sub, or other messaging systems.
 */

class IAwarenessMessagingPort {
    constructor() {
        if (new.target === IAwarenessMessagingPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Publish an AI suggestion event
     * @param {Object} event - AISuggestionEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishAISuggestionEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish an AI suggestion outcome event
     * @param {Object} event - AISuggestionOutcomeEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishAISuggestionOutcomeEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a score update event
     * @param {Object} event - ScoreUpdateEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishScoreUpdateEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a keep all event
     * @param {Object} event - KeepAllEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishKeepAllEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a debt cleared event
     * @param {Object} event - DebtClearedEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishDebtClearedEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a review session started event
     * @param {Object} event - ReviewSessionStartedEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishReviewSessionStartedEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a review session completed event
     * @param {Object} event - ReviewSessionCompletedEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishReviewSessionCompletedEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a suggestion batch created event
     * @param {Object} event - SuggestionBatchCreatedEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishSuggestionBatchCreatedEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }
}

// module.exports = IAwarenessMessagingPort; // Commented for consolidation


})(); // End IIFE for domain/ports/IAwarenessMessagingPort.js


// ============================================================================
// FILE 16/49: domain/ports/IAwarenessPersistencePort.js
// ============================================================================

(function() { // IIFE scope for domain/ports/IAwarenessPersistencePort.js
/**
 * IAwarenessPersistencePort - Interface for persistence operations used by the Awareness module
 * 
 * This port abstracts storage operations, enabling:
 * - Testability with in-memory implementations
 * - Flexibility to swap storage backends (workspaceState, file system, etc.)
 * - Clear separation between domain and infrastructure
 * 
 * Implementations should wrap the actual storage mechanism (e.g., VS Code workspaceState).
 */

/**
 * @interface IAwarenessPersistencePort
 */
class IAwarenessPersistencePort {
    /**
     * Save a value asynchronously
     * @param {string} key - Storage key
     * @param {*} value - Value to save (must be JSON-serializable)
     * @returns {Promise<void>}
     */
    async save(key, value) {
        throw new Error('save not implemented');
    }

    /**
     * Load a value asynchronously
     * @param {string} key - Storage key
     * @returns {Promise<*>} Stored value or undefined
     */
    async load(key) {
        throw new Error('load not implemented');
    }

    /**
     * Delete a value asynchronously
     * @param {string} key - Storage key
     * @returns {Promise<void>}
     */
    async delete(key) {
        throw new Error('delete not implemented');
    }

    /**
     * Save a value synchronously
     * @param {string} key - Storage key
     * @param {*} value - Value to save (must be JSON-serializable)
     * @returns {void}
     */
    saveSync(key, value) {
        throw new Error('saveSync not implemented');
    }

    /**
     * Load a value synchronously
     * @param {string} key - Storage key
     * @returns {*} Stored value or undefined
     */
    loadSync(key) {
        throw new Error('loadSync not implemented');
    }
}

// module.exports = IAwarenessPersistencePort; // Commented for consolidation




})(); // End IIFE for domain/ports/IAwarenessPersistencePort.js


// ============================================================================
// FILE 17/49: domain/ports/IAwarenessVSCodePort.js
// ============================================================================

(function() { // IIFE scope for domain/ports/IAwarenessVSCodePort.js
/**
 * IAwarenessVSCodePort - Interface for VS Code API operations used by the Awareness module
 * 
 * This port abstracts ONLY the VS Code operations that the awareness module requires.
 * It is module-specific and does not include general-purpose VS Code methods.
 * 
 * This enables:
 * - Testability without VS Code extension host
 * - Flexibility to swap implementations
 * - Clear separation between domain and infrastructure
 * - Module-specific contracts (not general-purpose adapters)
 * 
 * Implementations should wrap the actual VS Code API.
 */

/**
 * @interface IAwarenessVSCodePort
 */
class IAwarenessVSCodePort {
    // ============================================================================
    // Document Event Handlers (used by EventHandlers entity)
    // ============================================================================
    
    /**
     * Register a handler for text document changes
     * @param {Function} handler - Handler function receiving TextDocumentChangeEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeTextDocument(handler) {
        throw new Error('onDidChangeTextDocument not implemented');
    }

    /**
     * Register a handler for file creation events
     * @param {Function} handler - Handler function receiving FileCreateEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidCreateFiles(handler) {
        throw new Error('onDidCreateFiles not implemented');
    }

    /**
     * Register a handler for file save events
     * @param {Function} handler - Handler function receiving TextDocument
     * @returns {Object} Disposable to unsubscribe
     */
    onDidSaveTextDocument(handler) {
        throw new Error('onDidSaveTextDocument not implemented');
    }

    /**
     * Register a handler for file open events
     * @param {Function} handler - Handler function receiving TextDocument
     * @returns {Object} Disposable to unsubscribe
     */
    onDidOpenTextDocument(handler) {
        throw new Error('onDidOpenTextDocument not implemented');
    }

    /**
     * Register a handler for file close events
     * @param {Function} handler - Handler function receiving TextDocument
     * @returns {Object} Disposable to unsubscribe
     */
    onDidCloseTextDocument(handler) {
        throw new Error('onDidCloseTextDocument not implemented');
    }

    // ============================================================================
    // Editor Event Handlers (used by EventHandlers entity)
    // ============================================================================
    
    /**
     * Register a handler for text editor selection changes
     * @param {Function} handler - Handler function receiving TextEditorSelectionChangeEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeTextEditorSelection(handler) {
        throw new Error('onDidChangeTextEditorSelection not implemented');
    }

    /**
     * Register a handler for text editor visible range changes
     * @param {Function} handler - Handler function receiving TextEditorVisibleRangesChangeEvent
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeTextEditorVisibleRanges(handler) {
        throw new Error('onDidChangeTextEditorVisibleRanges not implemented');
    }

    /**
     * Register a handler for active text editor changes
     * @param {Function} handler - Handler function receiving TextEditor | undefined
     * @returns {Object} Disposable to unsubscribe
     */
    onDidChangeActiveTextEditor(handler) {
        throw new Error('onDidChangeActiveTextEditor not implemented');
    }

    // ============================================================================
    // Workspace Operations (used by FileWatcher, ScoreCalculator, EventHandlers)
    // ============================================================================
    
    /**
     * Convert a URI to a relative path string
     * @param {Object} uri - VS Code URI object
     * @returns {string} Relative path string
     */
    asRelativePath(uri) {
        throw new Error('asRelativePath not implemented');
    }

    /**
     * Get workspace folders
     * @returns {Array|undefined} Array of workspace folders or undefined
     */
    get workspaceFolders() {
        throw new Error('workspaceFolders getter not implemented');
    }

    /**
     * Get all open text documents
     * @returns {Array} Array of TextDocument instances
     */
    get textDocuments() {
        throw new Error('textDocuments getter not implemented');
    }

    /**
     * Open a text document
     * @param {Object} uri - VS Code URI object
     * @returns {Promise<Object>} TextDocument instance
     */
    openTextDocument(uri) {
        throw new Error('openTextDocument not implemented');
    }

    // ============================================================================
    // VS Code Types (used for constructing Range, Position, Uri objects)
    // ============================================================================
    
    /**
     * Get VS Code Range constructor
     * @returns {Function} Range constructor
     */
    get Range() {
        throw new Error('Range getter not implemented');
    }

    /**
     * Get VS Code Position constructor
     * @returns {Function} Position constructor
     */
    get Position() {
        throw new Error('Position getter not implemented');
    }

    /**
     * Get VS Code Uri constructor
     * @returns {Function} Uri constructor
     */
    get Uri() {
        throw new Error('Uri getter not implemented');
    }
}

// module.exports = IAwarenessVSCodePort; // Commented for consolidation

})(); // End IIFE for domain/ports/IAwarenessVSCodePort.js


// ============================================================================
// FILE 18/49: domain/ports/IFileSystemPort.js
// ============================================================================

(function() { // IIFE scope for domain/ports/IFileSystemPort.js
/**
 * IFileSystemPort - Port interface for filesystem operations
 * 
 * Defines the contract for filesystem access.
 * Domain entities should use this port instead of directly importing fs module.
 */

class IFileSystemPort {
    constructor() {
        if (new.target === IFileSystemPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Watch a directory for changes
     * @param {string} path - Path to watch
     * @param {Object} options - Watch options (recursive, etc.)
     * @param {Function} callback - Callback function (eventType, filename)
     * @returns {Object} Watcher object with close() method
     */
    watch(path, options, callback) {
        throw new Error('Method not implemented.');
    }

    /**
     * Get file stats asynchronously
     * @param {string} path - File path
     * @param {Function} callback - Callback function (err, stats)
     */
    stat(path, callback) {
        throw new Error('Method not implemented.');
    }

    /**
     * Read directory contents synchronously
     * @param {string} path - Directory path
     * @param {Object} options - Options (withFileTypes, etc.)
     * @returns {Array} Array of directory entries
     */
    readdirSync(path, options) {
        throw new Error('Method not implemented.');
    }

    /**
     * Read file contents synchronously
     * @param {string} path - File path
     * @param {string} encoding - File encoding (default: 'utf8')
     * @returns {string|Buffer} File contents
     */
    readFileSync(path, encoding = 'utf8') {
        throw new Error('Method not implemented.');
    }
}

// module.exports = IFileSystemPort; // Commented for consolidation

})(); // End IIFE for domain/ports/IFileSystemPort.js


// ============================================================================
// FILE 19/49: domain/ports/IHashGeneratorPort.js
// ============================================================================

(function() { // IIFE scope for domain/ports/IHashGeneratorPort.js
/**
 * IHashGeneratorPort - Port interface for hashing operations
 * 
 * Defines the contract for generating hashes.
 * Domain entities should use this port instead of directly using crypto module.
 */

class IHashGeneratorPort {
    constructor() {
        if (new.target === IHashGeneratorPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Create a hash from data
     * @param {string} algorithm - Hash algorithm (e.g., 'md5', 'sha256')
     * @param {string|Buffer} data - Data to hash
     * @returns {string} Hash string (hex)
     */
    createHash(algorithm, data) {
        throw new Error('Method not implemented.');
    }
}

// module.exports = IHashGeneratorPort; // Commented for consolidation

})(); // End IIFE for domain/ports/IHashGeneratorPort.js


// ============================================================================
// FILE 20/49: domain/ports/IIdGeneratorPort.js
// ============================================================================

(function() { // IIFE scope for domain/ports/IIdGeneratorPort.js
/**
 * IIdGeneratorPort - Port interface for ID generation
 * 
 * Defines the contract for generating unique identifiers.
 * Domain entities should use this port instead of directly using crypto or Date.now().
 */

class IIdGeneratorPort {
    constructor() {
        if (new.target === IIdGeneratorPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Generate a UUID
     * @returns {string} UUID string
     */
    generateUUID() {
        throw new Error('Method not implemented.');
    }

    /**
     * Generate a unique ID (fallback if UUID not available)
     * @returns {string} Unique ID string
     */
    generateId() {
        throw new Error('Method not implemented.');
    }
}

// module.exports = IIdGeneratorPort; // Commented for consolidation

})(); // End IIFE for domain/ports/IIdGeneratorPort.js

