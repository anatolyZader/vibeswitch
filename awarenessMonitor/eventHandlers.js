/**
 * Event Handlers
 * Handles all VS Code events for awareness monitoring
 * 
 * PRODUCTION-GRADE IMPROVEMENTS:
 * - Event batching: calls classifier once per event (not per change)
 * - Single callback per document: prevents double recording
 * - Version-based duplicate detection (primary key: uri + version)
 * - URI-first approach: uses URI string as canonical identifier (remote-safe)
 * - Separated review state: review tracking separate from suggestion objects
 * - Proper flushes: on document close, editor change, dispose
 * - Mode-configurable classifier thresholds
 */

const vscode = require('vscode');
const { getLogger } = require('../logger');
const { isNonCodeDocument, isSkippableUri, isPositionInRange } = require('./utils');
const LogRateLimiter = require('./logRateLimiter');
const ChangeClassifier = require('./changeClassifier');

class EventHandlers {
    /**
     * @param {Object} agentSuggestionHandler - Agent suggestion handler
     * @param {Object} debtManager - Debt manager
     * @param {Object} sessionTracker - Session tracker
     * @param {Object} activeDocument - Active document reference
     * @param {Object} cursorPosition - Cursor position reference
     * @param {string} mode - Current mode ('vibe', 'dev', 'owner') for classifier config
     */
    constructor(agentSuggestionHandler, debtManager, sessionTracker, activeDocument, cursorPosition, mode = 'dev') {
        this.agentSuggestionHandler = agentSuggestionHandler;
        this.debtManager = debtManager;
        this.sessionTracker = sessionTracker;
        this.activeDocument = activeDocument;
        this.cursorPosition = cursorPosition;
        
        // Log rate limiter (replaces random logging)
        this.logRateLimiter = new LogRateLimiter(5000, 500); // 5 second window, max 500 keys
        
        // Mode-specific classifier config
        const classifierConfig = this._getClassifierConfig(mode);
        
        // Change classifier for debounced AI detection
        this.changeClassifier = new ChangeClassifier(200, classifierConfig); // 200ms debounce
        
        // Track active review suggestion per document (fixes cursor tracking bug)
        // FIXED: Store review state separately from suggestion objects (domain separation)
        this.activeReviewSuggestion = new Map(); // document URI -> { suggestionId, reviewStarted, reviewTime }
        
        // Duplicate detection cache for file saves (primary key: uri + version)
        this.saveCache = new Map(); // `${uri}:${version}` -> { hash: string, timestamp: number }
        
        // Track previous active document for flush on editor change
        this.previousActiveDocumentUri = null;
    }

    /**
     * Get classifier configuration based on mode
     * @private
     */
    _getClassifierConfig(mode) {
        const baseConfig = {
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
            // Marker-only mode: rely solely on @ai marker for 100% accuracy
            // Heuristics are disabled - only @ai marker determines AI-generated code
            markerOnly: true
        };
        
        // VIBE: more permissive (lower thresholds) - but marker-only still applies
        if (mode === 'vibe') {
            return {
                ...baseConfig,
                pureInsertionSize: 15,
                largeInsertionThreshold: 80,
                aiMultiLineSize: 40,
                markerOnly: true
            };
        }
        
        // OWNER: most conservative (higher thresholds) - but marker-only still applies
        if (mode === 'owner') {
            return {
                ...baseConfig,
                pureInsertionSize: 25,
                largeInsertionThreshold: 150,
                aiMultiLineSize: 70,
                scatteredSizeThreshold: 300,
                markerOnly: true
            };
        }
        
        // DEV: default (conservative) - marker-only mode
        return baseConfig;
    }

    /**
     * Detect potential AI-generated code changes
     * FIXED: Calls classifier once per event (not per change), single callback per document
     * @param {vscode.TextDocumentChangeEvent} event - Text document change event
     */
    onTextChange(event) {
        if (event.contentChanges.length === 0) return;
        
        const scheme = event.document.uri.scheme;
        const fileName = event.document.fileName || 'unknown';
        const uri = event.document.uri.toString();

        // Skip non-code documents
        if (isNonCodeDocument(event.document)) {
            return;
        }

        // Rate-limited logging (replaces random logging)
        const logKey = `onTextChange:${uri}`;
        if (this.logRateLimiter.shouldLog(logKey)) {
            getLogger().log(`AwarenessMonitor: Text change detected - scheme: ${scheme}, file: ${fileName}, changes: ${event.contentChanges.length}`);
        }
        
        // Separate deletions (always user) from insertions/replacements
        const deletions = [];
        const otherChanges = [];
        
        for (const change of event.contentChanges) {
            if (change.text.length === 0) {
                // Pure deletion - always user
                deletions.push(change);
            } else {
                otherChanges.push(change);
            }
        }
        
        // Record deletions immediately (no classification needed)
        for (const change of deletions) {
            if (this.agentSuggestionHandler) {
                this.agentSuggestionHandler.recordUserEdit(event.document, change);
            }
        }
        
        // FIXED: Process insertions/replacements through classifier - call once per event
        // Callback is stored once per document in classifier (prevents double recording)
        if (otherChanges.length > 0) {
            // Create event with only non-deletion changes
            const filteredEvent = {
                document: event.document,
                contentChanges: otherChanges
            };
            
            // Store callback once per document (classifier handles this)
            this.changeClassifier.addEvent(
                filteredEvent,
                (document, isAI, aggregatedChanges) => {
                    // Classification callback - called once per debounce window
                    if (isAI) {
                        if (this.logRateLimiter.shouldLog(`aiDetected:${uri}`)) {
                            const totalSize = aggregatedChanges.reduce((sum, c) => sum + c.text.length, 0);
                            getLogger().log(
                                `AwarenessMonitor: ✅ AI-like change detected: size=${totalSize}, changes=${aggregatedChanges.length}, file=${document.fileName}`
                            );
                        }
                        // Record all aggregated changes as AI suggestions (single batch)
                        for (const change of aggregatedChanges) {
                            if (this.agentSuggestionHandler) {
                                this.agentSuggestionHandler.recordAISuggestion(document, change);
                            }
                        }
                    } else {
                        // Record as user edits (single batch)
                        for (const change of aggregatedChanges) {
                            if (this.agentSuggestionHandler) {
                                this.agentSuggestionHandler.recordUserEdit(document, change);
                            }
                        }
                    }
                }
            );
        }
    }

