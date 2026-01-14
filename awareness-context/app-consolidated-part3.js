/**
 * APP LAYER - CONSOLIDATED (PART 3/3)
 * 
 * This file contains part 3 of 3 of the app layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 5/14
 * Generated: 2026-01-14T18:13:49.752Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 10/14: app/suggestionService.js
// ============================================================================

(function() { // IIFE scope for app/suggestionService.js
/**
 * SuggestionService - Application service for AI suggestion lifecycle management
 * 
 * Handles the complete lifecycle of AI-generated code suggestions:
 * - Detection and recording of AI suggestions
 * - User interaction tracking (edits, adaptations)
 * - Status determination (accepted/rejected/adapted)
 * - Pattern detection (keep all)
 */

// Import domain aggregates
// const SuggestionAggregate = require('../domain/aggregates/suggestionAggregate'); // Commented for consolidation

// Import domain entities
// const Change = require('../domain/entities/change'); // Commented for consolidation

// Import domain utilities
// const { rangesOverlap } = require('./vscodeDocUtilities'); // Commented for consolidation

// Import domain events
// const AISuggestionOutcomeEvent = require('../domain/events/aiSuggestionOutcomeEvent'); // Commented for consolidation
// const KeepAllEvent = require('../domain/events/keepAllEvent'); // Commented for consolidation

// Import utilities
// const safe = require('../../../../helpers/safe'); // Commented for consolidation
// const SuggestionStatusScheduler = require('./suggestionStatusScheduler'); // Commented for consolidation

class SuggestionService {
    /**
     * @param {SuggestionAggregate} suggestionAggregate - Suggestion aggregate (required)
     * @param {DebtService} debtService - Debt service (required)
     * @param {IAwarenessVSCodePort} vscodeAdapter - VS Code adapter (required)
     * @param {ILoggerPort} loggerAdapter - Logger adapter (optional)
     * @param {IAwarenessMessagingPort} messagingAdapter - Messaging adapter (optional)
     * @param {Object} rangeOperationServiceD - Range operation service (required for review tracking)
     * @param {Object} timerRegistry - Timer registry (required - all timers must go through it)
     * @param {Function} updateScore - Score update callback (optional)
     * @param {Function} updateFileColorsInExplorer - File colors update callback (optional)
     * @param {Function} onAISuggestion - AI suggestion callback (optional)
     * @param {Function} onAISuggestionOutcome - AI suggestion outcome callback (optional)
     * @param {Function} onKeepAll - Keep all callback (optional)
     * @param {Function} isActive - Function to check if service is active (required)
     * @param {string} instanceId - Instance ID for generation-based timer cancellation (required)
     */
    constructor({
        suggestionAggregate,
        debtService,
        vscodeAdapter,
        loggerAdapter = null,
        messagingAdapter = null,
        rangeOperationServiceD,
        timerRegistry,
        updateScore = null,
        updateFileColorsInExplorer = null,
        onAISuggestion = null,
        onAISuggestionOutcome = null,
        onKeepAll = null,
        isActive,
        instanceId
    }) {
        if (!suggestionAggregate) {
            throw new Error('SuggestionService requires suggestionAggregate');
        }
        if (!debtService) {
            throw new Error('SuggestionService requires debtService');
        }
        if (!vscodeAdapter) {
            throw new Error('SuggestionService requires vscodeAdapter');
        }
        if (!rangeOperationServiceD) {
            throw new Error('SuggestionService requires rangeOperationServiceD');
        }
        if (!timerRegistry) {
            throw new Error('SuggestionService requires timerRegistry');
        }
        if (!isActive || typeof isActive !== 'function') {
            throw new Error('SuggestionService requires isActive function');
        }
        if (!instanceId) {
            throw new Error('SuggestionService requires instanceId for timer cancellation');
        }

        this.suggestionAggregate = suggestionAggregate;
        this.debtService = debtService;
        this.vscodeAdapter = vscodeAdapter;
        this.loggerAdapter = loggerAdapter;
        this.messagingAdapter = messagingAdapter;
        this.rangeOperationServiceD = rangeOperationServiceD;
        this.timerRegistry = timerRegistry;
        this.updateScore = updateScore;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.onAISuggestion = onAISuggestion;
        this.onAISuggestionOutcome = onAISuggestionOutcome;
        this.onKeepAll = onKeepAll;
        this.isActive = isActive;
        this.instanceId = instanceId; // Store instance ID for generation-based cancellation
        
        // Create status scheduler (coalesces timers per suggestion ID)
        this.statusScheduler = new SuggestionStatusScheduler(
            this.timerRegistry,
            this.isActive,
            this.instanceId
        );
        
        // Keep-all detection state (merged from KeepAllDetectorService)
        this.recentAcceptances = [];
        this.keepAllDetectionWindow = 2000; // 2 seconds
        this.keepAllThreshold = 3; // Minimum acceptances to trigger
        
        // Review tracking state (merged from ReviewTrackingService)
        this.activeReviews = new Map(); // URI -> { suggestionId, reviewStarted, reviewTime, dwellTimer }
        this.DWELL_TIME_MS = 1000; // Dwell time threshold
    }

