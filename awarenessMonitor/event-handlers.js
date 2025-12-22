/**
 * Event Handlers
 * Handles all VS Code events for awareness monitoring
 */

const vscode = require('vscode');
const { getLogger } = require('../logger');
const { isNonCodeDocument, isPositionInRange } = require('./utils');

class EventHandlers {
    constructor(suggestionTracker, reviewDebtManager, reviewSessionTracker, activeDocument, cursorPosition) {
        this.suggestionTracker = suggestionTracker;
        this.reviewDebtManager = reviewDebtManager;
        this.reviewSessionTracker = reviewSessionTracker;
        this.activeDocument = activeDocument;
        this.cursorPosition = cursorPosition;
    }

    /**
     * Detect potential AI-generated code changes
     * @param {vscode.TextDocumentChangeEvent} event - Text document change event
     */
    onTextChange(event) {
        if (event.contentChanges.length === 0) return;
        
        const scheme = event.document.uri.scheme;
        const fileName = event.document.fileName || 'unknown';

        // Skip *only* non-code documents (output, debug, etc.)
        // Silent skip - no logging to avoid feedback loop with output channels
        if (isNonCodeDocument(scheme)) {
            return;
        }

        // For everything else (file, vscode-remote, cursor-remote, etc.) → track
        // Throttled: only log occasionally to avoid spam
        if (Math.random() < 0.1) { // 10% chance
            getLogger().log(`AwarenessMonitor: ✅ Text change detected - scheme: ${scheme}, file: ${fileName}, changes: ${event.contentChanges.length}`);
        }
        
        // Analyze each change
        for (const change of event.contentChanges) {
            const changeSize = change.text.length;
            const isMultiLine = change.text.includes('\n');
            const isInsertion = change.rangeLength === 0;
            // Removed preview logging - too verbose

            // Ignore pure deletions (no inserted text)
            if (changeSize === 0) {
                if (this.suggestionTracker) {
                    this.suggestionTracker.recordUserEdit(event.document, change);
                }
                continue;
            }

            // MUCH MORE PERMISSIVE: Cursor applies AI edits as many small single-line edits
            // - Any multi-line insert (regardless of size)
            // - Any insertion of length >= 5 chars
            // This catches Cursor's typical 5-12 char single-line AI edits
            const isLikelyAI = 
                isMultiLine ||
                (isInsertion && changeSize >= 5);
            
            if (isLikelyAI) {
                // Only log AI detections occasionally (throttled)
                getLogger().log(
                    `AwarenessMonitor: ✅ AI-like change detected: size=${changeSize}, multiLine=${isMultiLine}, file=${event.document.fileName}`
                );
                if (this.suggestionTracker) {
                    this.suggestionTracker.recordAISuggestion(event.document, change);
                }
            } else {
                // User edits - only log occasionally (throttled)
                // Removed verbose logging
                if (this.suggestionTracker) {
                    this.suggestionTracker.recordUserEdit(event.document, change);
                }
            }
        }
    }

    /**
     * Handle file creation (AI creating new files)
     * @param {vscode.FileCreateEvent} event - File create event
     */
    onFilesCreated(event) {
        getLogger().log(`AwarenessMonitor: onFilesCreated called with ${event.files.length} files`);
        for (const file of event.files) {
            const scheme = file.scheme;
            getLogger().log(`AwarenessMonitor: File created event - scheme: ${scheme}, path: ${file.fsPath}`);
            // Silent skip for non-code documents
            if (isNonCodeDocument(scheme)) {
                continue;
            }
            
            getLogger().log(`AwarenessMonitor: Processing file creation - ${file.fsPath}`);
            
            // Process file as suggestion
            if (this.suggestionTracker) {
                this.suggestionTracker.processFileAsSuggestion(file, {
                    isFileCreation: true,
                    filePath: file.fsPath
                }).then(suggestion => {
                    if (suggestion) {
                        getLogger().log(`AwarenessMonitor: Detected AI file creation - ${suggestion.size} chars`);
                    }
                }).catch(err => {
                    console.error('AwarenessMonitor: Error reading created file', err);
                    getLogger().log(`AwarenessMonitor: Error reading created file: ${err.message}`);
                });
            }
        }
    }