    /**
     * Handle file creation (AI creating new files)
     * FIXED: Uses isSkippableUri for URI-only checks
     * @param {vscode.FileCreateEvent} event - File create event
     */
    onFilesCreated(event) {
        const logKey = 'onFilesCreated';
        if (this.logRateLimiter.shouldLog(logKey)) {
            getLogger().log(`AwarenessMonitor: onFilesCreated called with ${event.files.length} files`);
        }
        
        for (const fileUri of event.files) {
            // FIXED: Use isSkippableUri for URI-only checks
            if (isSkippableUri(fileUri)) {
                continue;
            }
            
            if (this.logRateLimiter.shouldLog(`fileCreated:${fileUri.toString()}`)) {
                getLogger().log(`AwarenessMonitor: Processing file creation - ${fileUri.toString()}`);
            }
            
            // Process file as suggestion
            // FIXED: Pass URI directly, not fsPath (works with remote schemes)
            if (this.agentSuggestionHandler) {
                this.agentSuggestionHandler.processFileAsSuggestion(fileUri, {
                    isFileCreation: true,
                    filePath: null // Let processFileAsSuggestion handle path extraction from URI
                }).then(suggestion => {
                    if (suggestion) {
                        if (this.logRateLimiter.shouldLog(`fileCreatedSuccess:${fileUri.toString()}`)) {
                            getLogger().log(`AwarenessMonitor: Detected AI file creation - ${suggestion.size} chars`);
                        }
                    }
                }).catch(err => {
                    getLogger().log(`AwarenessMonitor: Error reading created file: ${err.message}`, true);
                });
            }
        }
    }

