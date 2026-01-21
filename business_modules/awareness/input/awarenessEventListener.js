/**
 * AwarenessEventListener - Input layer event listener for awareness monitoring
 * 
 * Bridges VS Code events to AwarenessEngine. This is the input layer that receives
 * external events and delegates to the engine, maintaining isolation between
 * input handling and business logic.
 */



class AwarenessEventListener {
    /**
     * @param {AwarenessEngine} engine - Awareness engine instance
     */
    constructor(engine) {
        if (!engine) {
            throw new Error('AwarenessEventListener requires engine');
        }
        
        this.engine = engine;
        
        this.activeReviewSuggestion = new Map(); // document URI -> { suggestionId, reviewStarted, reviewTime, dwellTimer }
        
        // Duplicate detection cache for file saves (primary key: uri + version)
        this.saveCache = new Map(); // `${uri}:${version}` -> { hash: string, timestamp: number }
        
        // Track previous active document for flush on editor change
        this.previousActiveDocumentUri = null;
    }

    /**
     * Detect potential AI-generated code changes
     * FIXED: Calls classifier once per event (not per change), single callback per document
     * @param {vscode.TextDocumentChangeEvent} event - Text document change event
     */
    
    onTextChange(event) {
        if (event.contentChanges.length === 0) return;

        // Only process real code documents.
        // This prevents feedback loops where changes to Output/Debug/virtual documents
        // (e.g. `extension-output-...`) get classified as AI edits.
        if (!event?.document || !this.engine?.isValidCodeDocument?.(event.document)) {
            return;
        }
        
        // Delegate to engine - handles validation, logging, classification, and result processing
        this.engine.classifyTextChange(event);
    }

    /**
     * Handle file creation (AI creating new files)
     * FIXED: Uses isSkippableUri for URI-only checks
     * @param {vscode.FileCreateEvent} event - File create event
     */
    onFilesCreated(event) {
        // Delegate to engine - handles validation, logging, and processing
        for (const fileUri of event.files) {
            this.engine.handleFileCreated(fileUri, {
                isFileCreation: true,
                filePath: null // Let processFileAsSuggestion handle path extraction from URI
            });
        }
    }

    /**
     * Handle file saves (entire file writes by AI)
     * FIXED: Uses URI string as canonical identifier (remote-safe)
     * @param {vscode.TextDocument} document - The saved document
     */
    onFileSaved(document) {
        if (!document) return;

        // Only process real code documents (avoid virtual/output docs).
        if (this.engine?.isValidCodeDocument && !this.engine.isValidCodeDocument(document)) {
            return;
        }

        const uri = document?.uri?.toString?.() || '';
        const content = document.getText();

        // De-dupe saves: avoid repeatedly re-processing identical content.
        const now = Date.now();
        const contentHash = this.engine?.getContentHash ? this.engine.getContentHash(content) : String(content.length);
        const cacheKey = `${uri}:${contentHash}`;
        const cached = this.saveCache.get(cacheKey);
        if (cached && (now - cached.timestamp) < 60_000) {
            return;
        }
        this.saveCache.set(cacheKey, { timestamp: now });

        // Basic cache hygiene: remove old entries and cap size.
        for (const [key, value] of this.saveCache.entries()) {
            if (!value || (now - value.timestamp) > 5 * 60_000) {
                this.saveCache.delete(key);
            }
        }
        if (this.saveCache.size > 200) {
            const entries = Array.from(this.saveCache.entries()).sort((a, b) => (b[1]?.timestamp || 0) - (a[1]?.timestamp || 0));
            this.saveCache.clear();
            for (const [key, value] of entries.slice(0, 150)) {
                this.saveCache.set(key, value);
            }
        }

        // Heuristic: treat saves as AI-sourced if the file contains strong @ai markers.
        const hasAIMarker = this._hasAIMarkerInText(content);
        const options = hasAIMarker ? { source: 'agent', hasAIMarker: true } : {};

        // Delegate to engine (may record a file-write suggestion + debt).
        this.engine.handleFileSaved(document, options);
    }

    _hasAIMarkerInText(text) {
        if (!text || typeof text !== 'string') return false;
        const markerPatterns = [
            /\/\/\s*@ai/i,                    // JS/TS/etc.
            /#\s*@ai/i,                        // Python/Shell
            /<!--[\s\S]*?@ai[\s\S]*?-->/i,     // HTML/XML/Markdown
            /--\s*@ai/i,                       // SQL
            /\/\*[\s\S]*?@ai[\s\S]*?\*\//i     // CSS block comment
        ];
        return markerPatterns.some((p) => p.test(text));
    }