    /**
     * Record a detected AI suggestion
     * @param {vscode.TextDocument} document - The document
     * @param {Change|vscode.TextDocumentContentChangeEvent} change - The change (Change entity or raw change)
     */
    recordAISuggestion(document, change) {
        if (!this.suggestionAggregate) return;

        const uri = document.uri.toString();
        // Support both Change entities and raw changes for backward compatibility
        const changeSize = change instanceof Change ? change.size : change.text.length;
        const changeRange = change instanceof Change ? change.range : change.range;
        const changeText = change instanceof Change ? change.text : change.text;

        // Derive fileName from URI for display purposes only
        const fileName = uri.split('/').pop().split('?')[0];
        if (this.loggerAdapter) {
            this.loggerAdapter.debug(`[DEBUG] 📝 AI suggestion: ${changeSize} chars in ${fileName}`);
        }

        // Extract classification metadata if available
        const classificationMeta = change instanceof Change && change.classification ? {
            classificationLabel: change.classification.label,
            classificationConfidence: change.classification.confidence,
            classificationReasons: change.classification.reasons
        } : {};

        // Create suggestion entity
        const suggestion = this.suggestionAggregate.createSuggestion({
            document: uri,
            range: changeRange,
            text: changeText,
            size: changeSize,
            ...classificationMeta
        });

        // Add to aggregate and track
        this._addSuggestionAndTrack(suggestion, changeSize);

        // Call optional callback (e.g., for UsageStats)
        if (this.onAISuggestion) {
            this.onAISuggestion({
                filePath: uri,
                size: suggestion.size,
                timestamp: suggestion.timestamp,
                isFileCreation: false
            });
        }
    }

    /**
     * Record a batch of AI changes as a single suggestion
     * @param {vscode.TextDocument} document - The document
     * @param {Array<Change>} changes - Batch of Change domain entities
     * @param {Object} meta - Optional metadata
     */
    recordAISuggestionBatch(document, changes, meta = {}) {
        if (!this.suggestionAggregate || !changes || changes.length === 0) {
            return;
        }

        const uri = document.uri.toString();

        // Calculate merged range (union of all change ranges)
        const start = changes.reduce((min, c) =>
            c.range.start.isBefore(min) ? c.range.start : min,
            changes[0].range.start
        );
        const end = changes.reduce((max, c) =>
            c.range.end.isAfter(max) ? c.range.end : max,
            changes[0].range.end
        );
        const Range = this.vscodeAdapter.Range;
        const mergedRange = new Range(start, end);

        // Cap merged range span for debt sizing if huge but inserted tiny
        const lineSpan = end.line - start.line;
        const totalInserted = changes.reduce((sum, c) => sum + (c.size || 0), 0);
        const avgInsertedPerLine = lineSpan > 0 ? totalInserted / lineSpan : totalInserted;

        let effectiveRange = mergedRange;
        if (lineSpan > 100 && avgInsertedPerLine < 5) {
            const firstChange = changes[0];
            const windowSize = Math.min(50, lineSpan);
            const Position = this.vscodeAdapter.Position;
            const cappedEnd = new Position(
                Math.min(firstChange.range.start.line + windowSize, end.line),
                end.character
            );
            effectiveRange = new Range(firstChange.range.start, cappedEnd);
        }

        // Get merged text from document
        const mergedText = document.getText(effectiveRange);
        const mergedSize = mergedText.length;

        const fileName = uri.split('/').pop().split('?')[0];
        if (this.loggerAdapter) {
            this.loggerAdapter.debug(`[DEBUG] 📝 AI suggestion batch: ${changes.length} changes, ${mergedSize} chars in ${fileName}`);
        }

        // Extract classification metadata from first change (all changes in batch have same classification)
        const classificationMeta = changes[0]?.classification ? {
            classificationLabel: changes[0].classification.label,
            classificationConfidence: changes[0].classification.confidence,
            classificationReasons: changes[0].classification.reasons
        } : {};

        // Create suggestion entity with classification metadata
        const suggestion = this.suggestionAggregate.createSuggestion({
            document: uri,
            range: mergedRange,
            text: mergedText,
            size: mergedSize,
            ...classificationMeta,
            ...meta
        });

        // Add suggestion to batch (aggregate sets batchId on entity)
        const batchId = this.suggestionAggregate.addSuggestionToBatch(uri, suggestion.id, mergedSize);

        // Check if this is a new batch (first suggestion) for event publishing
        const batch = this.suggestionAggregate.getBatch(batchId);
        const isNewBatch = batch && batch.suggestionIds.length === 1;

        // Add to aggregate and track
        this._addSuggestionAndTrack(suggestion, mergedSize);

        // Publish batch created event if this is a new batch
        if (isNewBatch && this.messagingAdapter) {
            // const SuggestionBatchCreatedEvent = require('../domain/events/suggestionBatchCreatedEvent'); // Commented for consolidation
            safe('publishSuggestionBatchCreatedEvent', async () => {
                const batchEvent = new SuggestionBatchCreatedEvent({
                    batchId: batch.batchId,
                    filePath: batch.filePath.toString(),
                    suggestionCount: batch.suggestionIds.length,
                    totalSize: batch.totalSize
                });
                await this.messagingAdapter.publishSuggestionBatchCreatedEvent(batchEvent);
            });
        }

        // Call optional callback (e.g., for UsageStats)
        if (this.onAISuggestion) {
            this.onAISuggestion({
                filePath: uri,
                size: mergedSize,
                timestamp: suggestion.timestamp,
                isFileCreation: false,
                batchId: batchId,
                isNewBatch: isNewBatch
            });
        }
    }

