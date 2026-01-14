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
const SuggestionAggregate = require('../domain/aggregates/suggestionAggregate');

// Import domain entities
const Change = require('../domain/entities/change');

// Import domain utilities
const { rangesOverlap } = require('./vscodeDocUtilities');

// Import domain events
const AISuggestionOutcomeEvent = require('../domain/events/aiSuggestionOutcomeEvent');
const KeepAllEvent = require('../domain/events/keepAllEvent');

// Import utilities
const safe = require('../../../../helpers/safe');
const SuggestionStatusScheduler = require('./suggestionStatusScheduler');
const SuggestionOutcomePolicy = require('../domain/policies/suggestionOutcomePolicy');

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
        
        // Create domain policy for status decisions
        this.outcomePolicy = new SuggestionOutcomePolicy();
        
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

        // Get text from full merged range (for suggestion entity)
        // Store both fullRange and effectiveRange to fix range/text mismatch
        const fullText = document.getText(mergedRange);
        const fullSize = fullText.length;
        
        // Get text from effective range (for debt sizing only)
        const effectiveText = document.getText(effectiveRange);
        const effectiveSize = effectiveText.length;

        const fileName = uri.split('/').pop().split('?')[0];
        if (this.loggerAdapter) {
            this.loggerAdapter.debug(`[DEBUG] 📝 AI suggestion batch: ${changes.length} changes, ${fullSize} chars (effective: ${effectiveSize}) in ${fileName}`);
        }

        // Extract classification metadata from first change (all changes in batch have same classification)
        const classificationMeta = changes[0]?.classification ? {
            classificationLabel: changes[0].classification.label,
            classificationConfidence: changes[0].classification.confidence,
            classificationReasons: changes[0].classification.reasons
        } : {};

        // Create suggestion entity with full range and text (fixes range/text mismatch)
        // Store effectiveRange separately if different (for debt sizing)
        const suggestion = this.suggestionAggregate.createSuggestion({
            document: uri,
            range: mergedRange, // Full range
            text: fullText, // Text matching full range
            size: fullSize, // Size matching full range
            effectiveRange: effectiveRange !== mergedRange ? effectiveRange : undefined, // Store if different
            effectiveSize: effectiveSize !== fullSize ? effectiveSize : undefined, // Store if different
            ...classificationMeta,
            ...meta
        });

        // Add suggestion to batch (aggregate sets batchId on entity)
        // Use effectiveSize for debt sizing if available, otherwise fullSize
        const debtSize = suggestion.effectiveSize || fullSize;
        const batchId = this.suggestionAggregate.addSuggestionToBatch(uri, suggestion.id, debtSize);

        // Check if this is a new batch (first suggestion) for event publishing
        const batch = this.suggestionAggregate.getBatch(batchId);
        const isNewBatch = batch && batch.suggestionIds.length === 1;

        // Add to aggregate and track
        this._addSuggestionAndTrack(suggestion, mergedSize);

        // Publish batch created event if this is a new batch
        if (isNewBatch && this.messagingAdapter) {
            const SuggestionBatchCreatedEvent = require('../domain/events/suggestionBatchCreatedEvent');
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
            // Fetch current text from document (I/O operation)
            const Uri = this.vscodeAdapter.Uri;
            const doc = await this.vscodeAdapter.openTextDocument(Uri.parse(suggestion.document));
            const safeRange = doc.validateRange(suggestion.range);
            const currentText = doc.getText(safeRange);
            const currentSize = currentText.length;

            // Prepare facts for domain policy (pure data)
            const facts = {
                originalText: suggestion.text || '',
                currentText: currentText,
                originalSize: suggestion.size || 0,
                currentSize: currentSize,
                wasUserEdited: suggestion.userEdited || false,
                wasReviewed: suggestion.reviewed || false,
                meta: {
                    isFileCreation: suggestion.isFileCreation || false,
                    isExternalCreation: suggestion.isExternalCreation || false,
                    isFileWrite: suggestion.isFileWrite || false
                }
            };

            // Domain policy makes the decision (pure business logic)
            const decision = this.outcomePolicy.decideOutcome(facts);

            // If still pending, schedule another check
            if (decision.outcome === 'pending') {
                this.statusScheduler.schedule(
                    suggestion.id,
                    () => this.checkSuggestionStatus(suggestion.id),
                    10000
                );
                return; // Exit early, don't emit outcome yet
            }

            // Update status (domain aggregate enforces invariants)
            this.suggestionAggregate.updateSuggestionStatus(suggestion, decision.outcome);
            // Always update batch outcome when status changes (fix for inconsistency)
            this.suggestionAggregate.updateBatchOutcome(suggestion);

            if (this.loggerAdapter) {
                this.loggerAdapter.debug(`[DEBUG] Suggestion ${decision.outcome}: ${decision.reason}`);
            }

            // Handle accepted suggestions (keep-all detection, events)
            if (decision.outcome === 'accepted') {
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
        // Tag with owner for selective clearing
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
        }, this.DWELL_TIME_MS, 'reviewTracking');
        
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

module.exports = SuggestionService;
