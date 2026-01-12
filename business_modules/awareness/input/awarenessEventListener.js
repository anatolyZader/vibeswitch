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
        
        // Duplicate detection cache for file saves (primary key: uri + version)
        // This is input-layer state for preventing duplicate save events
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
        
        // Delegate review tracking cleanup to controller/service
        this.controller.handleDocumentClose(uri);
    }

    /**
     * Track cursor activity in files being reviewed
     * FIXED: Delegates all review tracking to ReviewTrackingService (app layer)
     * Input layer no longer mutates domain objects or manages timers
     * @param {vscode.TextEditorSelectionChangeEvent} event - Cursor move event
     */
    onCursorMove(event) {
        if (!event.textEditor || !event.selections.length) return;
        
        const editor = event.textEditor;
        const position = event.selections[0].active;
        const uri = editor.document.uri.toString();
        
        // Delegate to controller - handles all review tracking logic
        this.controller.handleCursorMove(uri, position);
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
        // Delegate to controller - handles flushing previous document and review tracking cleanup
        this.controller.handleEditorChange(editor, this.previousActiveDocumentUri);
        
        // Store current document URI for next flush
        this.previousActiveDocumentUri = editor?.document?.uri.toString() || null;
        
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
        
        // Review tracking cleanup is handled by ReviewTrackingService.dispose() in AwarenessService.stop()
        
        // Clear caches
        this.saveCache.clear();
    }
}

module.exports = AwarenessEventListener;
