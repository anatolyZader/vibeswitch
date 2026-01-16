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
        
        // Verification signals (for risk-based debt calculation)
        // These track evidence of user verification/validation after AI insertion
        this.verificationSignals = options.verificationSignals || {
            testFileModified: false,      // Did user modify test file after insertion?
            navigationAfterInsert: false, // Did user navigate to other files after insertion?
            saveAfterInsert: false,       // Did user save file after insertion?
            timeToVerify: null            // Time between insert and first verification signal (ms)
        };
        
        // Provenance score (for risk-based debt calculation)
        // This is the AI-likelihood score from classification (0-1)
        this.provenanceScore = options.provenanceScore || (options.classificationConfidence || 0.5);
        
        // Range count (for risk-based debt calculation - measures scatter)
        this.rangeCount = options.rangeCount || 1;
    }

    /**
     * Mark suggestion as reviewed
     * @deprecated Use SuggestionAggregate.markSuggestionReviewed() instead
     * This method is kept for backward compatibility but should not be called directly from app layer
     * @param {number} reviewTime - Time spent reviewing in milliseconds (will overwrite, not accumulate)
     * @param {number} reviewStarted - Timestamp when review started (optional, defaults to now)
     */
    markAsReviewed(reviewTime = 0, reviewStarted = null) {
        this.reviewed = true;
        this.reviewTime = reviewTime; // Note: overwrites, not accumulates
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
    
    /**
     * Update verification signals
     * @param {Object} signals - Verification signal updates
     * @param {boolean} signals.testFileModified - Test file was modified
     * @param {boolean} signals.navigationAfterInsert - User navigated after insert
     * @param {boolean} signals.saveAfterInsert - User saved after insert
     */
    updateVerificationSignals(signals) {
        if (!this.verificationSignals) {
            this.verificationSignals = {
                testFileModified: false,
                navigationAfterInsert: false,
                saveAfterInsert: false,
                timeToVerify: null
            };
        }
        
        if (signals.testFileModified !== undefined) {
            this.verificationSignals.testFileModified = signals.testFileModified;
        }
        if (signals.navigationAfterInsert !== undefined) {
            this.verificationSignals.navigationAfterInsert = signals.navigationAfterInsert;
        }
        if (signals.saveAfterInsert !== undefined) {
            this.verificationSignals.saveAfterInsert = signals.saveAfterInsert;
        }
        
        // Calculate time to verify if this is the first verification signal
        if (this.verificationSignals.timeToVerify === null) {
            const hasVerification = this.verificationSignals.testFileModified ||
                                   this.verificationSignals.navigationAfterInsert ||
                                   this.verificationSignals.saveAfterInsert;
            if (hasVerification) {
                this.verificationSignals.timeToVerify = Date.now() - this.timestamp;
            }
        }
    }
    
    /**
     * Check if suggestion has verification signals
     * @returns {boolean} True if any verification signal is present
     */
    hasVerification() {
        if (!this.verificationSignals) return false;
        return this.verificationSignals.testFileModified ||
               this.verificationSignals.navigationAfterInsert ||
               this.verificationSignals.saveAfterInsert;
    }
}

module.exports = Suggestion;
