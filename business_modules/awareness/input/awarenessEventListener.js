/**
 * AwarenessEventListener - Input layer event listener for awareness monitoring
 * 
 * Bridges VS Code events to AwarenessController. This is the input layer that receives
 * external events and delegates to the controller, maintaining isolation between
 * input handling and business logic.
 */


// No domain utility imports - all validation and business logic delegated to controller/service

class AwarenessEventListener {
    /**
     * @param {AwarenessController} controller - Awareness controller instance
     */
    constructor(controller) {
        if (!controller) {
            throw new Error('AwarenessEventListener requires controller');
        }
        
        this.controller = controller;
        
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
        
        // Delegate to controller - handles validation, logging, classification, and result processing
        this.controller.classifyTextChange(event);
    }

    /**
     * Handle file creation (AI creating new files)
     * FIXED: Uses isSkippableUri for URI-only checks
     * @param {vscode.FileCreateEvent} event - File create event
     */
    onFilesCreated(event) {
        // Delegate to controller - handles validation, logging, and processing
        for (const fileUri of event.files) {
            this.controller.handleFileCreated(fileUri, {
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
        // Manage cache (input-layer state)
        const uri = document.uri.toString();
        const cacheKey = `${uri}:${document.version}`;
        const cached = this.saveCache.get(cacheKey);
        
        // If we already processed this exact version, skip
        if (cached) {
            return; // Already processed
        }
        
        // Delegate to controller - handles validation, logging, and processing
        // Controller will return whether it was processed, then we update cache
        const wasProcessed = this.controller.handleFileSaved(document);
        
        if (wasProcessed) {
            // Update cache (primary key: version)
            const content = document.getText();
            const contentHash = this.controller.getContentHash(content);
            this.saveCache.set(cacheKey, {
                hash: contentHash,
                timestamp: Date.now()
            });
            
            // Clean old cache entries (keep last 100)
            if (this.saveCache.size > 100) {
                const entries = Array.from(this.saveCache.entries());
                entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
                this.saveCache.clear();
                entries.slice(0, 100).forEach(([key, value]) => {
                    this.saveCache.set(key, value);
                });
            }
        }
    }

    /**
     * Handle file opened (user might be reviewing debt or pending suggestions)
     * @param {vscode.TextDocument} document - The opened document
     */
    onFileOpened(document) {
        // Delegate to controller - handles validation internally
        this.controller.handleFileOpened(document);
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
        this.controller.flushChanges(document, { source: 'close' });
        
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
            const suggestions = this.controller.getSuggestions();
            const suggestion = suggestions.find(s => s.id === activeReview.suggestionId);
            
            if (suggestion) {
                const reviewDuration = Date.now() - activeReview.reviewStarted;
                // FIXED: Update review time in suggestion (for score calculation)
                // But review state is stored separately (domain separation)
                this.controller.updateSuggestionReviewTime(activeReview.suggestionId, (suggestion.reviewTime || 0) + reviewDuration);
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
        
        // Delegate to controller - returns helper functions for review tracking
        const helpers = this.controller.handleCursorMove(uri, position);
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
                        this.controller.markSuggestionAsReviewed(suggestion.id);
                        // Fix: Trigger status check and updates immediately after marking as reviewed
                        // This prevents UX feeling delayed/stuck until next scheduled status check
                        this.controller.checkSuggestionStatus(suggestion.id);
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
        this.controller.handleScroll(uri);
    }

    /**
     * Track active editor changes
     * FIXED: Flushes classifier for previous document before switching
     * @param {vscode.TextEditor} editor - The active editor
     */
    onEditorChange(editor) {
        // Delegate to controller - handles flushing previous document
        this.controller.handleEditorChange(editor, this.previousActiveDocumentUri);
        
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
        this.controller.flushAllChanges();
        
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
