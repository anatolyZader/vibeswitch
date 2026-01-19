/**
 * Edits Batch Analyzer
 * Manages pending edits aggregation: tracking, capping, and event metadata
 * 
 * Uses event-based batching for O(k) performance instead of O(n²) per-change shifts.
 * Stores events as {timestamp, rangeSet, changes[]} for efficient whole-event drops.
 */

const { calculateRangeSet } = require('./utils/changeRangeUtils');

function createPendingEntry() {
    const pending = {
        // Store events as batches: {ts, rangeSet, changes[]}
        // This allows O(1) event-level drops instead of O(n) per-change shifts
        events: [], // Array of {timestamp, rangeSet, changes: []}
        timer: null,
        lastChangeTime: 0,
        firstChangeTime: 0, // Track first change time for temporal analysis
        onClassified: null,
        document: null, // Store document reference for flush
        flushSource: null // Source of flush (for meta tracking)
    };
    
    // Add computed properties for backward compatibility during migration
    Object.defineProperty(pending, 'changes', {
        get: function() {
            return this.events.flatMap(event => event.changes);
        },
        enumerable: true,
        configurable: true
    });
    
    Object.defineProperty(pending, 'eventTimestamps', {
        get: function() {
            return this.events.map(event => event.timestamp);
        },
        enumerable: true,
        configurable: true
    });
    
    Object.defineProperty(pending, 'eventRangeSets', {
        get: function() {
            return this.events.map(event => event.rangeSet);
        },
        enumerable: true,
        configurable: true
    });
    
    Object.defineProperty(pending, 'eventChangeCounts', {
        get: function() {
            return this.events.map(event => event.changes.length);
        },
        enumerable: true,
        configurable: true
    });
    
    return pending;
}

function calculateEventRangeSet(contentChanges) {
    // Use shared utility for range set calculation
    return calculateRangeSet(contentChanges);
}

/**
 * @deprecated Use addEventWithCapping instead for better performance (O(1) event drops vs O(n²) per-change shifts)
 * This function is kept for backward compatibility but calculates rangeSet and delegates to addEventWithCapping
 */
function addChangesWithCapping(pending, contentChanges, maxChangesPerDocumentBatch, timestamp) {
    // Calculate rangeSet and delegate to the new function
    const eventRangeSet = calculateEventRangeSet(contentChanges);
    addEventWithCapping(pending, contentChanges, eventRangeSet, timestamp, maxChangesPerDocumentBatch);
}

function recordEventMetadata(pending, timestamp, eventRangeSet, changeCount) {
    // This function is now obsolete - metadata is stored with events
    // Kept for backward compatibility during migration
    pending.lastChangeTime = timestamp;
}

/**
 * Add a new event with its changes and metadata as a single batch
 * This replaces the old pattern of addChangesWithCapping + recordEventMetadata
 * @param {Object} pending - Pending entry
 * @param {Array} contentChanges - Changes from the event
 * @param {Set} eventRangeSet - Range set for the event
 * @param {number} timestamp - Event timestamp
 * @param {number} maxChangesPerDocumentBatch - Maximum changes to keep
 */
function addEventWithCapping(pending, contentChanges, eventRangeSet, timestamp, maxChangesPerDocumentBatch) {
    // Track first change time if this is the first batch
    if (pending.events.length === 0) {
        pending.firstChangeTime = timestamp;
    }
    
    // Calculate total change count across all events
    let totalChanges = pending.events.reduce((sum, event) => sum + event.changes.length, 0);
    
    // Cap by dropping whole oldest events first (O(1) per event, not O(n) per change)
    while (totalChanges + contentChanges.length > maxChangesPerDocumentBatch && pending.events.length > 0) {
        const oldestEvent = pending.events[0];
        const oldestEventSize = oldestEvent.changes.length;
        
        if (totalChanges - oldestEventSize + contentChanges.length <= maxChangesPerDocumentBatch) {
            // Can't drop whole event, need to partial-drop within oldest event
            const excess = totalChanges + contentChanges.length - maxChangesPerDocumentBatch;
            // Remove excess changes from the front of oldest event's changes array
            oldestEvent.changes.splice(0, excess);
            totalChanges -= excess;
            // Update firstChangeTime if we removed all changes from first event
            if (oldestEvent.changes.length === 0) {
                pending.events.shift();
                if (pending.events.length > 0) {
                    pending.firstChangeTime = pending.events[0].timestamp;
                }
            }
            break;
        } else {
            // Drop whole oldest event (O(1) operation)
            pending.events.shift();
            totalChanges -= oldestEventSize;
            // Update firstChangeTime if we removed the first event
            if (pending.events.length > 0) {
                pending.firstChangeTime = pending.events[0].timestamp;
            }
        }
    }
    
    // Add new event as a batch (metadata naturally aligned with changes)
    pending.events.push({
        timestamp,
        rangeSet: eventRangeSet,
        changes: contentChanges
    });
    pending.lastChangeTime = timestamp;
}

module.exports = {
    createPendingEntry,
    calculateEventRangeSet,
    addChangesWithCapping, // Deprecated: use addEventWithCapping instead
    addEventWithCapping, // New: O(1) event-level capping
    recordEventMetadata // Deprecated: metadata now stored with events
};