    /**
     * Process a file as an AI-generated suggestion
     * @param {vscode.Uri} fileUri - URI of the file
     * @param {Object} options - Processing options
     * @returns {Promise<Object|null>} Suggestion entity or null
     */
    async processFileAsSuggestion(fileUri, options = {}) {
        if (!this.suggestionAggregate) return null;

        const {
            isFileCreation = false,
            isExternalCreation = false,
            isFileWrite = false
        } = options;

        try {
            const openDoc = (uri) => this.vscodeAdapter.openTextDocument(uri);
            const doc = await openDoc(fileUri);
            const content = doc.getText();

            if (content.trim().length > 0) {
                const lastLine = Math.max(0, doc.lineCount - 1);
                const lastLineText = doc.lineAt(lastLine).text;
                const lastChar = lastLineText.length;

                const Range = this.vscodeAdapter.Range;
                const suggestion = this.suggestionAggregate.createSuggestion({
                    document: doc.uri.toString(),
                    range: new Range(0, 0, lastLine, lastChar),
                    text: content,
                    size: content.length,
                    isFileCreation,
                    isExternalCreation,
                    isFileWrite
                });

                this._addSuggestionAndTrack(suggestion, content.length);

                return suggestion;
            }
        } catch (err) {
            if (this.loggerAdapter) {
                this.loggerAdapter.error(`SuggestionService: Error processing file ${fileUri.fsPath || fileUri}`, err);
            }
        }

        return null;
    }

    /**
     * Record a batch of user edits (might be adapting AI suggestions)
     * @param {vscode.TextDocument} document - The document
     * @param {Array<Change>} changes - Batch of Change domain entities
     */
    recordUserEditBatch(document, changes) {
        if (!this.suggestionAggregate || !changes || changes.length === 0) {
            return;
        }

        const uri = document.uri.toString();
        const fileName = uri.split('/').pop().split('?')[0];

        // Get pending suggestions for this document
        const pendingSuggestions = this.suggestionAggregate.getPendingSuggestionsForFile(uri);
        if (pendingSuggestions.length === 0) {
            return; // No pending suggestions for this document
        }

        // Merge ranges (Change entities have range property)
        const sortedRanges = [...changes]
            .map(c => c.range)
            .sort((a, b) => {
                const lineDiff = a.start.line - b.start.line;
                if (lineDiff !== 0) return lineDiff;
                return a.start.character - b.start.character;
            });

        const mergedRanges = [];
        for (const range of sortedRanges) {
            if (mergedRanges.length === 0) {
                mergedRanges.push(range);
                continue;
            }

            const lastMerged = mergedRanges[mergedRanges.length - 1];
            const isTouching = range.start.isEqual(lastMerged.end) ||
                range.start.isBefore(lastMerged.end) ||
                (range.start.line === lastMerged.end.line && range.start.character <= lastMerged.end.character);
            const isOverlapping = rangesOverlap(range, lastMerged);

            if (isOverlapping || isTouching) {
                const start = range.start.isBefore(lastMerged.start)
                    ? range.start
                    : lastMerged.start;
                const end = range.end.isAfter(lastMerged.end)
                    ? range.end
                    : lastMerged.end;
                const Range = this.vscodeAdapter.Range;
                mergedRanges[mergedRanges.length - 1] = new Range(start, end);
            } else {
                mergedRanges.push(range);
            }
        }

        // Check overlap against pending suggestions
        for (const suggestion of pendingSuggestions) {
            for (const mergedRange of mergedRanges) {
                if (rangesOverlap(mergedRange, suggestion.range)) {
                    // Delegate to aggregate - single authority for all suggestion mutations
                    this.suggestionAggregate.recordUserEditOnSuggestion(suggestion.id);

                    const logKey = `userEditOverlap:${uri}:${suggestion.id}`;
                    if (this.loggerAdapter) {
                        this.loggerAdapter.debug(`✏️  User edit batch overlaps AI suggestion in ${fileName}`, logKey);
                    }
                    break; // One overlap per suggestion is enough
                }
            }
        }
    }

    /**
     * Record user edits (might be adapting AI suggestions)
     * @deprecated Use recordUserEditBatch for batch processing
     * @param {vscode.TextDocument} document - The document
     * @param {Change|vscode.TextDocumentContentChangeEvent} change - The change (Change entity or raw change)
     */
    recordUserEdit(document, change) {
        // Convert single change to batch format
        // Support both Change entities and raw changes for backward compatibility
        const changes = change instanceof Change ? [change] : [{
            range: change.range,
            text: change.text,
            rangeLength: change.rangeLength
        }];
        this.recordUserEditBatch(document, changes);
    }

