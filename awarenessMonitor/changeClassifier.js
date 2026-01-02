/**
 * Change Classifier
 * Debounced aggregation and AI/user classification for text changes
 * 
 * PRIMARY DETECTION: @ai marker (100% accurate when present)
 * - Checks for @ai marker in various comment formats (// @ai, # @ai, <!-- @ai -->, etc.)
 * - Marker detection is the primary and default signal for AI-generated code
 * 
 * FALLBACK (optional): Heuristic-based detection
 * - Only used if markerOnly: false in config
 * - Aggregates rapid changes within a time window
 * - Analyzes batch characteristics (total size, range count, distribution)
 * - Very conservative thresholds to avoid false positives
 * 
 * By default, uses marker-only mode (markerOnly: true) for 100% accuracy.
 * Heuristics are available as optional fallback but disabled by default.
 * 
 * FIXED: Stores callback once per document to prevent double recording
 */

class ChangeClassifier {
    /**
     * @param {number} debounceMs - Debounce window in milliseconds
     * @param {Object} config - Classification configuration (mode-specific thresholds)
     */
    constructor(debounceMs = 200, config = null) {
        this.debounceMs = debounceMs;
        this.pendingChanges = new Map(); // document URI -> { changes: [], timer: null, lastChangeTime: 0, documentVersion: null, onClassified: null }
        this.maxPendingChanges = 200; // Cap pending changes per document (safety)
        
        // Default config (DEV mode - conservative)
        this.config = config || {
            // VIBE: more permissive (lower thresholds)
            // DEV: more conservative (higher thresholds)
            // OWNER: most conservative
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
            // Marker-only mode: if true, only use @ai marker, ignore heuristics
            // If false, use marker as primary signal with conservative heuristics as fallback
            markerOnly: true  // Default: rely solely on @ai marker for 100% accuracy
        };
        
        this.markerOnly = this.config.markerOnly || false;
    }

    /**
     * Add a batch of changes from a TextDocumentChangeEvent
     * FIXED: Accepts whole event, stores callback once per document
     * @param {vscode.TextDocumentChangeEvent} event - Text document change event
     * @param {Function} onClassified - Callback with (document, isAI, aggregatedChanges) - stored once per document
     */
    addEvent(event, onClassified) {
        if (!event || !event.contentChanges || event.contentChanges.length === 0) {
            return;
        }
        
        const uri = event.document.uri.toString();
        const now = Date.now();
        
        if (!this.pendingChanges.has(uri)) {
            this.pendingChanges.set(uri, {
                changes: [],
                timer: null,
                lastChangeTime: 0,
                documentVersion: null,
                onClassified: null,
                document: null // Store document reference for flush
            });
        }
        
        const pending = this.pendingChanges.get(uri);
        
        // Store callback once per document (prevents double recording)
        // Use latest callback if provided, otherwise keep existing
        if (onClassified) {
            pending.onClassified = onClassified;
        }
        pending.document = event.document; // Update document reference
        pending.documentVersion = event.document.version;
        
        // Add all changes from event as one batch
        for (const change of event.contentChanges) {
            // Cap pending changes per document (safety)
            if (pending.changes.length >= this.maxPendingChanges) {
                // Drop oldest change
                pending.changes.shift();
            }
            pending.changes.push(change);
        }
        
        pending.lastChangeTime = now;
        
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

    /**
     * Classify aggregated changes and emit result
     * @private
     */
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
        const document = pending.document;
        const onClassified = pending.onClassified;
        const isAI = this._classifyAsAI(changes);
        
        // Clear timer ref
        if (pending.timer) {
            clearTimeout(pending.timer);
            pending.timer = null;
        }
        
        // Clear pending
        this.pendingChanges.delete(uri);
        
        // Emit classification (single callback, prevents double recording)
        if (onClassified && document) {
            onClassified(document, isAI, changes);
        }
    }

