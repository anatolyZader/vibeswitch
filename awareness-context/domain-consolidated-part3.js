/**
 * DOMAIN LAYER - CONSOLIDATED (PART 3/4)
 * 
 * This file contains part 3 of 4 of the domain layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 20/54
 * Generated: 2026-01-12T18:19:21.013Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 33/54: domain/services/uriPathOperationServiceD.js
// ============================================================================

(function() { // IIFE scope for domain/services/uriPathOperationServiceD.js
/**
 * UriPathOperationServiceD - Domain service for URI and path validation
 * 
 * Encapsulates core domain business rules for URI/path validation.
 * Technical utilities (normalization, extraction) are in app layer.
 */

// const path = require('path'); // Commented for consolidation

// Constants for file filtering (domain business rules)
const NON_CODE_SCHEMES = ['output', 'vscode', 'vscode-notebook', 'debug', 'vscode-userdata', 'git'];
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj', '.sh', '.bash', '.zsh', '.fish'].map(ext => ext.toLowerCase());

class UriPathOperationServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Check if document is a code document (domain business rule)
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {TextDocument} document - Document to check
     * @returns {boolean} True if code document
     */
    isCodeDocument(vscodePort, document) {
        if (!document) return false;
        
        const scheme = document.uri?.scheme || '';
        
        // Scheme blacklist (always skip these)
        if (NON_CODE_SCHEMES.includes(scheme)) {
            return false;
        }
        
        // Filter by file extension (only process code files)
        const p = (document.uri?.path || document.fileName || '');
        const clean = p.split('?')[0].split('#')[0]; // Strip query and fragment
        const ext = path.extname(clean).toLowerCase();
        
        // If we have an extension and it's not in the code extensions list, skip it
        if (ext && !CODE_EXTENSIONS.includes(ext)) {
            return false;
        }
        
        // Handle untitled documents (user-controlled)
        // untitled can be code, so we don't skip it by default if no extension
        
        return true;
    }

    /**
     * Check if URI should be skipped (domain business rule)
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {Uri|string} uri - URI to check
     * @returns {boolean} True if should skip
     */
    isSkippableUri(vscodePort, uri) {
        if (!uri) return true;
        
        let scheme;
        if (typeof uri === 'string') {
            // Extract scheme from URI string
            const match = uri.match(/^([^:]+):/);
            scheme = match ? match[1] : '';
        } else {
            scheme = uri.scheme || '';
        }
        
        return NON_CODE_SCHEMES.includes(scheme);
    }
}

// module.exports = UriPathOperationServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/uriPathOperationServiceD.js


// ============================================================================
// FILE 34/54: domain/services/vscodeWorkspaceServiceD.js
// ============================================================================

(function() { // IIFE scope for domain/services/vscodeWorkspaceServiceD.js
/**
 * VSCodeWorkspaceServiceD - Domain service for VS Code workspace operations
 * 
 * Encapsulates workspace-related operations using VS Code port.
 * Service creates instances and passes adapters as ports to methods (following auth module pattern).
 */

class VSCodeWorkspaceServiceD {
    constructor() {
        // No constructor dependencies - ports passed as method parameters
    }

    /**
     * Get relative path from URI
     * @param {vscode.Uri} uri - URI to convert
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {string} Relative path
     */
    asRelativePath(uri, vscodePort) {
        return vscodePort.asRelativePath(uri);
    }

    /**
     * Get Range constructor
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Function} Range constructor
     */
    getRange(vscodePort) {
        return vscodePort.Range;
    }

    /**
     * Get text documents from workspace
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Array<vscode.TextDocument>} Array of text documents
     */
    getTextDocuments(vscodePort) {
        return vscodePort.textDocuments || [];
    }

    /**
     * Get workspace folders
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @returns {Array} Array of workspace folders
     */
    getWorkspaceFolders(vscodePort) {
        return vscodePort.workspaceFolders || [];
    }
}

// module.exports = VSCodeWorkspaceServiceD; // Commented for consolidation

})(); // End IIFE for domain/services/vscodeWorkspaceServiceD.js


// ============================================================================
// FILE 35/54: domain/utils/changeAggregator.js
// ============================================================================

