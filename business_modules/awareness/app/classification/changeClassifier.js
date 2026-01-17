/**
 * Change Classifier
 * Debounced aggregation and AI/user classification for text changes
 **/ 


// Import detectors
const { hasAIMarker } = require('./detectors/markerDetector');
const { calculateMetrics } = require('./detectors/changeAnalyzer');
const { detectFormatter } = require('./detectors/formatterDetector');
const { detectRapidScattered } = require('./detectors/rapidScatteredDetector');
const { detectMultiLineInsertion } = require('./detectors/multiLineDetector');
const { detectPureInsertions } = require('./detectors/pureInsertionDetector');
const { detectLargeInsertion } = require('./detectors/largeInsertionDetector');
const { detectScatteredEdits } = require('./detectors/scatteredEditsDetector');
const { detectSmallEdits } = require('./detectors/smallEditsDetector');

// Import extracted modules
const { createConfig } = require('./configManager');
const { createPendingEntry, calculateEventRangeSet, addChangesWithCapping, recordEventMetadata } = require('./changeAggregator');
const { accumulateScores, determineLabel } = require('../scoring/classificationScorer');
const { applyDriftCap } = require('./versionDriftHandler');
const { filterReasons } = require('./reasonFilter');
const safe = require('../../../../safe');

class ChangeClassifier {
    /**
     * @param {number} debounceMs - Debounce window in milliseconds
     * @param {Object} config - Classification configuration (mode-specific thresholds)
     * @param {ILoggerPort} loggerPort - Logger port (optional, for config validation warnings)
     */
    constructor(debounceMs = 200, config = null, loggerPort = null) {
        this.debounceMs = debounceMs;
        this.pendingChanges = new Map(); // document URI -> { changes: [], timer: null, lastChangeTime: 0, documentVersion: null, onClassified: null }
        this.maxChangesPerDocumentBatch = 200; // Cap changes per document batch (safety)
        
        // Production: Metrics for observability
        this.metrics = {
            versionDriftCount: 0, // Track how often drift happens
            totalClassifications: 0
        };
        
        // Create and merge configuration (pass logger for validation warnings)
        this.config = createConfig(config, loggerPort);
        
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
            safe('onClassified', () => onClassified(document, classification, changes));
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
        const { aiScore, formatterScore, userScore, reasonObjects, contributors } = accumulateScores(detectors);
        
        // Determine final label and confidence
        const { label, confidence } = determineLabel(aiScore, formatterScore, userScore);
        
        // Filter reasons by tag prefix
        const filteredReasons = filterReasons(reasonObjects, label);
        
        // Calculate top contributors and uncertainty for explainable UX
        const { getTopContributors, calculateUncertainty } = require('../scoring/classificationScorer');
        const topContributors = getTopContributors(contributors, label, confidence);
        const uncertainty = calculateUncertainty(aiScore, formatterScore, userScore);
        
        return { 
            label, 
            confidence, 
            reasons: filteredReasons,
            topContributors,
            uncertainty,
            provenanceScore: label === 'ai' ? confidence : (label === 'formatter' ? 0 : (label === 'user' ? 0 : 0.2))
        };
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

module.exports = ChangeClassifier;