    /**
     * Check if suggestion was accepted, rejected, or adapted
     * @param {string} suggestionId - ID of the suggestion to check
     */
    async checkSuggestionStatus(suggestionId) {
        if (!this.suggestionAggregate) return;

        const suggestion = this.suggestionAggregate.findSuggestion(suggestionId);
        if (!suggestion || !suggestion.isPending()) {
            return;
        }

        try {
            const Uri = this.vscodeAdapter.Uri;
            const doc = await this.vscodeAdapter.openTextDocument(Uri.parse(suggestion.document));
            const safeRange = doc.validateRange(suggestion.range);
            const currentText = doc.getText(safeRange);
            const currentSize = currentText.length;

            const MIN_SIZE_FOR_RATIO = 10;
            if (!suggestion.size || suggestion.size < MIN_SIZE_FOR_RATIO) {
                if (currentSize === 0) {
                    this.suggestionAggregate.updateSuggestionStatus(suggestion, 'rejected');
                    this.suggestionAggregate.updateBatchOutcome(suggestion);
                    if (this.loggerAdapter) {
                        this.loggerAdapter.debug(`[DEBUG] Tiny suggestion rejected: empty after validation`);
                    }
                }
                return;
            }

            const sizeRatio = currentSize / suggestion.size;

            if (currentSize < suggestion.size * 0.4) {
                this.suggestionAggregate.updateSuggestionStatus(suggestion, 'rejected');
                if (this.loggerAdapter) {
                    this.loggerAdapter.debug(`[DEBUG] Suggestion rejected: ${(sizeRatio * 100).toFixed(1)}% of original`);
                }
            } else if (suggestion.userEdited) {
                this.suggestionAggregate.updateSuggestionStatus(suggestion, 'adapted');
                this.suggestionAggregate.updateBatchOutcome(suggestion);
                if (this.loggerAdapter) {
                    this.loggerAdapter.debug(`[DEBUG] Suggestion adapted by user`);
                }
            } else {
                let sourceType = 'AI suggestion';
                if (suggestion.isFileCreation || suggestion.isExternalCreation) {
                    sourceType = suggestion.isExternalCreation ? 'externally created file' : 'file creation';
                } else if (suggestion.isFileWrite) {
                    sourceType = 'agent file write';
                } else {
                    sourceType = 'text change';
                }

                if (suggestion.reviewed) {
                    this.suggestionAggregate.updateSuggestionStatus(suggestion, 'accepted');
                    this.suggestionAggregate.updateBatchOutcome(suggestion);
                    if (this.loggerAdapter) {
                        this.loggerAdapter.debug(`[DEBUG] Suggestion accepted (${sourceType})`);
                    }

                    // Check for keep all pattern
                    // Use aggregate's batch mapping (single source of truth)
                    const batchId = this.suggestionAggregate.getBatchIdForSuggestion(suggestion.id);
                    const batch = batchId ? this.suggestionAggregate.getBatch(batchId) : null;
                    if (batch && batch.isFullyResolved() && batch.isKeepAllPattern()) {
                        // Track acceptance for keep-all detection (merged from KeepAllDetectorService)
                        this._trackAcceptanceForKeepAll(suggestion);
                        
                        // Batch-level result for events/callbacks (separate from KeepAll detection)
                        const result = {
                            batchId: batch.batchId,
                            suggestionIds: batch.getSuggestionIdStrings(),
                            filePath: batch.filePath.toString(),
                            acceptanceCount: batch.acceptedCount
                        };

                        if (this.messagingAdapter) {
                            safe('publishKeepAllEvent', async () => {
                                const event = new KeepAllEvent({
                                    suggestionIds: result.suggestionIds || [],
                                    filePath: result.filePath,
                                    acceptanceCount: result.acceptanceCount || 0
                                });
                                await this.messagingAdapter.publishKeepAllEvent(event);
                            });
                        }

                        if (this.onKeepAll) {
                            this.onKeepAll(result);
                        }
                    }
                } else {
                    // No user interaction yet - keep pending, schedule another check
                    // Use scheduler to coalesce (cancels any existing timer for this suggestion)
                    this.statusScheduler.schedule(
                        suggestion.id,
                        () => this.checkSuggestionStatus(suggestion.id),
                        10000
                    );
                    return; // Exit early, don't emit outcome yet
                }
            }

            // Call optional callback (e.g., for UsageStats)
            if (this.onAISuggestionOutcome) {
                this.onAISuggestionOutcome({
                    filePath: suggestion.document,
                    status: suggestion.status,
                    size: suggestion.size,
                    reviewTime: suggestion.reviewTime,
                    editCount: suggestion.editCount,
                    isFileCreation: suggestion.isFileCreation,
                    isExternalCreation: suggestion.isExternalCreation,
                    isFileWrite: suggestion.isFileWrite
                });
            }

            // Publish domain event
            if (this.messagingAdapter) {
                safe('publishAISuggestionOutcomeEvent', async () => {
                    const event = new AISuggestionOutcomeEvent({
                        suggestionId: suggestion.id,
                        outcome: suggestion.status,
                        filePath: suggestion.document
                    });
                    await this.messagingAdapter.publishAISuggestionOutcomeEvent(event);
                });
            }

            // Update score immediately when status changes
            if (this.updateScore) {
                this.updateScore();
            }
        } catch (err) {
            if (this.loggerAdapter) {
                this.loggerAdapter.error('SuggestionService: Error checking suggestion status', err);
            }
        }
    }