    /**
     * Handle file saves (entire file writes by AI)
     * @param {vscode.TextDocument} document - The saved document
     */
    onFileSaved(document) {
        const scheme = document.uri.scheme;
        if (isNonCodeDocument(scheme)) {
            return;
        }
        
        const content = document.getText();
        
        // Lowered threshold to catch more AI file operations
        if (content.length > 200) {  // was 500
            getLogger().log(`AwarenessMonitor: Large file saved - ${content.length} chars in ${document.fileName}`);
            
            // Check if we already tracked this file recently (avoid duplicates)
            const suggestions = this.suggestionTracker ? this.suggestionTracker.getSuggestions() : [];
            const recentSuggestion = suggestions.find(s => 
                s.document === document.uri.toString() && 
                (Date.now() - s.timestamp) < 3000 // Within last 3 seconds
            );
            
            if (!recentSuggestion && this.suggestionTracker) {
                getLogger().log('AwarenessMonitor: Detected AI file write');
                
                const suggestion = this.suggestionTracker.createSuggestionObject({
                    document: document.uri.toString(),
                    range: new vscode.Range(0, 0, document.lineCount, 0),
                    text: content,
                    size: content.length,
                    isFileWrite: true
                });
                
                this.suggestionTracker.addSuggestionAndTrack(suggestion, document.uri.fsPath, content.length);
            }
        }
    }

    /**
     * Handle file opened (user might be reviewing debt or pending suggestions)
     * @param {vscode.TextDocument} document - The opened document
     */
    onFileOpened(document) {
        const scheme = document.uri.scheme;
        if (isNonCodeDocument(scheme)) {
            return;
        }
        
        const filePath = document.uri.fsPath;
        const hasUnreviewedDebt = this.reviewDebtManager && this.reviewDebtManager.hasUnreviewedDebt(filePath);
        
        // Check if file has unreviewed debt or pending suggestions
        const hasPendingSuggestions = this.suggestionTracker ? 
            this.suggestionTracker.hasPendingSuggestions(document.uri.toString()) : false;
        
        if (hasUnreviewedDebt || hasPendingSuggestions) {
            // Initialize review session tracking
            if (this.reviewSessionTracker) {
                this.reviewSessionTracker.initializeReviewSession(filePath);
            }
        }
    }

    /**
     * Track cursor activity in files being reviewed
     * @param {vscode.TextEditorSelectionChangeEvent} event - Cursor move event
     */
    onCursorMove(event) {
        if (!event.textEditor || !event.selections.length) return;
        
        const editor = event.textEditor;
        const position = event.selections[0].active;
        const filePath = editor.document.uri.fsPath;
        
        // Update cursor position reference
        if (this.cursorPosition) {
            this.cursorPosition.value = position;
        }
        
        // Update review tracking if this file has debt
        if (this.reviewSessionTracker) {
            this.reviewSessionTracker.updateCursorActivity(filePath);
        }
        
        // Check if cursor is on any AI suggestion (original logic)
        if (this.suggestionTracker) {
            const pendingSuggestions = this.suggestionTracker.getSuggestionsByStatus('pending');
            for (const suggestion of pendingSuggestions) {
                if (suggestion.document !== editor.document.uri.toString()) continue;
                
                // Check if cursor is within suggestion range
                if (isPositionInRange(position, suggestion.range)) {
                    if (!suggestion.reviewed) {
                        suggestion.reviewed = true;
                        suggestion.reviewStarted = Date.now();
                    }
                    return; // Only track one suggestion at a time
                } else {
                    // Cursor left the suggestion
                    if (suggestion.reviewStarted) {
                        const reviewDuration = Date.now() - suggestion.reviewStarted;
                        suggestion.reviewTime += reviewDuration;
                        suggestion.reviewStarted = null;
                    }
                }
            }
        }
    }

    /**
     * Track scroll activity in files being reviewed
     * @param {vscode.TextEditorVisibleRangesChangeEvent} event - Scroll event
     */
    onScroll(event) {
        if (!event.textEditor) return;
        
        const filePath = event.textEditor.document.uri.fsPath;
        
        // Update review tracking if this file has debt
        if (this.reviewSessionTracker) {
            this.reviewSessionTracker.updateScrollActivity(filePath);
        }
    }

    /**
     * Track active editor changes
     * @param {vscode.TextEditor} editor - The active editor
     */
    onEditorChange(editor) {
        // Update active document reference
        if (this.activeDocument) {
            this.activeDocument.value = editor?.document;
        }
        
        // Track as file opened if it has debt
        if (editor?.document) {
            this.onFileOpened(editor.document);
        }
        
        // Stop any active reviews when switching files
        if (this.suggestionTracker) {
            const suggestions = this.suggestionTracker.getSuggestions();
            for (const suggestion of suggestions) {
                if (suggestion.reviewStarted) {
                    suggestion.reviewTime += Date.now() - suggestion.reviewStarted;
                    suggestion.reviewStarted = null;
                }
            }
        }
    }
}

module.exports = EventHandlers;

