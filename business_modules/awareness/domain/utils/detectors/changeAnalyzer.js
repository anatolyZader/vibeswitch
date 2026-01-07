/**
 * Change Analyzer
 * Analyzes text changes and calculates metrics for detector analysis
 */

/**
 * Calculate metrics from changes for detector analysis
 * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
 * @param {Array<number>} eventTimestamps - Timestamps for each event (for temporal analysis)
 * @param {Array<Set>} eventRangeSets - Range sets for each event (for scattered pattern detection)
 * @param {number} firstChangeTime - Timestamp of first change in batch
 * @param {Object} config - Configuration with rapidScatteredTimeWindow
 * @returns {Object} Metrics object
 */
function calculateMetrics(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null, config = {}) {
    let totalInserted = 0;
    let totalDeleted = 0;
    let hasMultiLine = false;
    let pureInsertionCount = 0;
    let distinctRanges = new Set();
    const startLines = [];
    const endLines = [];
    
    for (const change of changes) {
        const inserted = change.text.length;
        const deleted = change.rangeLength;
        
        totalInserted += inserted;
        totalDeleted += deleted;
        
        if (change.text.includes('\n')) {
            hasMultiLine = true;
        }
        
        if (deleted === 0 && inserted > 0) {
            pureInsertionCount++;
        }
        
        // Use line-based key for scatteredness detection (more stable than character-precise)
        const lineKey = `${change.range.start.line}-${change.range.end.line}`;
        distinctRanges.add(lineKey);
        
        startLines.push(change.range.start.line);
        endLines.push(change.range.end.line);
    }
    
    // Fix: maxLineSpan should consider both start and end lines
    const allLines = [...startLines, ...endLines];
    const maxLineSpan = allLines.length > 0 
        ? Math.max(...allLines) - Math.min(...allLines)
        : 0;
    
    // Fix: Count whitespace-only changes instead of whitespace ratio
    // This avoids false positives on normal code (which naturally contains whitespace)
    // Fix: Only count insertions of whitespace (deletions have empty text but aren't whitespace-only)
    let whitespaceOnlyChangeCount = 0;
    for (const change of changes) {
        if (change.text.length > 0 && change.text.trim().length === 0) {
            whitespaceOnlyChangeCount++;
        }
    }
    const whitespaceOnlyChangeRatio = changes.length > 0 
        ? whitespaceOnlyChangeCount / changes.length 
        : 0;
    
    // Calculate temporal metrics using event timestamps (not per-change timestamps)
    // Fix: Track events, not individual changes, for true "rapid scattered" detection
    const timeWindow = config.rapidScatteredTimeWindow || 1000;
    let rapidEventCount = 0;
    let rapidRangeSet = new Set();
    let burstDurationMs = 0;
    
    if (eventTimestamps.length > 0 && firstChangeTime) {
        const lastEventTime = eventTimestamps[eventTimestamps.length - 1];
        burstDurationMs = lastEventTime - firstChangeTime;
        
        let maxRapidEventCount = 0;
        let maxRapidRanges = new Set();
        
        // Find the window with the most events
        for (let i = 0; i < eventTimestamps.length; i++) {
            const windowStart = eventTimestamps[i];
            const windowEnd = windowStart + timeWindow;
            let windowEventCount = 0;
            const windowRanges = new Set();
            
            // Count events in this window and aggregate their ranges
            for (let j = i; j < eventTimestamps.length; j++) {
                if (eventTimestamps[j] <= windowEnd) {
                    windowEventCount++;
                    // Aggregate ranges from this event
                    if (j < eventRangeSets.length) {
                        for (const rangeKey of eventRangeSets[j]) {
                            windowRanges.add(rangeKey);
                        }
                    }
                } else {
                    break;
                }
            }
            
            if (windowEventCount > maxRapidEventCount) {
                maxRapidEventCount = windowEventCount;
                maxRapidRanges = windowRanges;
            }
        }
        
        rapidEventCount = maxRapidEventCount;
        rapidRangeSet = maxRapidRanges;
    }
    
    return {
        totalInserted,
        totalDeleted,
        hasMultiLine,
        pureInsertionCount,
        distinctRanges,
        distinctRangeCount: distinctRanges.size,
        maxLineSpan,
        whitespaceOnlyChangeRatio,
        rapidEventCount,
        rapidRangeSet,
        rapidRangeCount: rapidRangeSet.size,
        burstDurationMs,
        changeCount: changes.length
    };
}

module.exports = {
    calculateMetrics
};