    /**
     * Create a suggestion and add it to tracking
     * Public method for use by domain entities
     * @param {Object} options - Suggestion properties
     * @param {number} contentLength - Length of content
     * @returns {Suggestion} Created suggestion entity
     */
    createSuggestionAndTrack(options, contentLength) {
        if (!this.suggestionAggregate) return null;

        const suggestion = this.suggestionAggregate.createSuggestion(options);
        this._addSuggestionAndTrack(suggestion, contentLength);
        return suggestion;
    }

    /**
     * Add suggestion to aggregate and track it
     * Internal method that handles suggestion tracking workflow
     * @param {Suggestion} suggestion - Suggestion entity
     * @param {number} contentLength - Length of content
     */
    _addSuggestionAndTrack(suggestion, contentLength) {
        if (!this.suggestionAggregate) return;

        // Add to aggregate
        this.suggestionAggregate.addSuggestion(suggestion);

        // Add to debt
        if (this.debtService) {
            const uri = suggestion.document;
            this.debtService.addToDebt(uri, contentLength, () => {
                if (this.updateScore) {
                    this.updateScore();
                }
            });
        }

        // Update file colors immediately when new suggestion is added
        if (this.updateFileColorsInExplorer) {
            this.updateFileColorsInExplorer();
        }

        // Schedule status check after 5 seconds
        // Use scheduler to coalesce (cancels any existing timer for this suggestion)
        this.statusScheduler.schedule(
            suggestion.id,
            () => this.checkSuggestionStatus(suggestion.id),
            5000
        );

        // Immediately update score to reflect new activity
        if (this.updateScore) {
            this.updateScore();
        }
    }

    /**
     * Get all suggestions
     * @returns {Array} Array of suggestions
     */
    getSuggestions() {
        return this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
    }

    /**
     * Get suggestions by status
     * @param {string} status - Status to filter by
     * @returns {Array} Filtered suggestions
     */
    getSuggestionsByStatus(status) {
        return this.suggestionAggregate ? this.suggestionAggregate.getSuggestionsByStatus(status) : [];
    }

    /**
     * Mark suggestion as reviewed (delegates to aggregate - single authority)
     * @param {string} suggestionId - Suggestion ID
     * @param {number} reviewTime - Review time in milliseconds (accumulated)
     */
    markSuggestionAsReviewed(suggestionId, reviewTime = 0) {
        if (!this.suggestionAggregate) return;
        
        // Delegate to aggregate - single authority for all suggestion mutations
        this.suggestionAggregate.markSuggestionReviewed(suggestionId, {
            reviewTimeDeltaMs: reviewTime,
            reviewStartedAt: null // Let aggregate handle default
        });
        
        if (this.loggerAdapter) {
            this.loggerAdapter.debug(`Suggestion ${suggestionId} marked as reviewed (time: ${reviewTime}ms)`);
        }
    }
    
    /**
     * Update suggestion review time (delegates to aggregate - accumulates)
     * @param {string} suggestionId - Suggestion ID
     * @param {number} reviewTime - Additional review time in milliseconds
     */
    updateSuggestionReviewTime(suggestionId, reviewTime) {
        if (!this.suggestionAggregate) return;
        
        // Delegate to aggregate - single authority for all suggestion mutations
        this.suggestionAggregate.addSuggestionReviewTime(suggestionId, reviewTime);
    }
    
    /**
     * Get suggestion by ID
     * @param {string} suggestionId - Suggestion ID
     * @returns {Object|null} Suggestion or null
     */
    getSuggestionById(suggestionId) {
        return this.suggestionAggregate ? this.suggestionAggregate.findSuggestion(suggestionId) : null;
    }
    
    /**
     * Check if file has pending suggestions
     * @param {string} documentUri - Document URI string
     * @returns {boolean} True if file has pending suggestions
     */
    hasPendingSuggestions(documentUri) {
        return this.suggestionAggregate ? this.suggestionAggregate.hasPendingSuggestions(documentUri) : false;
    }

    /**
     * Get pending suggestions for a file
     * @param {string} documentUri - Document URI string
     * @returns {Array} Array of pending suggestions
     */
    getPendingSuggestionsForFile(documentUri) {
        return this.suggestionAggregate ? this.suggestionAggregate.getPendingSuggestionsForFile(documentUri) : [];
    }
    
    // ============================================
    // Keep-All Detection (merged from KeepAllDetectorService)
    // ============================================
    
    /**
     * Track suggestion acceptance and detect "Keep All" pattern
     * @private
     */
    _trackAcceptanceForKeepAll(suggestion) {
        const now = Date.now();
        
        // Add this acceptance to the tracking array
        this.recentAcceptances.push({
            timestamp: now,
            suggestionId: suggestion.id,
            document: suggestion.document,
            size: suggestion.size || 0
        });
        
        // Clean old entries (outside detection window)
        this.recentAcceptances = this.recentAcceptances.filter(
            entry => (now - entry.timestamp) < this.keepAllDetectionWindow
        );
        
        // Check for "Keep All" pattern
        if (this.recentAcceptances.length >= this.keepAllThreshold) {
            this._detectKeepAll();
        }
    }
    