    /**
     * Handle file opened (user might be reviewing debt or pending suggestions)
     * @param {vscode.TextDocument} document - The opened document
     */
    onFileOpened(document) {
        if (!document) return;
        if (this.engine?.isValidCodeDocument && !this.engine.isValidCodeDocument(document)) {
            return;
        }

        const uri = document.uri.toString();

        // If this file was created/modified externally (no typing event), VS Code may not emit
        // onDidCreateFiles/onDidChangeTextDocument for VibeSwitch to classify. To keep behavior
        // consistent for @ai-marked files, treat an @ai-marked open as an AI-sourced "file write"
        // *once per content hash* (deduped).
        // 
        // FIXED: Also check if file has unreviewed debt - if it does, we should still process
        // to ensure file-level debt is tracked even if there are no pending suggestions yet.
        try {
            const hasPending = typeof this.engine?.hasPendingSuggestions === 'function'
                ? this.engine.hasPendingSuggestions(uri)
                : false;
            
            const hasUnreviewedDebt = typeof this.engine?.hasUnreviewedDebt === 'function'
                ? this.engine.hasUnreviewedDebt(uri)
                : false;

            // Process if: no pending suggestions OR file has unreviewed debt (to ensure debt tracking)
            if (!hasPending || hasUnreviewedDebt) {
                const content = document.getText();
                const hasAIMarker = this._hasAIMarkerInText(content);
                if (hasAIMarker) {
                    const now = Date.now();
                    const contentHash = this.engine?.getContentHash ? this.engine.getContentHash(content) : String(content.length);
                    const cacheKey = `${uri}:${contentHash}:open`;
                    const cached = this.saveCache.get(cacheKey);
                    if (!cached || (now - cached.timestamp) > 5 * 60_000) {
                        this.saveCache.set(cacheKey, { timestamp: now });
                        this.engine.handleFileSaved(document, { source: 'agent', hasAIMarker: true, triggeredBy: 'open' });
                    }
                }
            }
        } catch {
            // Never let open-handling throw.
        }

        // Delegate to engine - expects canonical URI string (may start session tracking if debt/pending exists)
        this.engine.handleFileOpened(uri);
    }

    /**
     * Handle document close (flush classifier, close reviews)
     * FIXED: Properly flushes classifier for closed document
     * @param {vscode.TextDocument} document - The closed document
     */
    onDocumentClose(document) {
        if (!document) return;
        
        const uri = document.uri.toString();
        
        // Fix: Emit with source meta instead of silent flush to preserve evidence
        // Silent flush drops potentially important data (user closed file quickly)
        // Emit with source='close' so downstream can filter if needed
        this.engine.flushChanges(document, { source: 'close' });
        
        // Close any active review for this document
        this._closeActiveReview(uri);
    }

    _closeActiveReview(uri) {
        const activeReview = this.activeReviewSuggestion.get(uri);
        if (!activeReview) return;
        
        // Fix: Clear dwell timer if it exists
        if (activeReview.dwellTimer) {
            clearTimeout(activeReview.dwellTimer);
        }
        
        if (activeReview.reviewStarted) {
            const suggestions = this.engine.getSuggestions();
            const suggestion = suggestions.find(s => s.id === activeReview.suggestionId);
            
            if (suggestion) {
                const reviewDuration = Date.now() - activeReview.reviewStarted;
                // FIXED: Update review time in suggestion (for score calculation)
                // But review state is stored separately (domain separation)
                this.engine.updateSuggestionReviewTime(activeReview.suggestionId, (suggestion.reviewTime || 0) + reviewDuration);
                // Fix: Only mark as reviewed if dwell time was met (handled by timer)
                // Don't mark here - let the timer do it
            }
        }
        
        this.activeReviewSuggestion.delete(uri);
    }

