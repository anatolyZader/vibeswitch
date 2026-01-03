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
     * @param {string} mode - Current mode ('vibe', 'dev') for classifier config
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
        // Fix: Track dwell timers to require minimum review time before marking as reviewed
        this.activeReviewSuggestion = new Map(); // document URI -> { suggestionId, reviewStarted, reviewTime, dwellTimer }
        
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
            // Rapid scattered changes: AI agents often make many scattered edits quickly
            rapidScatteredTimeWindow: 1000, // 1 second window
            rapidScatteredEventCount: 8, // Minimum events in window (renamed from ChangeCount for clarity)
            rapidScatteredRangeCount: 6, // Minimum distinct line ranges
            rapidScatteredMinSize: 50, // Minimum total size
            rapidBurstChangeCount: 10, // Minimum changes for rapid burst branch (separate from event count)
            // Behavioral inference mode: use heuristics as primary, markers as strong signal when present
            // This is the reliable method since markers cannot be guaranteed to survive edit pipeline
            markerOnly: false
        };
        
        // VIBE: more permissive (lower thresholds) - behavioral inference enabled
        if (mode === 'vibe') {
            return {
                ...baseConfig,
                pureInsertionSize: 15,
                largeInsertionThreshold: 80,
                aiMultiLineSize: 40,
                rapidScatteredEventCount: 6, // Lower threshold for vibe mode (renamed from ChangeCount)
                rapidScatteredRangeCount: 5,
                rapidScatteredMinSize: 40,
                rapidBurstChangeCount: 8, // Lower threshold for vibe mode
                markerOnly: false
            };
        }
        
        // DEV: default (conservative) - behavioral inference enabled
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
        
        // FIXED: Process ALL changes through classifier (including deletions)
        // Agents absolutely delete code (refactors, "remove unused imports", etc.)
        // Deletions are not always user - they need classification too
        // Process all changes through classifier - call once per event
        // Callback is stored once per document in classifier (prevents double recording)
        if (event.contentChanges.length > 0) {
            // Store callback once per document (classifier handles this)
            this.changeClassifier.addEvent(
                event,
                (document, classification, aggregatedChanges) => {
                    // Classification callback - called once per debounce window
                    // DESIGN IMPROVEMENT: classification is now rich object with label, confidence, reasons
                    const isAI = classification.label === 'ai';
                    const isFormatter = classification.label === 'formatter';
                    
                    if (isAI) {
                        if (this.logRateLimiter.shouldLog(`aiDetected:${uri}`)) {
                            const totalSize = aggregatedChanges.reduce((sum, c) => sum + c.text.length, 0);
                            const reasonsStr = classification.reasons.join('; ');
                            getLogger().log(
                                `AwarenessMonitor: ✅ AI change detected (confidence=${(classification.confidence * 100).toFixed(0)}%): size=${totalSize}, changes=${aggregatedChanges.length}, reasons=[${reasonsStr}], file=${document.fileName}`
                            );
                        }
                        // Fix: Record as single batch suggestion (not per-change)
                        // This prevents dozens of "pending suggestions" from a single AI refactor
                        if (this.agentSuggestionHandler) {
                            this.agentSuggestionHandler.recordAISuggestionBatch(document, aggregatedChanges);
                        }
                        return;
                    } else if (isFormatter) {
                        // Fix: Formatters should not mark AI suggestions as adapted
                        // Treat formatter detection as "neutral" - don't call recordUserEdit
                        // This prevents auto-formatters from accidentally marking AI suggestions as adapted
                        if (this.logRateLimiter.shouldLog(`formatterDetected:${uri}`)) {
                            getLogger().log(
                                `AwarenessMonitor: 🔧 Formatter detected: ${classification.reasons.join('; ')}`
                            );
                        }
                        // Don't record formatter edits - they're not user edits and shouldn't affect suggestion status
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
            
            // Fix: Remove size-based scan - rely only on saveCache (uri+version)
            // Size-based scan is O(n) and can skip legit distinct suggestions with same size
            if (this.agentSuggestionHandler) {
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
                
                // FIXED: Use URI as canonical identifier (works with remote workspaces)
                this.agentSuggestionHandler.addSuggestionAndTrack(suggestion, content.length);
                
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
        
        // FIXED: Use URI as canonical identifier (works with remote workspaces)
        const uri = document.uri.toString();
        const hasUnreviewedDebt = this.debtManager && this.debtManager.hasUnreviewedDebt(uri);
        
        // Check if file has unreviewed debt or pending suggestions
        const hasPendingSuggestions = this.agentSuggestionHandler ? 
            this.agentSuggestionHandler.hasPendingSuggestions(uri) : false;
        
        if (hasUnreviewedDebt || hasPendingSuggestions) {
            // Initialize review session tracking
            if (this.sessionTracker) {
                this.sessionTracker.initializeSession(uri);
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
        
        // Fix: Silent flush on document close (cleanup without recording)
        // This prevents emission during cleanup when document is closing
        this.changeClassifier.flush(document, { emit: false });
        
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
        
        // Fix: Clear dwell timer if it exists
        if (activeReview.dwellTimer) {
            clearTimeout(activeReview.dwellTimer);
        }
        
        if (this.agentSuggestionHandler && activeReview.reviewStarted) {
            const suggestions = this.agentSuggestionHandler.getSuggestions();
            const suggestion = suggestions.find(s => s.id === activeReview.suggestionId);
            
            if (suggestion) {
                const reviewDuration = Date.now() - activeReview.reviewStarted;
                // FIXED: Update review time in suggestion (for score calculation)
                // But review state is stored separately (domain separation)
                suggestion.reviewTime = (suggestion.reviewTime || 0) + reviewDuration;
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
        // FIXED: Use URI as canonical identifier (works with remote workspaces)
        const uri = editor.document.uri.toString();
        
        // Update cursor position reference
        if (this.cursorPosition) {
            this.cursorPosition.value = position;
        }
        
        // Update review tracking if this file has debt
        if (this.sessionTracker) {
            this.sessionTracker.updateCursorActivity(uri);
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
                    
                    // Fix: Require dwell time (1000ms) before marking as reviewed
                    // This avoids marking accidental cursor touches as "reviewed"
                    const reviewStarted = Date.now();
                    const dwellTimer = setTimeout(() => {
                        // Only mark as reviewed after dwell time
                        const currentReview = this.activeReviewSuggestion.get(uri);
                        if (currentReview && currentReview.suggestionId === suggestion.id) {
                            suggestion.reviewed = true;
                            // Fix: Trigger status check and updates immediately after marking as reviewed
                            // This prevents UX feeling delayed/stuck until next scheduled status check
                            if (this.agentSuggestionHandler) {
                                this.agentSuggestionHandler.checkSuggestionStatus(suggestion.id);
                                if (this.agentSuggestionHandler.updateFileColorsInExplorer) {
                                    this.agentSuggestionHandler.updateFileColorsInExplorer();
                                }
                                if (this.agentSuggestionHandler.updateScore) {
                                    this.agentSuggestionHandler.updateScore();
                                }
                            }
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
        if (this.sessionTracker) {
            this.sessionTracker.updateScrollActivity(uri);
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
        this.changeClassifier.flushAll((document, classification, changes) => {
            // Process any remaining pending changes
            const isAI = classification.label === 'ai';
            const isFormatter = classification.label === 'formatter';
            
            // Fix: Use batch recording for AI to avoid per-change explosion during disposal
            // Fix: Mirror runtime behavior - formatters are neutral and don't mark adaptations
            if (isAI) {
                if (this.agentSuggestionHandler) {
                    this.agentSuggestionHandler.recordAISuggestionBatch(document, changes);
                }
            } else if (isFormatter) {
                // Formatters are neutral - do nothing (don't record as user edits)
                // This prevents formatters from marking AI suggestions as adapted during disposal
            } else {
                // Only record actual user edits
                for (const change of changes) {
                    if (this.agentSuggestionHandler) {
                        this.agentSuggestionHandler.recordUserEdit(document, change);
                    }
                }
            }
        });
        
        // Close all active reviews (cleans up dwell timers)
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