    /**
     * Detect "Keep All" pattern and emit to usage statistics
     * @private
     */
    _detectKeepAll() {
        const now = Date.now();
        const recent = this.recentAcceptances.filter(
            entry => (now - entry.timestamp) < this.keepAllDetectionWindow
        );
        
        if (recent.length >= this.keepAllThreshold) {
            // Get unique files affected
            const uniqueFiles = new Set(recent.map(e => e.document));
            const totalSize = recent.reduce((sum, e) => sum + e.size, 0);
            
            if (this.loggerAdapter) {
                this.loggerAdapter.log(`AwarenessMonitor: "Keep All" detected - ${recent.length} suggestions accepted across ${uniqueFiles.size} files`);
            }
            
            // Call optional callback (e.g., for UsageStats)
            if (this.onKeepAll) {
                this.onKeepAll({
                    count: recent.length,
                    fileCount: uniqueFiles.size,
                    totalSize: totalSize,
                    timestamp: now,
                    window: this.keepAllDetectionWindow
                });
            }
            
            // Clear the tracking array to avoid duplicate detections
            // (but keep the most recent one to allow for overlapping detections)
            this.recentAcceptances = recent.slice(-1);
        }
    }
    
    /**
     * Get number of recent acceptances
     * @returns {number} Number of recent acceptances
     */
    getRecentAcceptanceCount() {
        return this.recentAcceptances.length;
    }
    
    // ============================================
    // Review Tracking (merged from ReviewTrackingService)
    // ============================================
    
    /**
     * Handle cursor move event for review tracking
     * @param {string} uri - Document URI string
     * @param {Object} position - Cursor position { line, character }
     */
    onCursorMoved(uri, position) {
        if (!uri || !position) return;
        
        // Get pending suggestions for this document
        const pendingSuggestions = this.getSuggestionsByStatus('pending')
            .filter(s => s.document === uri);
        
        const activeReview = this.activeReviews.get(uri);
        
        // Check if cursor left the active suggestion
        if (activeReview) {
            const activeSuggestion = pendingSuggestions.find(s => s.id === activeReview.suggestionId);
            if (activeSuggestion) {
                const isInRange = this.rangeOperationServiceD.isPositionInRange(
                    this.vscodeAdapter,
                    position,
                    activeSuggestion.range
                );
                
                if (!isInRange) {
                    // Cursor left the suggestion - close review
                    this._closeReview(uri);
                } else {
                    // Still in active suggestion - continue tracking
                    return;
                }
            } else {
                // Active suggestion no longer exists
                this._closeReview(uri);
            }
        }
        
        // Check if cursor entered a new suggestion
        for (const suggestion of pendingSuggestions) {
            const isInRange = this.rangeOperationServiceD.isPositionInRange(
                this.vscodeAdapter,
                position,
                suggestion.range
            );
            
            if (isInRange) {
                // Start tracking this suggestion
                this._startReview(uri, suggestion.id);
                return;
            }
        }
    }
    
    /**
     * Handle scroll event for review tracking
     * @param {string} uri - Document URI string
     */
    onScroll(uri) {
        // Scroll events can be used for engagement tracking
        // Currently just ensure active review is maintained
        if (this.activeReviews.has(uri)) {
            // Review is still active
            return;
        }
    }
    
    /**
     * Handle document close for review tracking
     * @param {string} uri - Document URI string
     */
    onDocumentClose(uri) {
        if (uri) {
            this._closeReview(uri);
        }
    }
    
    /**
     * Start tracking a review session
     * @private
     */
    _startReview(uri, suggestionId) {
        const now = Date.now();
        
        // Clear any existing review for this URI
        this._closeReview(uri, false);
        
        // Create dwell timer through timer registry (mandatory)
        const dwellTimer = this.timerRegistry.setTimeout(() => {
            const currentReview = this.activeReviews.get(uri);
            if (currentReview && currentReview.suggestionId === suggestionId) {
                // Calculate review time (dwell time threshold)
                const reviewTime = this.DWELL_TIME_MS;
                
                // Mark suggestion as reviewed
                this.markSuggestionAsReviewed(suggestionId, reviewTime);
                
                // Trigger status check
                this.checkSuggestionStatus(suggestionId);
            }
        }, this.DWELL_TIME_MS);
        
        // Store review state
        this.activeReviews.set(uri, {
            suggestionId,
            reviewStarted: now,
            reviewTime: 0,
            dwellTimer
        });
    }
    
    /**
     * Close an active review session
     * @private
     */
    _closeReview(uri, updateReviewTime = true) {
        const activeReview = this.activeReviews.get(uri);
        if (!activeReview) return;
        
        // Clear dwell timer through timer registry
        if (activeReview.dwellTimer) {
            this.timerRegistry.clearTimeout(activeReview.dwellTimer);
        }
        
        // Update review time if requested
        if (updateReviewTime && activeReview.reviewStarted) {
            const reviewDuration = Date.now() - activeReview.reviewStarted;
            if (reviewDuration > 0) {
                // Update review time (accumulates)
                this.updateSuggestionReviewTime(activeReview.suggestionId, reviewDuration);
            }
        }
        
        // Remove from active reviews
        this.activeReviews.delete(uri);
    }
    