    /**
     * Handle file saves (entire file writes by AI)
     * FIXED: Uses URI string as canonical identifier (remote-safe)
     * @param {vscode.TextDocument} document - The saved document
     */
    onFileSaved(document) {
        if (isNonCodeDocument(document)) {
            return;
        }
        
        const content = document.getText();
        const uri = document.uri.toString(); // FIXED: Use URI string as canonical identifier
        
        // Lowered threshold to catch more AI file operations
        if (content.length > 200) {
            // Improved duplicate detection: primary key is uri + version (fast, deterministic)
            const cacheKey = `${uri}:${document.version}`;
            const cached = this.saveCache.get(cacheKey);
            
            // If we already processed this exact version, skip
            if (cached) {
                return; // Already processed
            }
            
            // Check if we already tracked this file recently
            const recentSuggestion = this.agentSuggestionHandler ? 
                this.agentSuggestionHandler.getSuggestions().find(s => 
                    s.document === uri && 
                    s.size === content.length
                ) : null;
            
            if (!recentSuggestion && this.agentSuggestionHandler) {
                if (this.logRateLimiter.shouldLog(`fileSaved:${uri}`)) {
                    getLogger().log(`AwarenessMonitor: Large file saved - ${content.length} chars in ${document.fileName}`);
                }
                
                // Fixed: Range math bug - lineCount is 1-based count, but line indices are 0-based
                const lastLine = Math.max(0, document.lineCount - 1);
                const lastLineText = document.lineAt(lastLine).text;
                const lastChar = lastLineText.length;
                
                const suggestion = this.agentSuggestionHandler.createSuggestionObject({
                    document: uri, // FIXED: Use URI string
                    range: new vscode.Range(0, 0, lastLine, lastChar),
                    text: content,
                    size: content.length,
                    isFileWrite: true
                });
                
                // FIXED: Use URI string, derive fsPath only when needed (for display/debt keys)
                // Debt system should use URI as key, but we pass fsPath for backward compatibility
                const filePath = document.uri.fsPath || uri; // Fallback to URI if fsPath unavailable
                this.agentSuggestionHandler.addSuggestionAndTrack(suggestion, filePath, content.length);
                
                // Update cache (primary key: version)
                this.saveCache.set(cacheKey, {
                    hash: this._simpleHash(content),
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
    }

    /**
     * Simple hash function for content deduplication
     * @private
     */
    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }

    /**
     * Handle file opened (user might be reviewing debt or pending suggestions)
     * @param {vscode.TextDocument} document - The opened document
     */
    onFileOpened(document) {
        if (isNonCodeDocument(document)) {
            return;
        }
        
        const filePath = document.uri.fsPath;
        const hasUnreviewedDebt = this.debtManager && this.debtManager.hasUnreviewedDebt(filePath);
        
        // Check if file has unreviewed debt or pending suggestions
        const hasPendingSuggestions = this.agentSuggestionHandler ? 
            this.agentSuggestionHandler.hasPendingSuggestions(document.uri.toString()) : false;
        
        if (hasUnreviewedDebt || hasPendingSuggestions) {
            // Initialize review session tracking
            if (this.sessionTracker) {
                this.sessionTracker.initializeSession(filePath);
            }
        }
    }

    /**
     * Handle document close (flush classifier, close reviews)
     * FIXED: Properly flushes classifier for closed document
     * @param {vscode.TextDocument} document - The closed document
     */
    onDocumentClose(document) {
        if (!document) return;
        
        const uri = document.uri.toString();
        
        // Flush classifier for this document (prevent memory leaks)
        this.changeClassifier.flush(document, null);
        
        // Close any active review for this document
        this._closeActiveReview(uri);
    }

    /**
     * Close active review for a document
     * FIXED: Updates review time in separate state, not suggestion object
     * @private
     */
    _closeActiveReview(uri) {
        const activeReview = this.activeReviewSuggestion.get(uri);
        if (!activeReview) return;
        
        if (this.agentSuggestionHandler && activeReview.reviewStarted) {
            const suggestions = this.agentSuggestionHandler.getSuggestions();
            const suggestion = suggestions.find(s => s.id === activeReview.suggestionId);
            
            if (suggestion) {
                const reviewDuration = Date.now() - activeReview.reviewStarted;
                // FIXED: Update review time in suggestion (for score calculation)
                // But review state is stored separately (domain separation)
                suggestion.reviewTime = (suggestion.reviewTime || 0) + reviewDuration;
                suggestion.reviewed = true; // Mark as reviewed
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
        const filePath = editor.document.uri.fsPath;
        const uri = editor.document.uri.toString();
        
        // Update cursor position reference
        if (this.cursorPosition) {
            this.cursorPosition.value = position;
        }
        
        // Update review tracking if this file has debt
        if (this.sessionTracker) {
            this.sessionTracker.updateCursorActivity(filePath);
        }
        
        // FIXED: Only track one suggestion at a time per document
        if (this.agentSuggestionHandler) {
            const pendingSuggestions = this.agentSuggestionHandler.getSuggestionsByStatus('pending');
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
                    
                    // FIXED: Store review state separately (domain separation)
                    this.activeReviewSuggestion.set(uri, {
                        suggestionId: suggestion.id,
                        reviewStarted: Date.now(),
                        reviewTime: 0 // Track separately
                    });
                    suggestion.reviewed = true; // Mark as reviewed
                    return; // Only track one suggestion at a time
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
        if (this.sessionTracker) {
            this.sessionTracker.updateScrollActivity(filePath);
        }
    }

    /**
     * Track active editor changes
     * FIXED: Flushes classifier for previous document before switching
     * @param {vscode.TextEditor} editor - The active editor
     */
    onEditorChange(editor) {
        // FIXED: Flush classifier for previous document (prevent memory leaks)
        if (this.previousActiveDocumentUri) {
            // Try to get document from workspace
            const previousDoc = vscode.workspace.textDocuments.find(
                d => d.uri.toString() === this.previousActiveDocumentUri
            );
            if (previousDoc) {
                this.changeClassifier.flush(previousDoc, null);
            }
        }
        
        // Update active document reference
        if (this.activeDocument) {
            this.activeDocument.value = editor?.document;
        }
        
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
        // FIXED: Flush all pending classifier changes with callbacks before clearing
        this.changeClassifier.flushAll((document, isAI, changes) => {
            // Process any remaining pending changes
            if (isAI) {
                for (const change of changes) {
                    if (this.agentSuggestionHandler) {
                        this.agentSuggestionHandler.recordAISuggestion(document, change);
                    }
                }
            } else {
                for (const change of changes) {
                    if (this.agentSuggestionHandler) {
                        this.agentSuggestionHandler.recordUserEdit(document, change);
                    }
                }
            }
        });
        
        // Close all active reviews
        for (const uri of this.activeReviewSuggestion.keys()) {
            this._closeActiveReview(uri);
        }
        this.activeReviewSuggestion.clear();
        
        // Clear caches
        this.logRateLimiter.clear();
        this.saveCache.clear();
    }
}

module.exports = EventHandlers;
