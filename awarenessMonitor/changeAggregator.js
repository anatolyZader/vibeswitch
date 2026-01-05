/**
 * Change Aggregator
 * Manages pending changes aggregation: tracking, capping, and event metadata
 */

/**
 * Create a new pending changes entry
 * @returns {Object} Pending changes entry
 */
function createPendingEntry() {
    return {
        changes: [],
        eventTimestamps: [], // Track one timestamp per event (for rapid change detection)
        eventRangeSets: [], // Track range set per event (for scattered pattern detection)
        eventChangeCounts: [], // Track number of changes per event (for cleanup)
        timer: null,
        lastChangeTime: 0,
        firstChangeTime: 0, // Track first change time for temporal analysis
        documentVersion: null, // Track document version to detect drift (last seen version)
        onClassified: null,
        document: null, // Store document reference for flush
        flushSource: null // Source of flush (for meta tracking)
    };
}

/**
 * Calculate event range set from content changes
 * Uses line-based keys for more stable scatteredness detection
 * @param {Array<vscode.TextDocumentContentChangeEvent>} contentChanges - Content changes from event
 * @returns {Set<string>} Set of line-based range keys
 */
function calculateEventRangeSet(contentChanges) {
    const eventRangeSet = new Set();
    for (const change of contentChanges) {
        // Use line-based key to reduce noise from character-level variations
        const lineKey = `${change.range.start.line}-${change.range.end.line}`;
        eventRangeSet.add(lineKey);
    }
    return eventRangeSet;
}

/**
 * Add changes to pending entry with capping
 * @param {Object} pending - Pending changes entry
 * @param {Array<vscode.TextDocumentContentChangeEvent>} contentChanges - Changes to add
 * @param {number} maxChangesPerDocumentBatch - Maximum changes per document batch
 * @param {number} timestamp - Current timestamp
 */
function addChangesWithCapping(pending, contentChanges, maxChangesPerDocumentBatch, timestamp) {
    // Track first change time if this is the first batch
    if (pending.changes.length === 0) {
        pending.firstChangeTime = timestamp;
    }
    
    // Add all changes from event as one batch
    for (const change of contentChanges) {
        // Cap pending changes per document (safety)
        if (pending.changes.length >= maxChangesPerDocumentBatch) {
            // Drop oldest change
            pending.changes.shift();
            // Check if we've removed all changes from the first event
            if (pending.eventChangeCounts.length > 0) {
                pending.eventChangeCounts[0]--;
                if (pending.eventChangeCounts[0] <= 0) {
                    // Remove the first event's metadata
                    pending.eventChangeCounts.shift();
                    pending.eventTimestamps.shift();
                    pending.eventRangeSets.shift();
                    // Update first change time if we removed the first event
                    if (pending.eventTimestamps.length > 0) {
                        pending.firstChangeTime = pending.eventTimestamps[0];
                    }
                }
            }
        }
        pending.changes.push(change);
    }
}

/**
 * Record event metadata
 * @param {Object} pending - Pending changes entry
 * @param {number} timestamp - Event timestamp
 * @param {Set<string>} eventRangeSet - Range set for this event
 * @param {number} changeCount - Number of changes in this event
 */
function recordEventMetadata(pending, timestamp, eventRangeSet, changeCount) {
    // Track one timestamp per event (not per change)
    pending.eventTimestamps.push(timestamp);
    pending.eventRangeSets.push(eventRangeSet);
    pending.eventChangeCounts.push(changeCount);
    pending.lastChangeTime = timestamp;
}

module.exports = {
    createPendingEntry,
    calculateEventRangeSet,
    addChangesWithCapping,
    recordEventMetadata
};