    /**
     * Dispose - clean up all timers and state
     */
    dispose() {
        // Cancel all outstanding status check timers
        this.statusScheduler.cancelAll();
        
        // Clean up review tracking timers
        for (const [uri, review] of this.activeReviews.entries()) {
            if (review.dwellTimer) {
                this.timerRegistry.clearTimeout(review.dwellTimer);
            }
        }
        this.activeReviews.clear();
        
        // Clear keep-all tracking
        this.recentAcceptances = [];
    }
}

// module.exports = SuggestionService; // Commented for consolidation

})(); // End IIFE for app/suggestionService.js


// ============================================================================
// FILE 11/14: app/suggestionStatusScheduler.js
// ============================================================================

(function() { // IIFE scope for app/suggestionStatusScheduler.js
/**
 * SuggestionStatusScheduler - Coalescing scheduler for suggestion status checks
 * 
 * Ensures only one outstanding timer per suggestion ID to prevent duplicate checks/events.
 * All timers are managed through TimerRegistry for proper cleanup.
 */

class SuggestionStatusScheduler {
    /**
     * @param {TimerRegistry} timerRegistry - Timer registry (required)
     * @param {Function} isActive - Function to check if service is active (required)
     * @param {string} instanceId - Instance ID for generation-based cancellation (required)
     */
    constructor(timerRegistry, isActive, instanceId) {
        if (!timerRegistry) {
            throw new Error('SuggestionStatusScheduler requires timerRegistry');
        }
        if (!isActive || typeof isActive !== 'function') {
            throw new Error('SuggestionStatusScheduler requires isActive function');
        }
        if (!instanceId) {
            throw new Error('SuggestionStatusScheduler requires instanceId');
        }

        this.timerRegistry = timerRegistry;
        this.isActive = isActive;
        this.instanceId = instanceId;
        
        // Track outstanding timers per suggestion ID (one timer per suggestion)
        this.outstandingTimers = new Map(); // suggestionId -> timer
    }

    /**
     * Schedule a status check for a suggestion
     * If a timer already exists for this suggestion, it will be cancelled and replaced.
     * @param {string} suggestionId - Suggestion ID
     * @param {Function} checkCallback - Callback to execute (checkSuggestionStatus)
     * @param {number} delayMs - Delay in milliseconds (default: 5000)
     */
    schedule(suggestionId, checkCallback, delayMs = 5000) {
        if (!suggestionId || !checkCallback) {
            return;
        }

        // Cancel existing timer for this suggestion if any
        this.cancel(suggestionId);

        // Capture instance ID at timer creation for generation-based cancellation
        const instanceId = this.instanceId;

        // Create new timer through registry
        const timer = this.timerRegistry.setTimeout(() => {
            // Remove from outstanding timers
            this.outstandingTimers.delete(suggestionId);
            
            // Generation-based cancellation: only execute if instance ID matches
            if (this.instanceId !== instanceId) {
                return; // Instance was restarted, ignore this timer
            }
            
            // Only execute if service is still active
            if (this.isActive()) {
                checkCallback();
            }
        }, delayMs);

        // Track this timer
        this.outstandingTimers.set(suggestionId, timer);
    }

    /**
     * Cancel a scheduled status check for a suggestion
     * @param {string} suggestionId - Suggestion ID
     */
    cancel(suggestionId) {
        const timer = this.outstandingTimers.get(suggestionId);
        if (timer) {
            this.timerRegistry.clearTimeout(timer);
            this.outstandingTimers.delete(suggestionId);
        }
    }

    /**
     * Cancel all outstanding status checks
     */
    cancelAll() {
        for (const [suggestionId, timer] of this.outstandingTimers.entries()) {
            this.timerRegistry.clearTimeout(timer);
        }
        this.outstandingTimers.clear();
    }

    /**
     * Get count of outstanding timers
     * @returns {number} Number of outstanding timers
     */
    getOutstandingCount() {
        return this.outstandingTimers.size;
    }
}

// module.exports = SuggestionStatusScheduler; // Commented for consolidation

})(); // End IIFE for app/suggestionStatusScheduler.js


// ============================================================================
// FILE 12/14: app/timerRegistry.js
// ============================================================================

