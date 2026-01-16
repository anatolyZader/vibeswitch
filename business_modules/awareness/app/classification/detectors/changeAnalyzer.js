/**
 * Change Analyzer
 * Analyzes text changes and calculates metrics for detector analysis
 * 
 * Moved from domain/utils/detectors to app/classification/detectors - this is a pure function utility.
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
    // Fix: Optimized from O(n²) to O(n) using sliding window two-pointer technique
    const timeWindow = config.rapidScatteredTimeWindow || 1000;
    let rapidEventCount = 0;
    let rapidRangeSet = new Set();
    let burstDurationMs = 0;
    
    if (eventTimestamps.length > 0 && firstChangeTime) {
        const lastEventTime = eventTimestamps[eventTimestamps.length - 1];
        burstDurationMs = lastEventTime - firstChangeTime;
        
        let maxRapidEventCount = 0;
        let maxRapidRanges = new Set();
        
        // Optimized sliding window: O(n) instead of O(n²)
        // Use two pointers: left (window start) and right (window end)
        let left = 0;
        let right = 0;
        const windowRanges = new Set();
        
        while (right < eventTimestamps.length) {
            // Expand window: move right pointer until window exceeds timeWindow
            while (right < eventTimestamps.length && 
                   eventTimestamps[right] - eventTimestamps[left] <= timeWindow) {
                // Add ranges from this event
                if (right < eventRangeSets.length) {
                    for (const rangeKey of eventRangeSets[right]) {
                        windowRanges.add(rangeKey);
                    }
                }
                right++;
            }
            
            // Current window: [left, right) has all events within timeWindow
            const windowEventCount = right - left;
            if (windowEventCount > maxRapidEventCount) {
                maxRapidEventCount = windowEventCount;
                // Create a copy of current window ranges
                maxRapidRanges = new Set(windowRanges);
            }
            
            // Shrink window: move left pointer and remove ranges from leftmost event
            if (left < eventRangeSets.length) {
                for (const rangeKey of eventRangeSets[left]) {
                    windowRanges.delete(rangeKey);
                }
            }
            left++;
            
            // If right didn't move, advance it to avoid infinite loop
            if (right === left) {
                right++;
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

/**
 * Calculate interaction metrics from episode data
 * These metrics capture workflow patterns (focus switches, saves, jumpiness)
 * 
 * @param {Episode} episode - Episode entity (optional)
 * @param {Array<Object>} contextSignals - Context signals array (optional, if episode not provided)
 * @param {Array<Object>} editSpans - Edit spans array (optional, if episode not provided)
 * @returns {Object} Interaction metrics
 */
function calculateInteractionMetrics(episode = null, contextSignals = null, editSpans = null) {
    // Use episode data if provided, otherwise use direct arrays
    const signals = episode ? episode.contextSignals : (contextSignals || []);
    const spans = episode ? episode.editSpans : (editSpans || []);
    const startTs = episode ? episode.startTs : (spans.length > 0 ? spans[0].timestamp : Date.now());
    const duration = episode ? episode.getDuration() : 
                     (spans.length > 0 ? spans[spans.length - 1].timestamp - startTs : 0);
    
    // Focus switches per minute
    const focusSwitches = signals.filter(s => s.type === 'focus' || s.type === 'navigation').length;
    const focusSwitchesPerMin = duration > 0 ? (focusSwitches / (duration / 60000)) : 0;
    
    // Save frequency
    const saveCount = signals.filter(s => s.type === 'save').length;
    const saveFrequency = duration > 0 ? (saveCount / (duration / 60000)) : 0;
    
    // Jumpiness: A→B→A pattern within short time window
    let jumpiness = 0;
    if (spans.length >= 3) {
        const fileSequence = spans.map(s => s.fileUri || s.file);
        for (let i = 0; i < fileSequence.length - 2; i++) {
            if (fileSequence[i] === fileSequence[i + 2] && 
                fileSequence[i] !== fileSequence[i + 1]) {
                const timeWindow = spans[i + 2].timestamp - spans[i].timestamp;
                if (timeWindow < 60000) { // Within 1 minute
                    jumpiness++;
                }
            }
        }
    }
    
    // Time to touch N files
    const fileTimestamps = new Map();
    for (const span of spans) {
        const uri = span.fileUri || span.file;
        if (uri && !fileTimestamps.has(uri)) {
            fileTimestamps.set(uri, span.timestamp);
        }
    }
    const sortedTimestamps = Array.from(fileTimestamps.values()).sort((a, b) => a - b);
    
    const timeToTouchNFiles = {};
    for (const n of [2, 3, 5]) {
        if (sortedTimestamps.length >= n) {
            timeToTouchNFiles[n] = sortedTimestamps[n - 1] - startTs;
        } else {
            timeToTouchNFiles[n] = null;
        }
    }
    
    // Verification strength (from context signals)
    const testSignals = signals.filter(s => s.type === 'test').length;
    const navigationSignals = signals.filter(s => s.type === 'navigation').length;
    const verificationStrength = Math.min(
        (testSignals * 0.5) + (navigationSignals * 0.3) + (saveCount * 0.2),
        1.0
    );
    
    return {
        focusSwitchesPerMin,
        saveFrequency,
        jumpiness,
        timeToTouchNFiles,
        verificationStrength,
        focusSwitchCount: focusSwitches,
        saveCount
    };
}

module.exports = {
    calculateMetrics,
    calculateInteractionMetrics
};