    /**
     * Track cursor activity in files being reviewed
     * FIXED: Review state stored separately from suggestion objects
     * @param {vscode.TextEditorSelectionChangeEvent} event - Cursor move event
     */
    onCursorMove(event) {
        if (!event.textEditor || !event.selections.length) return;
        
        const editor = event.textEditor;
        const position = event.selections[0].active;
        const uri = editor.document.uri.toString();
        
        // Delegate to engine - returns helper functions for review tracking
        const helpers = this.engine.handleCursorMove(uri, position);
        if (!helpers) return;
        
        const { getPendingSuggestions, isPositionInRange } = helpers;
        const pendingSuggestions = getPendingSuggestions();
        const activeReview = this.activeReviewSuggestion.get(uri);
        
        // First, close any active review that's no longer valid
        if (activeReview) {
            const activeSuggestion = pendingSuggestions.find(s => s.id === activeReview.suggestionId);
            if (activeSuggestion && activeSuggestion.document === uri) {
                // Check if cursor is still in this suggestion
                if (!isPositionInRange(position, activeSuggestion.range)) {
                    // Cursor left the suggestion - close review
                    this._closeActiveReview(uri);
                } else {
                    // Still in active suggestion - continue tracking
                    return;
                }
            } else {
                // Active suggestion no longer exists or is in different document
                this.activeReviewSuggestion.delete(uri);
            }
        }
        
        // Now check if cursor entered a new suggestion
        for (const suggestion of pendingSuggestions) {
            if (suggestion.document !== uri) continue;
            
            // Check if cursor is within suggestion range
            if (isPositionInRange(position, suggestion.range)) {
                // Initialize review time if needed
                if (!suggestion.reviewTime) {
                    suggestion.reviewTime = 0;
                }
                
                // Fix: Require dwell time (1000ms) before marking as reviewed
                // This avoids marking accidental cursor touches as "reviewed"
                const reviewStarted = Date.now();
                const dwellTimer = setTimeout(() => {
                    // Only mark as reviewed after dwell time
                    const currentReview = this.activeReviewSuggestion.get(uri);
                    if (currentReview && currentReview.suggestionId === suggestion.id) {
                        this.engine.markSuggestionAsReviewed(suggestion.id);
                        // Fix: Trigger status check and updates immediately after marking as reviewed
                        // This prevents UX feeling delayed/stuck until next scheduled status check
                        this.engine.checkSuggestionStatus(suggestion.id);
                        // updateFileColorsInExplorer and updateScore are handled by checkSuggestionStatus
                    }
                }, 1000); // 1000ms dwell time
                
                // FIXED: Store review state separately (domain separation)
                this.activeReviewSuggestion.set(uri, {
                    suggestionId: suggestion.id,
                    reviewStarted: reviewStarted,
                    reviewTime: 0, // Track separately
                    dwellTimer: dwellTimer // Store timer for cleanup
                });
                return; // Only track one suggestion at a time
            }
        }
    }

    /**
     * Track scroll activity in files being reviewed
     * @param {vscode.TextEditorVisibleRangesChangeEvent} event - Scroll event
     */
    onScroll(event) {
        if (!event.textEditor) return;
        
        // FIXED: Use URI as canonical identifier (works with remote workspaces)
        const uri = event.textEditor.document.uri.toString();
        
        // Update review tracking if this file has debt
        this.engine.handleScroll(uri);
    }

    /**
     * Track active editor changes
     * FIXED: Flushes classifier for previous document before switching
     * @param {vscode.TextEditor} editor - The active editor
     */
    onEditorChange(editor) {
        // Delegate to engine - handles flushing previous document
        this.engine.handleEditorChange(editor, this.previousActiveDocumentUri);
        
        // Store current document URI for next flush
        this.previousActiveDocumentUri = editor?.document?.uri.toString() || null;
        
        // Close all active reviews when switching editors
        for (const uri of this.activeReviewSuggestion.keys()) {
            this._closeActiveReview(uri);
        }
        
        // Track as file opened if it has debt
        if (editor?.document) {
            this.onFileOpened(editor.document);
        }
    }

    /**
     * Cleanup resources (called when stopping monitor)
     * FIXED: Flushes all pending classifier changes before clearing
     */
    dispose() {
        // Flush all pending classifier changes (automatically handles classification results)
        this.engine.flushAllChanges();
        
        // Close all active reviews (cleans up dwell timers)
        for (const uri of this.activeReviewSuggestion.keys()) {
            this._closeActiveReview(uri);
        }
        this.activeReviewSuggestion.clear();
        
        // Clear caches
        this.saveCache.clear();
    }
}

module.exports = AwarenessEventListener;