(function() { // IIFE scope for domain/utils/changeAggregator.js
/**
 * Change Aggregator
 * Manages pending changes aggregation: tracking, capping, and event metadata
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

function calculateEventRangeSet(contentChanges) {
    const eventRangeSet = new Set();
    for (const change of contentChanges) {
        // Use line-based key to reduce noise from character-level variations
        const lineKey = `${change.range.start.line}-${change.range.end.line}`;
        eventRangeSet.add(lineKey);
    }
    return eventRangeSet;
}

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

function recordEventMetadata(pending, timestamp, eventRangeSet, changeCount) {
    // Track one timestamp per event (not per change)
    pending.eventTimestamps.push(timestamp);
    pending.eventRangeSets.push(eventRangeSet);
    pending.eventChangeCounts.push(changeCount);
    pending.lastChangeTime = timestamp;
}

// module.exports = { // Commented for consolidation
//     createPendingEntry, // Commented for consolidation
//     calculateEventRangeSet, // Commented for consolidation
//     addChangesWithCapping, // Commented for consolidation
//     recordEventMetadata // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/changeAggregator.js


// ============================================================================
// FILE 36/54: domain/utils/changeClassifier.js
// ============================================================================

(function() { // IIFE scope for domain/utils/changeClassifier.js
/**
 * Change Classifier
 * Debounced aggregation and AI/user classification for text changes
 * 
 * PRIMARY DETECTION: Behavioral inference via heuristics (edit patterns, batch characteristics, temporal patterns)
 * - Aggregates rapid changes within a time window
 * - Analyzes batch characteristics (total size, range count, distribution, scatteredness)
 * - Detects AI-like patterns: large multi-line insertions, pure insertions, scattered edits
 * - **Rapid scattered changes**: Measures many scattered edits within short time window (strong AI signal)
 *   - AI agents often make many scattered edits very quickly (within seconds)
 *   - Humans typically make more focused, sequential edits
 *   - This temporal pattern is a key behavioral differentiator
 * - Distinguishes formatters from AI edits (many scattered changes with deletes across wide span)
 * - This is the reliable method since markers cannot be guaranteed to survive edit pipeline
 * 
 * SECONDARY SIGNAL: @ai marker (strong signal when present)
 * - Checks for @ai marker in various comment formats (// @ai, # @ai, <!-- @ai -->, etc.)
 * - When marker is present, it's a definitive signal (100% accurate)
 * - When marker is absent, we cannot assume human origin - must use behavioral inference
 * 
 * Strategy: Behavioral heuristics are primary. Markers are helpful hints that strengthen
 * confidence when present, but absence of marker does NOT mean human origin.
 * 
 * DESIGN IMPROVEMENT: Composable detector pipeline
 * - Each detector returns {scoreDelta, reason, label}
 * - Final classification combines scores to determine label with confidence
 * - Returns {label: 'ai'|'user'|'formatter'|'unknown', confidence: 0..1, reasons: string[]}
 * 
 * FIXED: Stores callback once per document to prevent double recording
 */


// Import detectors
// const { hasAIMarker } = require('./detectors/markerDetector'); // Commented for consolidation
// const { calculateMetrics } = require('./detectors/changeAnalyzer'); // Commented for consolidation
// const { detectFormatter } = require('./detectors/formatterDetector'); // Commented for consolidation
// const { detectRapidScattered } = require('./detectors/rapidScatteredDetector'); // Commented for consolidation
// const { detectMultiLineInsertion } = require('./detectors/multiLineDetector'); // Commented for consolidation
// const { detectPureInsertions } = require('./detectors/pureInsertionDetector'); // Commented for consolidation
// const { detectLargeInsertion } = require('./detectors/largeInsertionDetector'); // Commented for consolidation
// const { detectScatteredEdits } = require('./detectors/scatteredEditsDetector'); // Commented for consolidation
// const { detectSmallEdits } = require('./detectors/smallEditsDetector'); // Commented for consolidation

// Import extracted modules
// const { createConfig } = require('./configManager'); // Commented for consolidation
// const { createPendingEntry, calculateEventRangeSet, addChangesWithCapping, recordEventMetadata } = require('./changeAggregator'); // Commented for consolidation
// const { accumulateScores, determineLabel } = require('./classificationScorer'); // Commented for consolidation
// const { applyDriftCap } = require('./versionDriftHandler'); // Commented for consolidation
// const { filterReasons } = require('./reasonFilter'); // Commented for consolidation

class ChangeClassifier {
    /**
     * @param {number} debounceMs - Debounce window in milliseconds
     * @param {Object} config - Classification configuration (mode-specific thresholds)
     */
    constructor(debounceMs = 200, config = null) {
        this.debounceMs = debounceMs;
        this.pendingChanges = new Map(); // document URI -> { changes: [], timer: null, lastChangeTime: 0, documentVersion: null, onClassified: null }
        this.maxChangesPerDocumentBatch = 200; // Cap changes per document batch (safety)
        
        // Production: Metrics for observability
        this.metrics = {
            versionDriftCount: 0, // Track how often drift happens
            totalClassifications: 0
        };
        
        // Create and merge configuration
        this.config = createConfig(config);
        
        // Fix: Use strict boolean check (more explicit than || false)
        this.markerOnly = this.config.markerOnly === true;
    }
    

    /**
     * Add a batch of changes from a TextDocumentChangeEvent
     * FIXED: Accepts whole event, stores callback once per document
     * @param {vscode.TextDocumentChangeEvent} event - Text document change event
     * @param {Function} onClassified - Callback with (document, classification, aggregatedChanges)
     *   - classification: {label: 'ai'|'user'|'formatter'|'unknown', confidence: 0..1, reasons: string[]}
     */
    addEvent(event, onClassified) {
        if (!event || !event.contentChanges || event.contentChanges.length === 0) {
            return;
        }
        
        const uri = event.document.uri.toString();
        const now = Date.now();
        
        if (!this.pendingChanges.has(uri)) {
            this.pendingChanges.set(uri, createPendingEntry());
        }
        
        const pending = this.pendingChanges.get(uri);
        
        // Store callback once per document (prevents double recording)
        // Use latest callback if provided, otherwise keep existing
        if (onClassified) {
            pending.onClassified = onClassified;
        }
        pending.document = event.document; // Update document reference
        pending.documentVersion = event.document.version;
        
        // Calculate event range set for scatteredness detection
        const eventRangeSet = calculateEventRangeSet(event.contentChanges);
        
        // Add changes with capping
        addChangesWithCapping(pending, event.contentChanges, this.maxChangesPerDocumentBatch, now);
        
        // Record event metadata
        recordEventMetadata(pending, now, eventRangeSet, event.contentChanges.length);
        
        // Fix: Removed lastBatchFingerprint - fingerprint comparison was ineffective
        // (compared same array to itself). Using version drift alone is the actual signal.
        
        // Clear existing timer
        if (pending.timer) {
            clearTimeout(pending.timer);
            pending.timer = null; // Clear timer ref
        }
        
        // Set new timer
        pending.timer = setTimeout(() => {
            this._classifyAndEmit(uri);
        }, this.debounceMs);
    }

    _classifyAndEmit(uri) {
        const pending = this.pendingChanges.get(uri);
        if (!pending || pending.changes.length === 0) {
            if (pending && pending.timer) {
                clearTimeout(pending.timer);
                pending.timer = null;
            }
            this.pendingChanges.delete(uri);
            return;
        }
        
        const changes = pending.changes;
        const eventTimestamps = pending.eventTimestamps || [];
        const eventRangeSets = pending.eventRangeSets || [];
        const document = pending.document;
        const onClassified = pending.onClassified;
        const documentVersion = pending.documentVersion;
        
        // Classify changes
        let classification = this._classify(changes, eventTimestamps, eventRangeSets, pending.firstChangeTime);
        
        // Fix: Ensure classification has meta object for source tracking
        if (!classification.meta) {
            classification.meta = {};
        }
        
        // Fix: Add source meta from flush context (if available)
        if (pending.flushSource) {
            classification.meta.source = pending.flushSource;
        }
        
        // Apply version drift cap if document changed externally
        const lastSeenVersion = documentVersion;
        const lastSeenTs = pending.lastChangeTime || pending.firstChangeTime;
        applyDriftCap(classification, document, lastSeenVersion, lastSeenTs, this.metrics);
        
        // Production: Track total classifications
        this.metrics.totalClassifications++;
        
        // Clear timer ref
        if (pending.timer) {
            clearTimeout(pending.timer);
            pending.timer = null;
        }
        
        // Clear pending
        this.pendingChanges.delete(uri);
        
        // Emit classification (single callback, prevents double recording)
        // ALWAYS use classification object format (single protocol)
        if (onClassified && document) {
            onClassified(document, classification, changes);
        }
    }

    _hasAIMarker(changes) {
        return hasAIMarker(changes);
    }

    _classify(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null) {
        if (changes.length === 0) {
            return { label: 'unknown', confidence: 0, reasons: ['no changes'] };
        }
        
        // STRONG SIGNAL: Check for @ai marker (definitive when present)
        // Fix: Use only reasons array (single contract), no reason field
        if (this._hasAIMarker(changes)) {
            return {
                label: 'ai',
                confidence: 1.0,
                reasons: ['@ai marker found in changes']
            };
        }
        
        // If marker-only mode is enabled, skip heuristics entirely
        // Fix: Return unknown (not user) when no marker found - "no marker" ≠ "user"
        if (this.markerOnly) {
            return {
                label: 'unknown',
                confidence: 0.2,
                reasons: ['marker-only mode: no marker found']
            };
        }
        
        // PRIMARY DETECTION: Behavioral inference via heuristics
        // This is the reliable method since markers cannot be guaranteed
        // Aggregate metrics for all detectors
        const metrics = calculateMetrics(changes, eventTimestamps, eventRangeSets, firstChangeTime, this.config);
        
        // Fix: Clean detector API - remove reasons parameter (detectors don't use it)
        // Run composable detectors in pipeline
        const detectors = [
            () => detectFormatter(metrics, this.config),
            () => detectRapidScattered(metrics, this.config),
            () => detectLargeInsertion(metrics, this.config),
            () => detectMultiLineInsertion(metrics, this.config),
            () => detectPureInsertions(metrics, this.config),
            () => detectScatteredEdits(metrics, this.config),
            () => detectSmallEdits(metrics)
        ];
        
        // Accumulate scores from detectors
        const { aiScore, formatterScore, userScore, reasonObjects } = accumulateScores(detectors);
        
        // Determine final label and confidence
        const { label, confidence } = determineLabel(aiScore, formatterScore, userScore);
        
        // Filter reasons by tag prefix
        const filteredReasons = filterReasons(reasonObjects, label);
        
        return { label, confidence, reasons: filteredReasons };
    }
    
    
    _classifyAsAI(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null) {
        const result = this._classify(changes, eventTimestamps, eventRangeSets, firstChangeTime);
        return result.label === 'ai';
    }
    
    /**
     * Public method for testing - classifies changes and returns rich result
     * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
     * @param {Array<number>} eventTimestamps - Timestamps for each event (optional)
     * @param {Array<Set>} eventRangeSets - Range sets for each event (optional)
     * @param {number} firstChangeTime - Timestamp of first change (optional)
     * @returns {{label: 'ai'|'user'|'formatter'|'unknown', confidence: number, reasons: string[]}} Classification result
     */
    classify(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null) {
        return this._classify(changes, eventTimestamps, eventRangeSets, firstChangeTime);
    }

    /**
     * Force classification of pending changes for a document (for cleanup/flush)
     * Fix: Support silent mode to prevent emission during cleanup
     * @param {vscode.TextDocument} document - The document
     * @param {Function|Object} onClassifiedOrOptions - Optional callback or options {emit: boolean}
     *   - If Function: callback to use (uses stored if not provided)
     *   - If Object: {emit: false} for silent flush (cleanup without recording)
     */
    flush(document, onClassifiedOrOptions) {
        if (!document) return;
        
        const uri = document.uri.toString();
        const pending = this.pendingChanges.get(uri);
        if (pending) {
            if (pending.timer) {
                clearTimeout(pending.timer);
                pending.timer = null;
            }
            
            // Fix: Support silent mode and source meta for cleanup without emission
            const options = typeof onClassifiedOrOptions === 'object' && onClassifiedOrOptions !== null ? onClassifiedOrOptions : null;
            const onClassified = typeof onClassifiedOrOptions === 'function' ? onClassifiedOrOptions : null;
            const shouldEmit = options ? (options.emit !== false) : true; // Default to true for backward compatibility
            
            // Fix: Store source meta if provided (for downstream filtering)
            if (options && options.source) {
                pending.flushSource = options.source;
            }
            
            if (onClassified) {
                pending.onClassified = onClassified;
            }
            
            pending.document = document; // Update document reference
            
            if (shouldEmit) {
                this._classifyAndEmit(uri);
            } else {
                // Silent flush: just clear without emitting
                this.pendingChanges.delete(uri);
            }
        }
    }

    /**
     * Flush all pending changes (for cleanup on extension stop)
     * FIXED: Actually calls callbacks before clearing
     * IMPORTANT: Callbacks should respect "formatter is neutral" rule - formatter classifications
     * should not trigger user edit recording or suggestion adaptation marking.
     * @param {Function} onClassified - Optional callback for all flushed documents
     *   - Callback signature: (document, classification, changes)
     *   - classification: {label: 'ai'|'user'|'formatter'|'unknown', confidence: 0..1, reasons: string[]}
     *   - Callbacks should handle formatter classifications as neutral (do nothing)
     */
    flushAll(onClassified) {
        const uris = Array.from(this.pendingChanges.keys());
        for (const uri of uris) {
            const pending = this.pendingChanges.get(uri);
            if (pending) {
                if (pending.timer) {
                    clearTimeout(pending.timer);
                    pending.timer = null;
                }
                // Use provided callback or stored callback
                if (onClassified) {
                    pending.onClassified = onClassified;
                }
                // Emit if we have document and callback
                if (pending.document && pending.onClassified) {
                    // Fix: Set source for flushAll (dispose context) if not already set
                    // Then reuse _classifyAndEmit() for consistency (single code path for drift cap, meta.source, etc.)
                    if (!pending.flushSource) {
                        pending.flushSource = 'dispose';
                    }
                    
                    // Fix: Reuse _classifyAndEmit() instead of duplicating logic
                    // This ensures consistency: meta.source, drift cap, fingerprint check all use same code path
                    // Less divergence = fewer future regressions
                    this._classifyAndEmit(uri);
                }
            }
        }
        this.pendingChanges.clear();
    }

    /**
     * Clear all pending changes (for cleanup)
     */
    clear() {
        for (const pending of this.pendingChanges.values()) {
            if (pending.timer) {
                clearTimeout(pending.timer);
                pending.timer = null;
            }
        }
        this.pendingChanges.clear();
    }

    /**
     * Calculate statistics about pending changes
     * @returns {Object} Statistics object with counts and metrics
     */
    getStatistics() {
        const stats = {
            totalDocuments: this.pendingChanges.size,
            totalPendingChanges: 0,
            documentsWithTimers: 0,
            averageChangesPerDocument: 0
        };

        for (const pending of this.pendingChanges.values()) {
            stats.totalPendingChanges += pending.changes.length;
            if (pending.timer) {
                stats.documentsWithTimers++;
            }
        }

        if (stats.totalDocuments > 0) {
            stats.averageChangesPerDocument = Math.round(
                stats.totalPendingChanges / stats.totalDocuments
            );
        }

        return stats;
    }

}

// module.exports = ChangeClassifier; // Commented for consolidation

})(); // End IIFE for domain/utils/changeClassifier.js