    /**
     * Check if changes contain @ai marker (primary signal for AI-generated code)
     * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
     * @returns {boolean} True if @ai marker is found
     * @private
     */
    _hasAIMarker(changes) {
        // Check for @ai marker in various comment formats
        const markerPatterns = [
            /\/\/\s*@ai/i,           // JavaScript/TypeScript/Java/C/C++/C#
            /#\s*@ai/i,               // Python/Shell/Bash
            /<!--\s*@ai\s*-->/,       // HTML/XML/Markdown
            /--\s*@ai/i,              // SQL
            /\/\*\s*@ai\s*\*\//i      // CSS
        ];
        
        for (const change of changes) {
            const text = change.text;
            for (const pattern of markerPatterns) {
                if (pattern.test(text)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Classify aggregated changes as AI or user
     * PRIMARY: Checks for @ai marker (explicit signal) - 100% reliable when present
     * FALLBACK: Very conservative heuristics only when marker is missing (safety net)
     * 
     * Strategy: Marker is the source of truth. Heuristics only catch edge cases where
     * marker might be missing (AI forgot, user removed, legacy code).
     * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
     * @returns {boolean} True if likely AI-generated
     * @private
     */
    _classifyAsAI(changes) {
        if (changes.length === 0) return false;
        
        // PRIMARY SIGNAL: Check for @ai marker first (most reliable - 100% accurate)
        if (this._hasAIMarker(changes)) {
            return true; // Explicit marker = definitely AI (trust this completely)
        }
        
        // If marker-only mode is enabled, skip heuristics entirely
        if (this.markerOnly) {
            return false; // No marker = assume user edit
        }
        
        // FALLBACK: Very conservative heuristics only when marker is missing
        // Only trigger on very strong signals to avoid false positives
        // This is a safety net for cases where marker might be missing
        // Aggregate metrics
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
            
            // Improved: Track full range (start and end) for better distinct range counting
            const rangeKey = `${change.range.start.line}:${change.range.start.character}-${change.range.end.line}:${change.range.end.character}`;
            distinctRanges.add(rangeKey);
            
            startLines.push(change.range.start.line);
            endLines.push(change.range.end.line);
        }
        
        // Calculate line span (max line - min line)
        const maxLineSpan = startLines.length > 0 
            ? Math.max(...startLines) - Math.min(...startLines)
            : 0;
        
        // Calculate scatteredness (changes where start line differs by > 5 from previous)
        let scatteredness = 0;
        for (let i = 1; i < startLines.length; i++) {
            if (Math.abs(startLines[i] - startLines[i - 1]) > 5) {
                scatteredness++;
            }
        }
        
        // Improved heuristics with formatter detection
        
        // 1. Formatter pattern: many scattered changes with deletes across wide span
        if (totalDeleted > 0 && 
            distinctRanges.size >= this.config.formatterRangeCount && 
            maxLineSpan >= this.config.formatterLineSpan) {
            return false; // Likely formatter, NOT AI
        }
        
        // FALLBACK HEURISTICS (only when marker is missing - very conservative)
        // These are safety nets, not primary signals. Be very conservative to avoid false positives.
        
        // 2. Very large multi-line insertions in localized area (strong AI signal)
        // Increased thresholds to be more conservative
        if (hasMultiLine && 
            totalInserted >= (this.config.aiMultiLineSize * 2) && // Double the threshold
            maxLineSpan <= this.config.aiLineSpan) {
            return true;
        }
        
        // 3. Very large pure insertions (no deletes) - only if substantial
        // Increased thresholds significantly
        if (pureInsertionCount >= (this.config.pureInsertionCount * 2) && 
            totalInserted > (this.config.pureInsertionSize * 3) && // Triple the threshold
            totalDeleted === 0) {
            return true;
        }
        
        // 4. Very large single insertion (AI adds substantial code)
        // Only if extremely large (safety net for missing marker)
        if (totalInserted > (this.config.largeInsertionThreshold * 2) && totalDeleted === 0) {
            return true;
        }
        
        // 5. Scattered edits - be VERY conservative (could be formatter or AI)
        // Only classify as AI if extremely large and scattered
        if (distinctRanges.size >= (this.config.scatteredRangeCount * 2) && 
            changes.length >= (this.config.scatteredChangeCount * 2)) {
            // Only classify as AI if extremely large (formatters can be large too)
            return totalInserted > (this.config.scatteredSizeThreshold * 2);
        }
        
        // 6. Small multi-line inserts - always treat as user
        if (hasMultiLine && totalInserted < 20) {
            return false; // Too small, likely user formatting
        }
        
        // Default: assume user edit (very conservative - marker is primary signal)
        // If marker is missing and heuristics don't strongly indicate AI, assume user
        return false;
    }

    /**
     * Force classification of pending changes for a document (for cleanup/flush)
     * @param {vscode.TextDocument} document - The document
     * @param {Function} onClassified - Optional callback (uses stored if not provided)
     */
    flush(document, onClassified) {
        if (!document) return;
        
        const uri = document.uri.toString();
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
            pending.document = document; // Update document reference
            this._classifyAndEmit(uri);
        }
    }

    /**
     * Flush all pending changes (for cleanup on extension stop)
     * FIXED: Actually calls callbacks before clearing
     * @param {Function} onClassified - Optional callback for all flushed documents
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
                    const changes = pending.changes;
                    const isAI = this._classifyAsAI(changes);
                    pending.onClassified(pending.document, isAI, changes);
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
}

module.exports = ChangeClassifier;