(function() { // IIFE scope for app/timerRegistry.js
/**
 * TimerRegistry - Centralized timer management for awareness module
 * 
 * Provides a single point of control for all timers, ensuring they can be
 * properly cleaned up on service stop/dispose. This prevents "stuck state"
 * bugs where timers fire after the service has been stopped.
 */

class TimerRegistry {
    constructor() {
        // Track all active timers
        this.timeouts = new Set();
        this.intervals = new Set();
    }

    /**
     * Create a timeout that will be tracked and can be cleared
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {Object} Timer ID (Node.js Timeout object)
     */
    setTimeout(callback, delay) {
        const timer = setTimeout(() => {
            this.timeouts.delete(timer);
            callback();
        }, delay);
        this.timeouts.add(timer);
        return timer;
    }

    /**
     * Create an interval that will be tracked and can be cleared
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {Object} Timer ID (Node.js Timeout object)
     */
    setInterval(callback, delay) {
        const timer = setInterval(callback, delay);
        this.intervals.add(timer);
        return timer;
    }

    /**
     * Clear a specific timeout
     * @param {Object} timer - Timer ID to clear
     */
    clearTimeout(timer) {
        if (timer) {
            clearTimeout(timer);
            this.timeouts.delete(timer);
        }
    }

    /**
     * Clear a specific interval
     * @param {Object} timer - Timer ID to clear
     */
    clearInterval(timer) {
        if (timer) {
            clearInterval(timer);
            this.intervals.delete(timer);
        }
    }

    /**
     * Clear all timers (timeouts and intervals)
     * Should be called on service stop/dispose
     */
    clear() {
        // Clear all timeouts
        for (const timer of this.timeouts) {
            clearTimeout(timer);
        }
        this.timeouts.clear();

        // Clear all intervals
        for (const timer of this.intervals) {
            clearInterval(timer);
        }
        this.intervals.clear();
    }

    /**
     * Get count of active timers
     * @returns {Object} { timeouts: number, intervals: number }
     */
    getCount() {
        return {
            timeouts: this.timeouts.size,
            intervals: this.intervals.size
        };
    }
}

// module.exports = TimerRegistry; // Commented for consolidation

})(); // End IIFE for app/timerRegistry.js


// ============================================================================
// FILE 13/14: app/uriPathUtilities.js
// ============================================================================

(function() { // IIFE scope for app/uriPathUtilities.js
/**
 * UriPathUtilities - Application layer utilities for URI and path operations
 * 
 * Contains technical utilities for URI/path normalization and extraction.
 * These are technical/infrastructure operations - not domain business logic.
 */

// const path = require('path'); // Commented for consolidation

class UriPathUtilities {
    /**
     * Normalize file path or URI to canonical URI string
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {string|Uri} filePathOrUri - File path or URI
     * @returns {string} Canonical URI string
     */
    static normalizeToUri(vscodePort, filePathOrUri) {
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
                const Uri = vscodePort.Uri;
                if (Uri && Uri.file) {
                    const uri = Uri.file(filePathOrUri);
                    return uri.toString();
                }
                // Fallback if Uri not available
                return filePathOrUri;
            } catch (err) {
                // Fallback: treat as relative path or return as-is
                return filePathOrUri;
            }
        }
        
        return filePathOrUri;
    }

    /**
     * Get relative path from workspace
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {string} filePath - Absolute file path
     * @returns {string} Relative path or basename
     */
    static getRelativePath(vscodePort, filePath) {
        if (!filePath) return '';
        
        const workspaceFolders = vscodePort.workspaceFolders || [];
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return path.basename(filePath);
        }
        
        // Try each workspace folder
        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath || folder.uri.path || '';
            if (filePath.startsWith(folderPath)) {
                const relative = path.relative(folderPath, filePath);
                return relative || path.basename(filePath);
            }
        }
        
        // Fallback to basename if not in workspace
        return path.basename(filePath);
    }

    /**
     * Extract filename from URI
     * @param {string} uri - URI string
     * @returns {string} Filename
     */
    static extractFileName(uri) {
        if (!uri) return '';
        
        // Handle URI string
        let pathPart = uri;
        if (uri.includes('://')) {
            try {
                const url = new URL(uri);
                pathPart = url.pathname;
            } catch (e) {
                // Fallback: extract path manually
                const match = uri.match(/:\/\/[^\/]+(.*)/);
                if (match) {
                    pathPart = match[1].split('?')[0].split('#')[0];
                }
            }
        } else {
            pathPart = uri.split('?')[0].split('#')[0];
        }
        
        return path.basename(pathPart);
    }

    /**
     * Extract file extension from URI
     * @param {string} uri - URI string
     * @returns {string} File extension (with dot)
     */
    static extractFileExtension(uri) {
        if (!uri) return '';
        
        const fileName = this.extractFileName(uri);
        return path.extname(fileName);
    }
}

// module.exports = UriPathUtilities; // Commented for consolidation

})(); // End IIFE for app/uriPathUtilities.js


// ============================================================================
// FILE 14/14: app/vscodeDocUtilities.js
// ============================================================================

(function() { // IIFE scope for app/vscodeDocUtilities.js
/**
 * VSCodeDocUtilities - Application layer utilities for VS Code document operations
 * 
 * Contains technical utilities for VS Code document/URI operations.
 * These are technical/infrastructure operations - not domain business logic.
 * 
 * Moved from domain/utils/utils.js to fix hex boundary violations.
 */

// const vscode = require('vscode'); // Commented for consolidation
// const path = require('path'); // Commented for consolidation

// Constants for file filtering
const NON_CODE_SCHEMES = ['output', 'vscode', 'vscode-notebook', 'debug', 'vscode-userdata', 'git'];
// Fix: Store extensions in lowercase for consistent comparison
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj', '.sh', '.bash', '.zsh', '.fish'].map(ext => ext.toLowerCase());

/**
 * Check if a document should be skipped (non-code documents)
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

})(); // End IIFE for app/vscodeDocUtilities.js