// ============================================================================
// FILE 37/54: domain/utils/classificationScorer.js
// ============================================================================

(function() { // IIFE scope for domain/utils/classificationScorer.js
/**
 * Classification Scorer
 * Accumulates detector scores and determines final classification label and confidence
 */

function accumulateScores(detectors) {
    let aiScore = 0;
    let formatterScore = 0;
    let userScore = 0;
    
    // Fix: Store reasons as paired objects to prevent misalignment
    // Some detectors may return reason without reasonTag (e.g., marker detection)
    const reasonObjects = [];
    
    for (const detector of detectors) {
        const result = detector();
        if (!result) continue;
        
        if (result.label === 'formatter') {
            formatterScore += result.score;
        } else if (result.label === 'ai') {
            aiScore += result.score;
        } else if (result.label === 'user') {
            userScore += result.score;
        }
        
        if (result.reason) {
            reasonObjects.push({ tag: result.reasonTag || null, text: result.reason });
        }
    }
    
    return { aiScore, formatterScore, userScore, reasonObjects };
}

function determineLabel(aiScore, formatterScore, userScore) {
    let label = 'unknown';
    let confidence = 0;
    
    if (formatterScore > aiScore && formatterScore > userScore && formatterScore > 0.5) {
        label = 'formatter';
        confidence = Math.min(formatterScore, 1.0);
    } else if (aiScore > userScore && aiScore > 0.3) {
        label = 'ai';
        confidence = Math.min(aiScore, 1.0);
    } else if (userScore > 0) {
        // Fix: Only label 'user' when we have positive user evidence
        label = 'user';
        confidence = Math.max(0.3, Math.min(userScore, 1.0));
    } else {
        // Fix: If all scores are 0, return 'unknown' (not 'user')
        // This matches the documented behavior where 'unknown' exists
        label = 'unknown';
        confidence = 0.2;
    }
    
    return { label, confidence };
}

// module.exports = { // Commented for consolidation
//     accumulateScores, // Commented for consolidation
//     determineLabel // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/classificationScorer.js


// ============================================================================
// FILE 38/54: domain/utils/configManager.js
// ============================================================================

(function() { // IIFE scope for domain/utils/configManager.js
/**
 * Config Manager
 * Manages classifier configuration: defaults, validation, and merging
 */

// const { getLogger } = require('../../../../logger'); // Commented for consolidation

/**
 * Get default classifier configuration
 * @returns {Object} Default configuration object
 */
function getDefaultConfig() {
    return {
        // VIBE: more permissive (lower thresholds)
        // DEV: more conservative (higher thresholds)
        multiLineThreshold: 50,
        pureInsertionCount: 3,
        pureInsertionSize: 20,
        largeInsertionThreshold: 100,
        scatteredRangeCount: 5,
        scatteredChangeCount: 5,
        scatteredSizeThreshold: 200,
        formatterRangeCount: 8,
        formatterLineSpan: 50,
        aiLineSpan: 30,
        aiMultiLineSize: 50,
        // Rapid scattered changes: AI agents often make many scattered edits quickly
        rapidScatteredTimeWindow: 1000, // Time window in ms for rapid changes (1 second)
        rapidScatteredEventCount: 8, // Minimum number of events in time window (renamed from ChangeCount for clarity)
        rapidScatteredRangeCount: 6, // Minimum distinct line ranges for scattered pattern
        rapidScatteredMinSize: 50, // Minimum total size to avoid false positives on tiny edits
        rapidBurstChangeCount: 10, // Minimum number of changes for rapid burst branch (separate from event count)
        // Marker-only mode: if true, only use @ai marker, ignore heuristics
        // If false, use behavioral heuristics as primary with markers as strong signal when present
        markerOnly: false  // Default: use behavioral inference (heuristics) as primary method
    };
}

/**
 * Validate and sanitize classifier configuration to prevent silent misclassification
 * Fix: Sanitizes user config BEFORE merge to ensure defaults always win
 * @param {Object} config - User configuration to validate (will be mutated)
 * @param {Object} defaultConfig - Default configuration (for reference)
 * @returns {{errors: string[], sanitized: string[]}} Validation result
 */
function validateConfig(config, defaultConfig = {}) {
    const errors = [];
    const sanitized = [];
    
    // Thresholds must be positive numbers
    const thresholdKeys = [
        'multiLineThreshold', 'pureInsertionCount', 'pureInsertionSize',
        'largeInsertionThreshold', 'scatteredRangeCount', 'scatteredChangeCount',
        'scatteredSizeThreshold', 'formatterRangeCount', 'formatterLineSpan',
        'aiLineSpan', 'aiMultiLineSize', 'rapidScatteredTimeWindow',
        'rapidScatteredEventCount', 'rapidScatteredRangeCount', 'rapidScatteredMinSize',
        'rapidBurstChangeCount'
    ];
    
    // Fix: Sanitize invalid values (delete them so defaults win) instead of just warning
    for (const key of thresholdKeys) {
        if (config[key] !== undefined && (typeof config[key] !== 'number' || config[key] < 0)) {
            errors.push(`${key} must be a non-negative number, got: ${config[key]}`);
            delete config[key]; // Remove invalid value so default wins
            sanitized.push(key);
        }
    }
    
    // Boolean flags
    if (config.markerOnly !== undefined && typeof config.markerOnly !== 'boolean') {
        errors.push(`markerOnly must be a boolean, got: ${config.markerOnly}`);
        delete config.markerOnly; // Remove invalid value so default wins
        sanitized.push('markerOnly');
    }
    
    if (errors.length > 0) {
        // Production: Use logger instead of console.warn (rate-limited, visible to devs)
        const logger = getLogger();
        // Log once with sanitized keys and caller context
        logger.log(`[ChangeClassifier] Invalid config sanitized: ${sanitized.join(', ')}. ${errors.length} invalid value(s) removed, defaults applied.`, true);
        // Invalid values have been deleted, so defaults will be used via merge
    }
    
    return { errors, sanitized };
}

/**
 * Create and merge classifier configuration
 * @param {Object|null} userConfig - User-provided configuration (optional)
 * @returns {Object} Final frozen configuration object
 */
function createConfig(userConfig = null) {
    const defaultConfig = getDefaultConfig();
    
    // Fix: Sanitize user config BEFORE merging to ensure defaults always win
    // This prevents invalid values from overwriting defaults, then being deleted, leaving undefined
    const sanitizedUserConfig = userConfig ? { ...userConfig } : {};
    validateConfig(sanitizedUserConfig, defaultConfig);
    
    // Merge sanitized user config with defaults (defaults win for any missing/invalid keys)
    const config = { ...defaultConfig, ...sanitizedUserConfig };
    
    // Freeze config to prevent accidental mutation
    Object.freeze(config);
    
    return config;
}

// module.exports = { // Commented for consolidation
//     getDefaultConfig, // Commented for consolidation
//     validateConfig, // Commented for consolidation
//     createConfig // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/configManager.js


// ============================================================================
// FILE 39/54: domain/utils/detectors/changeAnalyzer.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/changeAnalyzer.js
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

// module.exports = { // Commented for consolidation
//     calculateMetrics // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/changeAnalyzer.js


// ============================================================================
// FILE 40/54: domain/utils/detectors/formatterDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/formatterDetector.js
/**
 * Formatter Detector
 * Detects formatter patterns (many scattered changes with high whitespace ratio)
 */

/**
 * Detector: Formatter pattern (many scattered changes with high whitespace ratio)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with formatter thresholds
 * @returns {Object|null} Detection result or null
 */
function detectFormatter(metrics, config) {
    // Fix: Use whitespace-only change ratio instead of whitespace character ratio
    // This avoids false positives on normal code (which naturally contains whitespace)
    // Fix: Add guard for small inserted text per change (formatters typically have small inserts)
    // Fix: Also detect formatters with moderate whitespace ratio but strong other signals
    const avgInsertedPerChange = metrics.changeCount > 0 ? metrics.totalInserted / metrics.changeCount : 0;
    const formatterMaxAvgInsert = 30; // Formatters typically insert small amounts per change
    
    // Primary signal: high whitespace-only ratio
    const hasHighWhitespaceRatio = metrics.whitespaceOnlyChangeRatio > 0.6;
    
    // Secondary signal: formatter characteristics (many ranges, wide span, small inserts, both deletes and inserts)
    const hasFormatterCharacteristics = 
        metrics.distinctRangeCount >= config.formatterRangeCount && 
        metrics.maxLineSpan >= config.formatterLineSpan &&
        metrics.totalDeleted > 0 && // Formatters typically have deletes
        (metrics.totalInserted <= 500 || avgInsertedPerChange <= formatterMaxAvgInsert);
    
    // Detect formatter if: (high whitespace ratio) OR (formatter characteristics with moderate whitespace)
    if (hasFormatterCharacteristics) {
        const whitespaceThreshold = hasHighWhitespaceRatio ? 0.6 : 0.3; // Lower threshold if other signals are strong
        if (metrics.whitespaceOnlyChangeRatio > whitespaceThreshold) {
            return {
                label: 'formatter',
                score: hasHighWhitespaceRatio ? 0.9 : 0.7, // Lower confidence if whitespace ratio is moderate
                reason: `formatter pattern: ${metrics.distinctRangeCount} ranges, ${metrics.maxLineSpan} line span, ${(metrics.whitespaceOnlyChangeRatio * 100).toFixed(0)}% whitespace-only changes, avg ${avgInsertedPerChange.toFixed(0)} chars/change`,
                reasonTag: 'fmt:whitespace' // Fix: Add tag for stable filtering
            };
        }
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectFormatter // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/formatterDetector.js


// ============================================================================
// FILE 41/54: domain/utils/detectors/largeInsertionDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/largeInsertionDetector.js
/**
 * Large Insertion Detector
 * Detects large single insertions
 */

/**
 * Detector: Large single insertion
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with large insertion threshold
 * @returns {Object|null} Detection result or null
 */
function detectLargeInsertion(metrics, config) {
    if (metrics.totalInserted > config.largeInsertionThreshold && metrics.totalDeleted === 0) {
        return {
            label: 'ai',
            score: 0.6,
            reason: `large insertion: ${metrics.totalInserted} chars`,
            reasonTag: 'ai:large_insertion' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectLargeInsertion // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/largeInsertionDetector.js


// ============================================================================
// FILE 42/54: domain/utils/detectors/markerDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/markerDetector.js
/**
 * Marker Detector
 * Detects @ai markers in code changes (strong signal when present)
 */

/**
 * Check if changes contain @ai marker (primary signal for AI-generated code)
 * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
 * @returns {boolean} True if @ai marker is found
 */
function hasAIMarker(changes) {
    // Check for @ai marker in various comment formats
    // FIXED: CSS pattern was too strict, now uses flexible block comment matching
    // Fix: HTML marker regex should be case-insensitive and more flexible
    const markerPatterns = [
        /\/\/\s*@ai/i,                    // JavaScript/TypeScript/Java/C/C++/C#
        /#\s*@ai/i,                        // Python/Shell/Bash
        /<!--[\s\S]*?@ai[\s\S]*?-->/i,     // HTML/XML/Markdown - Fix: case-insensitive and flexible whitespace
        /--\s*@ai/i,                       // SQL
        /\/\*[\s\S]*?@ai[\s\S]*?\*\//i     // CSS - FIXED: flexible block comment matching
    ];
    
    for (const change of changes) {
        const text = change.text;
        for (const pattern of markerPatterns) {
            if (pattern.test(text)) {
                return true;
            }
        }
    }
    // NOTE: Markers may exist in untouched context (AI edits elsewhere)
    // Currently only checking inserted text - could be enhanced to check document context
    return false;
}

// module.exports = { // Commented for consolidation
//     hasAIMarker // Commented for consolidation
// }; // Commented for consolidation



})(); // End IIFE for domain/utils/detectors/markerDetector.js


// ============================================================================
// FILE 43/54: domain/utils/detectors/multiLineDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/multiLineDetector.js
/**
 * Multi-Line Insertion Detector
 * Detects large multi-line insertions in localized area
 */

/**
 * Detector: Large multi-line insertions in localized area
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with multi-line thresholds
 * @returns {Object|null} Detection result or null
 */
function detectMultiLineInsertion(metrics, config) {
    // Fix: Use multiLineThreshold to require minimum multi-line size
    if (metrics.hasMultiLine && 
        metrics.totalInserted >= config.multiLineThreshold &&
        metrics.totalInserted >= config.aiMultiLineSize &&
        metrics.maxLineSpan <= config.aiLineSpan) {
        return {
            label: 'ai',
            score: 0.7,
            reason: `large multi-line insertion: ${metrics.totalInserted} chars, ${metrics.maxLineSpan} line span`,
            reasonTag: 'ai:multi_line' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectMultiLineInsertion // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/multiLineDetector.js


// ============================================================================
// FILE 44/54: domain/utils/detectors/pureInsertionDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/pureInsertionDetector.js
/**
 * Pure Insertion Detector
 * Detects multiple pure insertions (no deletes)
 */

/**
 * Detector: Multiple pure insertions (no deletes)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with pure insertion thresholds
 * @returns {Object|null} Detection result or null
 */
function detectPureInsertions(metrics, config) {
    if (metrics.pureInsertionCount >= config.pureInsertionCount && 
        metrics.totalInserted > config.pureInsertionSize &&
        metrics.totalDeleted === 0) {
        return {
            label: 'ai',
            score: 0.6,
            reason: `pure insertions: ${metrics.pureInsertionCount} insertions, ${metrics.totalInserted} chars`,
            reasonTag: 'ai:pure_insertions' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectPureInsertions // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/pureInsertionDetector.js


// ============================================================================
// FILE 45/54: domain/utils/detectors/rapidScatteredDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/rapidScatteredDetector.js
/**
 * Rapid Scattered Detector
 * Detects rapid scattered changes (strong AI signal)
 */

/**
 * Detector: Rapid scattered changes (strong AI signal)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with rapid scattered thresholds
 * @returns {Object|null} Detection result or null
 */
function detectRapidScattered(metrics, config) {
    // Fix: Use event count instead of change count (events are what matter for "rapid")
    if (metrics.rapidEventCount >= config.rapidScatteredEventCount &&
        metrics.rapidRangeCount >= config.rapidScatteredRangeCount &&
        metrics.totalInserted >= config.rapidScatteredMinSize) {
        return {
            label: 'ai',
            score: 0.8,
            reason: `rapid scattered: ${metrics.rapidEventCount} events in ${config.rapidScatteredTimeWindow}ms window across ${metrics.rapidRangeCount} ranges`,
            reasonTag: 'ai:rapid_scattered' // Fix: Add tag for stable filtering
        };
    }
    
    // Fix: Require at least 2 events for rapid burst (avoid false positives from single large events)
    // Fix: Use separate rapidBurstChangeCount threshold (not rapidScatteredEventCount)
    // Fix: Require rapidRangeCount >= 2 to reduce false positives from tight loop editing one place
    if (metrics.rapidEventCount >= 2 && metrics.burstDurationMs > 0 && metrics.burstDurationMs <= 1200 &&
        metrics.rapidRangeCount >= 2 && // Guard: require scatteredness even in burst branch
        metrics.distinctRangeCount >= config.rapidScatteredRangeCount &&
        metrics.changeCount >= (config.rapidBurstChangeCount || 10) &&
        metrics.totalInserted >= config.rapidScatteredMinSize) {
        return {
            label: 'ai',
            score: 0.7,
            reason: `rapid burst: ${metrics.rapidEventCount} events, ${metrics.changeCount} changes in ${metrics.burstDurationMs}ms`,
            reasonTag: 'ai:rapid_burst' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectRapidScattered // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/rapidScatteredDetector.js


// ============================================================================
// FILE 46/54: domain/utils/detectors/scatteredEditsDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/scatteredEditsDetector.js
/**
 * Scattered Edits Detector
 * Detects scattered edits (could be formatter or AI)
 */

/**
 * Detector: Scattered edits (could be formatter or AI)
 * @param {Object} metrics - Calculated metrics
 * @param {Object} config - Configuration with scattered edit thresholds
 * @returns {Object|null} Detection result or null
 */
function detectScatteredEdits(metrics, config) {
    if (metrics.distinctRangeCount >= config.scatteredRangeCount && 
        metrics.changeCount >= config.scatteredChangeCount) {
        if (metrics.totalInserted > config.scatteredSizeThreshold) {
            return {
                label: 'ai',
                score: 0.5,
                reason: `scattered edits: ${metrics.distinctRangeCount} ranges, ${metrics.totalInserted} chars`,
                reasonTag: 'ai:scattered' // Fix: Add tag for stable filtering
            };
        }
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectScatteredEdits // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/scatteredEditsDetector.js


// ============================================================================
// FILE 47/54: domain/utils/detectors/smallEditsDetector.js
// ============================================================================

(function() { // IIFE scope for domain/utils/detectors/smallEditsDetector.js
/**
 * Small Edits Detector
 * Detects small edits (likely user formatting)
 */

/**
 * Detector: Small edits (likely user formatting)
 * @param {Object} metrics - Calculated metrics
 * @returns {Object|null} Detection result or null
 */
function detectSmallEdits(metrics) {
    if (metrics.hasMultiLine && metrics.totalInserted < 20) {
        return {
            label: 'user',
            score: 0.4,
            reason: `small multi-line edit: ${metrics.totalInserted} chars (likely formatting)`,
            reasonTag: 'user:small_edit' // Fix: Add tag for stable filtering
        };
    }
    return null;
}

// module.exports = { // Commented for consolidation
//     detectSmallEdits // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/detectors/smallEditsDetector.js


// ============================================================================
// FILE 48/54: domain/utils/diffBulletBuilder.js
// ============================================================================

(function() { // IIFE scope for domain/utils/diffBulletBuilder.js
/**
 * DIFF Bullet Builder
 * Generates DIFF bullet skeletons from aggregated changes
 * 
 * Format: - <path> :: <anchor> :: <action> (origin=<ai|human|tool|mixed>, impact=<functional|non-functional|refactor>)
 */

// Keep minimal vscode import for types only
// All API calls should go through vscodeAdapter
// const vscode = require('vscode'); // Commented for consolidation

/**
 * Get workspace-relative path from document
 * @param {vscode.TextDocument} document - Document
 * @param {Object} vscodeAdapter - VS Code adapter (optional, for Ports and Adapters pattern)
 * @returns {string} Relative path or URI string
 */
function relativePathFromDoc(document, vscodeAdapter = null) {
    try {
        // Use vscodeAdapter if available (Ports and Adapters pattern), otherwise fallback to direct vscode
        const asRelativePath = vscodeAdapter 
            ? (uri) => vscodeAdapter.asRelativePath(uri)
            : (uri) => vscode.workspace.asRelativePath(uri);
        return asRelativePath(document.uri);
    } catch {
        return document.uri.toString();
    }
}

/**
 * Find anchor (function/class/method name) for a given line
 * Heuristic-based, no dependencies
 * @param {string} docText - Full document text
 * @param {number} line - Line number (0-indexed)
 * @returns {string} Anchor name or 'top-level'
 */
function findAnchor(docText, line) {
    const lines = docText.split('\n');
    const MAX_SEARCH_LINES = 50; // Limit search to prevent excessive scanning
    
    // Fix: Prefer function/class/const patterns first, only fall back to broad match if needed
    // Search backwards from the changed line
    for (let i = Math.min(line, lines.length - 1); i >= Math.max(0, line - MAX_SEARCH_LINES); i--) {
        const s = lines[i].trim();
        
        // export (default)? class Foo or export class Foo
        const mExportClass = s.match(/\bexport\s+(?:default\s+)?class\s+([A-Za-z0-9_]+)/);
        if (mExportClass) return mExportClass[1];
        
        // class Foo
        const mClass = s.match(/\bclass\s+([A-Za-z0-9_]+)/);
        if (mClass) return mClass[1];
        
        // export (default)? function foo( or export async function foo(
        const mExportFunc = s.match(/\bexport\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/);
        if (mExportFunc) return mExportFunc[1];
        
        // function foo( or async function foo( or function* foo(
        const mFunc = s.match(/\b(?:async\s+)?function\s*\*\s*([A-Za-z0-9_]+)\s*\(/) ||
                     s.match(/\b(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/);
        if (mFunc) return mFunc[1];
        
        // export const foo = ( or export const foo = async ( or export const foo = function
        const mExportConstFunc = s.match(/\bexport\s+(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/);
        if (mExportConstFunc) return mExportConstFunc[1];
        
        // const foo = ( or const foo = async ( or const foo = function or const foo = async function
        const mConstFunc = s.match(/\b(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s+)?(?:function\s*)?\(/) ||
                          s.match(/\b(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*async\s+function/);
        if (mConstFunc) return mConstFunc[1];
        
        // class method: public/private/protected foo(...) or foo<T>(...) or foo() {
        const mClassMethod = s.match(/\b(?:public|private|protected)?\s*([A-Za-z0-9_]+)\s*<[^>]*>\s*\(/) ||
                            s.match(/\b(?:public|private|protected)?\s*([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{/);
        if (mClassMethod) {
            const methodName = mClassMethod[1];
            // Skip common non-method patterns
            if (!['if', 'for', 'while', 'switch', 'catch', 'with'].includes(methodName)) {
                return methodName;
            }
        }
    }
    
    // Fallback: broad match only if we didn't find a declaration pattern
    // This reduces false positives from function calls, test frameworks, etc.
    for (let i = Math.min(line, lines.length - 1); i >= Math.max(0, line - MAX_SEARCH_LINES); i--) {
        const s = lines[i].trim();
        
        // method: foo = ( or foo: ( or foo(
        // Only use if it looks like a declaration context (assignment, property, or followed by {)
        const mMethod = s.match(/\b([A-Za-z0-9_]+)\s*[:=]?\s*\(/);
        if (mMethod) {
            const methodName = mMethod[1];
            // Skip control flow keywords and test framework keywords
            const skipKeywords = ['if', 'for', 'while', 'switch', 'catch', 'with', 'describe', 'it', 'test', 'before', 'after', 'beforeEach', 'afterEach'];
            if (skipKeywords.includes(methodName)) {
                continue;
            }
            
            // Only use if it looks like a declaration (has assignment/colon or followed by {)
            const hasAssignment = s.includes('=') || s.includes(':');
            const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
            const looksLikeDeclaration = hasAssignment || nextLine.startsWith('{') || nextLine.includes('=>');
            
            if (looksLikeDeclaration) {
                return methodName;
            }
        }
    }
    
    return 'top-level';
}

/**
 * Guess impact from changes (heuristic)
 * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Changes
 * @returns {string} 'functional' or 'non-functional'
 */
function guessImpact(aggregatedChanges) {
    if (!aggregatedChanges || aggregatedChanges.length === 0) {
        return 'non-functional';
    }
    
    // Count non-whitespace characters inserted
    const nonWsInserted = aggregatedChanges.reduce((sum, c) => {
        const text = c.text || '';
        return sum + text.replace(/\s/g, '').length;
    }, 0);
    
    // If significant non-whitespace content, likely functional
    // Threshold: 30 characters (rough heuristic)
    return nonWsInserted > 30 ? 'functional' : 'non-functional';
}

// Production: Track last anchor per file for stability (reuse if within ±30 lines)
// Bounded cache to prevent unbounded growth in long sessions
const _lastAnchorCache = new Map(); // file -> { anchor, line }
const MAX_ANCHOR_CACHE_SIZE = 100; // Cap at 100 files (LRU-ish)

/**
 * Build DIFF bullet skeletons from document and changes
 * @param {vscode.TextDocument} document - Document
 * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Aggregated changes
 * @param {Object} classification - Classification result (optional, for origin hint)
 * @param {Object} vscodeAdapter - VS Code adapter (optional, for Ports and Adapters pattern)
 * @returns {Array<string>} Array of DIFF bullet strings
 */
function buildDiffBullets(document, aggregatedChanges, classification = null, vscodeAdapter = null) {
    const path = relativePathFromDoc(document, vscodeAdapter);
    const docText = document.getText();
    
    if (!aggregatedChanges || aggregatedChanges.length === 0) {
        return [];
    }
    
    // Pick first changed line as anchor reference
    const firstChange = aggregatedChanges[0];
    const line = firstChange?.range?.start?.line ?? 0;
    
    // Fix: Reuse anchor if within ±30 lines of previous batch for same file
    // This makes bullets feel less "random" during refactors
    const fileKey = document.uri.toString();
    const lastAnchor = _lastAnchorCache.get(fileKey);
    let anchor;
    
    if (lastAnchor && Math.abs(line - lastAnchor.line) <= 30) {
        // Reuse previous anchor (stable during refactors)
        anchor = lastAnchor.anchor;
    } else {
        // Find new anchor
        anchor = findAnchor(docText, line);
        // Production: Bound cache size (LRU-ish: remove oldest if at limit)
        if (_lastAnchorCache.size >= MAX_ANCHOR_CACHE_SIZE) {
            // Remove first entry (oldest)
            const firstKey = _lastAnchorCache.keys().next().value;
            _lastAnchorCache.delete(firstKey);
        }
        // Cache it
        _lastAnchorCache.set(fileKey, { anchor, line });
    }
    
    // Guess impact from changes
    const impact = guessImpact(aggregatedChanges);
    
    // Infer origin from classification if available
    let originHint = '<ai|human|tool|mixed>';
    if (classification) {
        if (classification.label === 'ai') {
            originHint = 'ai';
        } else if (classification.label === 'formatter') {
            originHint = 'tool';
        } else if (classification.label === 'user') {
            originHint = 'human';
        }
    }
    
    // Generate bullet with placeholder action
    return [
        `- ${path} :: ${anchor} :: <action> (origin=${originHint}, impact=${impact})`
    ];
}

/**
 * Parse DIFF bullets from text
 * @param {string} text - Text containing DIFF bullets
 * @returns {Array<Object>} Parsed bullets with {path, anchor, action, origin, impact}
 */
function parseDiffBullets(text) {
    const DIFF_RE = /^- (.+?) :: (.+?) :: (.+?) \(origin=(ai|human|tool|mixed), impact=(functional|non-functional|refactor)\)$/;
    
    const lines = text.split('\n');
    return lines
        .map(l => l.trim())
        .filter(l => l.startsWith('- '))
        .map(l => {
            const m = l.match(DIFF_RE);
            if (!m) return null;
            return {
                path: m[1],
                anchor: m[2],
                action: m[3],
                origin: m[4],
                impact: m[5]
            };
        })
        .filter(Boolean);
}

// module.exports = { // Commented for consolidation
//     buildDiffBullets, // Commented for consolidation
//     parseDiffBullets, // Commented for consolidation
//     findAnchor, // Commented for consolidation
//     guessImpact // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/diffBulletBuilder.js


// ============================================================================
// FILE 49/54: domain/utils/reasonFilter.js
// ============================================================================

(function() { // IIFE scope for domain/utils/reasonFilter.js
/**
 * Reason Filter
 * Filters classification reasons by tag prefix based on final label
 */

/**
 * Filter reasons by reasonTag prefix based on final classification label
 * This reduces noise in logs and makes debugging easier
 * @param {Array<{tag: string|null, text: string}>} reasonObjects - Array of reason objects with tags
 * @param {string} label - Final classification label ('ai'|'user'|'formatter'|'unknown')
 * @returns {Array<string>} Filtered array of reason strings
 */
function filterReasons(reasonObjects, label) {
    return reasonObjects
        .filter(r => {
            if (!r.tag) return true; // Keep reasons without tags (e.g., marker detection)
            
            if (label === 'formatter') {
                return r.tag.startsWith('fmt:');
            } else if (label === 'ai') {
                return r.tag.startsWith('ai:');
            } else if (label === 'user') {
                return r.tag.startsWith('user:');
            }
            return true; // Keep all reasons for unknown
        })
        .map(r => r.text);
}

// module.exports = { // Commented for consolidation
//     filterReasons // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/reasonFilter.js


// ============================================================================
// FILE 50/54: domain/utils/utils.js
// ============================================================================

(function() { // IIFE scope for domain/utils/utils.js
/**
 * Awareness Monitor Utilities
 * Shared constants and utility functions used across awareness monitor modules
 */

// const vscode = require('vscode'); // Commented for consolidation
// const path = require('path'); // Commented for consolidation

// Constants for file filtering
const NON_CODE_SCHEMES = ['output', 'vscode', 'vscode-notebook', 'debug', 'vscode-userdata', 'git'];
// Fix: Store extensions in lowercase for consistent comparison
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj', '.sh', '.bash', '.zsh', '.fish'].map(ext => ext.toLowerCase());

/**
 * Check if a document should be skipped (non-code documents)
 * FIXED: Consistent API - always accepts document
 * @param {vscode.TextDocument} document - The document to check
 * @returns {boolean} True if the document should be skipped
 */
function isNonCodeDocument(document) {
    if (!document) return true;
    
    const scheme = document.uri.scheme;
    
    // Scheme blacklist (always skip these)
    if (NON_CODE_SCHEMES.includes(scheme)) {
        return true;
    }
    
    // Fix: Filter by file extension (only process code files)
    // Fix: Handle remote/virtual docs properly - prefer uri.path, strip query/fragment
    const p = (document.uri?.path || document.fileName || '');
    const clean = p.split('?')[0].split('#')[0]; // Strip query and fragment
    const ext = path.extname(clean).toLowerCase();
    
    // If we have an extension and it's not in the code extensions list, skip it
    if (ext && !CODE_EXTENSIONS.includes(ext)) {
        return true;
    }
    
    // Handle untitled documents (user-controlled)
    // untitled can be code, so we don't skip it by default if no extension
    
    return false;
}

/**
 * Check if a URI scheme should be skipped (for cases where we only have URI, not document)
 * @param {vscode.Uri|string} uriOrScheme - URI or scheme string
 * @returns {boolean} True if the URI should be skipped
 */
function isSkippableUri(uriOrScheme) {
    let scheme;
    if (typeof uriOrScheme === 'string') {
        scheme = uriOrScheme;
    } else {
        scheme = uriOrScheme.scheme;
    }
    
    return NON_CODE_SCHEMES.includes(scheme);
}

/**
 * Normalize file path or URI to canonical URI string
 * FIXED: Use URI as canonical identifier for remote workspace compatibility
 * @param {string|vscode.Uri} filePathOrUri - File path (fsPath) or URI
 * @returns {string} Canonical URI string
 */
function normalizeToUri(filePathOrUri) {
    if (!filePathOrUri) return null;
    
    // If already a URI string (starts with scheme), return as-is
    if (typeof filePathOrUri === 'string' && filePathOrUri.includes('://')) {
        return filePathOrUri;
    }
    
    // If it's a vscode.Uri object, convert to string
    if (filePathOrUri && typeof filePathOrUri === 'object' && filePathOrUri.toString) {
        return filePathOrUri.toString();
    }
    
    // If it's a file path (fsPath), convert to file:// URI
    if (typeof filePathOrUri === 'string') {
        try {
            const uri = vscode.Uri.file(filePathOrUri);
            return uri.toString();
        } catch (err) {
            // Fallback: treat as relative path or return as-is
            return filePathOrUri;
        }
    }
    
    return filePathOrUri;
}

/**
 * Get relative path from workspace folder
 * @param {string} filePath - Absolute file path
 * @returns {string} Relative path or basename if not in workspace
 */
function getRelativePath(filePath) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return path.basename(filePath);
    }
    
    // Try each workspace folder
    for (const folder of workspaceFolders) {
        const folderPath = folder.uri.fsPath;
        if (filePath.startsWith(folderPath)) {
            const relative = path.relative(folderPath, filePath);
            return relative || path.basename(filePath);
        }
    }
    
    // Fallback to basename if not in workspace
    return path.basename(filePath);
}

/**
 * Check if a position is within a range
 * @param {vscode.Position} position - The position to check
 * @param {vscode.Range} range - The range to check against
 * @returns {boolean} True if position is within range
 */
function isPositionInRange(position, range) {
    if (position.line < range.start.line || position.line > range.end.line) {
        return false;
    }
    if (position.line === range.start.line && position.character < range.start.character) {
        return false;
    }
    if (position.line === range.end.line && position.character > range.end.character) {
        return false;
    }
    return true;
}

/**
 * Check if two ranges overlap
 * Fix: Use VS Code's built-in range intersection for accurate overlap detection
 * @param {vscode.Range} range1 - First range
 * @param {vscode.Range} range2 - Second range
 * @returns {boolean} True if ranges overlap
 */
function rangesOverlap(range1, range2) {
    // Fix: Use VS Code's built-in intersection method for accurate overlap detection
    // This properly handles character positions on the same line
    return range1.intersection(range2) !== undefined;
}

// module.exports = { // Commented for consolidation
//     NON_CODE_SCHEMES, // Commented for consolidation
//     CODE_EXTENSIONS, // Commented for consolidation
//     isNonCodeDocument, // Commented for consolidation
//     isSkippableUri, // Commented for consolidation
//     normalizeToUri, // Commented for consolidation
//     getRelativePath, // Commented for consolidation
//     isPositionInRange, // Commented for consolidation
//     rangesOverlap // Commented for consolidation
// }; // Commented for consolidation

})(); // End IIFE for domain/utils/utils.js


// ============================================================================
// FILE 51/54: domain/utils/versionDriftHandler.js
// ============================================================================

(function() { // IIFE scope for domain/utils/versionDriftHandler.js
/**
 * Version Drift Handler
 * Detects document version drift and caps confidence when document changed externally
 */

/**
 * Check if document version has drifted (changed externally)
 * @param {vscode.TextDocument} document - Current document
 * @param {number} lastSeenVersion - Last seen document version
 * @returns {boolean} True if version has drifted
 */
function hasVersionDrift(document, lastSeenVersion) {
    return document && document.version !== lastSeenVersion;
}

/**
 * Apply version drift confidence cap to classification
 * @param {Object} classification - Classification result (will be mutated)
 * @param {vscode.TextDocument} document - Current document
 * @param {number} lastSeenVersion - Last seen document version
 * @param {number} lastSeenTimestamp - Last seen timestamp
 * @param {Object} metrics - Metrics object to update drift count
 * @returns {boolean} True if drift was detected and cap was applied
 */
function applyDriftCap(classification, document, lastSeenVersion, lastSeenTimestamp, metrics) {
    if (!hasVersionDrift(document, lastSeenVersion)) {
        return false;
    }
    
    const originalConfidence = classification.confidence;
    classification.confidence = Math.min(classification.confidence, 0.6); // Cap at 0.6
    
    if (originalConfidence > 0.6) {
        // Production: Track drift for observability
        if (metrics) {
            metrics.versionDriftCount++;
        }
        
        // Fix: Include version and timestamp in drift reason for easier debugging
        // Clarify: version changed after last captured event (could be external edit or missed internal event)
        const driftAge = lastSeenTimestamp ? Date.now() - lastSeenTimestamp : 0;
        classification.reasons.push(`meta:version_drift document version ${document.version} vs last seen ${lastSeenVersion} (age: ${driftAge}ms, version changed after last captured event, confidence capped)`);
        
        // Production: Add meta flag for metrics/observability
        if (!classification.meta) {
            classification.meta = {};
        }
        classification.meta.versionDrift = true;
        
        return true;
    }
    
    return false;
}

// module.exports = { // Commented for consolidation
//     hasVersionDrift, // Commented for consolidation
//     applyDriftCap // Commented for consolidation
// }; // Commented for consolidation


})(); // End IIFE for domain/utils/versionDriftHandler.js


// ============================================================================
// FILE 52/54: domain/value_objects/filePath.js
// ============================================================================

(function() { // IIFE scope for domain/value_objects/filePath.js
/**
 * FilePath - Value object for file paths
 * 
 * Encapsulates file path validation and normalization.
 */

class FilePath {
    constructor(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('FilePath must be a non-empty string');
        }
        this.value = value.trim();
        if (this.value.length === 0) {
            throw new Error('FilePath cannot be empty');
        }
    }

    equals(other) {
        return other instanceof FilePath && this.value === other.value;
    }

    toString() {
        return this.value;
    }

    /**
     * Get the file name (last segment of path)
     * @returns {string} File name
     */
    getFileName() {
        const parts = this.value.split(/[/\\]/);
        return parts[parts.length - 1];
    }

    /**
     * Get the directory path
     * @returns {string} Directory path
     */
    getDirectory() {
        const lastSlash = Math.max(this.value.lastIndexOf('/'), this.value.lastIndexOf('\\'));
        if (lastSlash === -1) return '';
        return this.value.substring(0, lastSlash);
    }
}

// module.exports = FilePath; // Commented for consolidation


})(); // End IIFE for domain/value_objects/filePath.js

