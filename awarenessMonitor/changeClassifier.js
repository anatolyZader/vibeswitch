/**
 * Change Classifier
 * Debounced aggregation and AI/user classification for text changes
 * 
 * This module addresses the issue of noisy AI detection by:
 * - Aggregating rapid changes within a time window
 * - Analyzing batch characteristics (total size, range count, distribution)
 * - Providing more accurate AI vs user classification
 * - Configurable thresholds per mode (VIBE/DEV/OWNER)
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
            aiMultiLineSize: 50
        };
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
     * Classify aggregated changes as AI or user
     * Improved heuristics with range density and locality analysis
     * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
     * @returns {boolean} True if likely AI-generated
     * @private
     */
    _classifyAsAI(changes) {
        if (changes.length === 0) return false;
        
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
        
        // 2. AI pattern: multi-line insertions in a localized area
        if (hasMultiLine && 
            totalInserted >= this.config.aiMultiLineSize && 
            maxLineSpan <= this.config.aiLineSpan) {
            return true;
        }
        
        // 3. AI pattern: many pure insertions (no deletes) - AI applies edits as many small changes
        if (pureInsertionCount >= this.config.pureInsertionCount && 
            totalInserted > this.config.pureInsertionSize && 
            totalDeleted === 0) {
            return true;
        }
        
        // 4. Large single insertion (AI adds substantial code)
        if (totalInserted > this.config.largeInsertionThreshold && totalDeleted === 0) {
            return true;
        }
        
        // 5. Scattered edits - be conservative (could be formatter or AI)
        if (distinctRanges.size >= this.config.scatteredRangeCount && 
            changes.length >= this.config.scatteredChangeCount) {
            // Only classify as AI if very large (formatters can be large too)
            return totalInserted > this.config.scatteredSizeThreshold;
        }
        
        // 6. Small multi-line inserts (like adding \n or quick wrap) - treat as user unless meaningful
        if (hasMultiLine && totalInserted < 20) {
            return false; // Too small, likely user formatting
        }
        
        // Default: assume user edit (more conservative)
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
