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

module.exports = Change;
