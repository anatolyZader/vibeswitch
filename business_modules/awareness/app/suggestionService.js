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

// Import app layer services
const KeepAllDetectorService = require('./keepAllDetectorService');

// Import domain utilities
const { rangesOverlap } = require('../domain/utils/utils');

// Import domain events
const AISuggestionOutcomeEvent = require('../domain/events/aiSuggestionOutcomeEvent');
const KeepAllEvent = require('../domain/events/keepAllEvent');

// Import utilities
const safe = require('../../../../helpers/safe');

class SuggestionService {
    /**
     * @param {SuggestionAggregate} suggestionAggregate - Suggestion aggregate (required)
     * @param {DebtService} debtService - Debt service (required)
     * @param {KeepAllDetectorService} keepAllDetectorService - Keep all detector service (optional)
     * @param {IAwarenessVSCodePort} vscodeAdapter - VS Code adapter (required)
     * @param {ILoggerPort} loggerAdapter - Logger adapter (optional)
     * @param {IAwarenessMessagingPort} messagingAdapter - Messaging adapter (optional)
     * @param {Function} updateScore - Score update callback (optional)
     * @param {Function} updateFileColorsInExplorer - File colors update callback (optional)
     * @param {Function} onAISuggestion - AI suggestion callback (optional)
     * @param {Function} onAISuggestionOutcome - AI suggestion outcome callback (optional)
     * @param {Function} onKeepAll - Keep all callback (optional)
     * @param {Set} activeStatusCheckTimers - Set to track status check timers (required)
     * @param {Function} isActive - Function to check if service is active (required)
     * @param {string} instanceId - Instance ID for generation-based timer cancellation (required)
     */
    constructor({
        suggestionAggregate,
        debtService,
        keepAllDetectorService = null,
        vscodeAdapter,
        loggerAdapter = null,
        messagingAdapter = null,
        updateScore = null,
        updateFileColorsInExplorer = null,
        onAISuggestion = null,
        onAISuggestionOutcome = null,
        onKeepAll = null,
        activeStatusCheckTimers,
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
        if (!activeStatusCheckTimers) {
            throw new Error('SuggestionService requires activeStatusCheckTimers');
        }
        if (!isActive || typeof isActive !== 'function') {
            throw new Error('SuggestionService requires isActive function');
        }
        if (!instanceId) {
            throw new Error('SuggestionService requires instanceId for timer cancellation');
        }

        this.suggestionAggregate = suggestionAggregate;
        this.debtService = debtService;
        this.keepAllDetectorService = keepAllDetectorService;
        this.vscodeAdapter = vscodeAdapter;
        this.loggerAdapter = loggerAdapter;
        this.messagingAdapter = messagingAdapter;
        this.updateScore = updateScore;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.onAISuggestion = onAISuggestion;
        this.onAISuggestionOutcome = onAISuggestionOutcome;
        this.onKeepAll = onKeepAll;
        this.activeStatusCheckTimers = activeStatusCheckTimers;
        this.isActive = isActive;
        this.instanceId = instanceId; // Store instance ID for generation-based cancellation
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

        // Create/update batch for this suggestion
        const batchId = this.suggestionAggregate.createOrUpdateBatch(uri, suggestion.id, mergedSize);
        suggestion.batchId = batchId;

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
                    suggestion.recordUserEdit();

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
                    const batch = suggestion.batchId ? this.suggestionAggregate.getBatch(suggestion.batchId) : null;
                    if (batch && batch.isFullyResolved() && batch.isKeepAllPattern()) {
                        // Track each accepted suggestion individually (not batch-level)
                        // KeepAllDetector expects per-suggestion data: { id, document, size }
                        if (this.keepAllDetectorService && suggestion) {
                            this.keepAllDetectorService.trackAcceptance({
                                id: suggestion.id,
                                document: suggestion.document,
                                size: suggestion.size || 0
                            });
                        }
                        
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
                                    acceptanceCount: result.count || 0
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
                    const instanceId = this.instanceId; // Capture instance ID at timer creation
                    const timer = setTimeout(() => {
                        this.activeStatusCheckTimers.delete(timer);
                        // Generation-based cancellation: only execute if instance ID matches
                        if (this.instanceId !== instanceId) {
                            return; // Instance was restarted, ignore this timer
                        }
                        if (this.isActive()) {
                            this.checkSuggestionStatus(suggestion.id);
                        }
                    }, 10000);
                    this.activeStatusCheckTimers.add(timer);
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
        const instanceId = this.instanceId; // Capture instance ID at timer creation
        const timer = setTimeout(() => {
            this.activeStatusCheckTimers.delete(timer);
            // Generation-based cancellation: only execute if instance ID matches
            if (this.instanceId !== instanceId) {
                return; // Instance was restarted, ignore this timer
            }
            if (this.isActive()) {
                this.checkSuggestionStatus(suggestion.id);
            }
        }, 5000);
        this.activeStatusCheckTimers.add(timer);

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
     * Mark suggestion as reviewed (single authority for suggestion state)
     * This method is the ONLY place that should mutate suggestion.reviewed
     * @param {string} suggestionId - Suggestion ID
     * @param {number} reviewTime - Review time in milliseconds
     */
    markSuggestionAsReviewed(suggestionId, reviewTime = 0) {
        if (!this.suggestionAggregate) return;
        
        const suggestion = this.suggestionAggregate.findSuggestion(suggestionId);
        if (suggestion) {
            // Single authority: only SuggestionService mutates suggestion.reviewed
            suggestion.reviewed = true;
            suggestion.reviewTime = (suggestion.reviewTime || 0) + reviewTime;
            
            if (this.loggerAdapter) {
                this.loggerAdapter.debug(`Suggestion ${suggestionId} marked as reviewed (time: ${reviewTime}ms)`);
            }
        }
    }
    
    /**
     * Update suggestion review time (used by ReviewTrackingService when closing reviews)
     * @param {string} suggestionId - Suggestion ID
     * @param {number} reviewTime - Additional review time in milliseconds
     */
    updateSuggestionReviewTime(suggestionId, reviewTime) {
        if (!this.suggestionAggregate) return;
        
        const suggestion = this.suggestionAggregate.findSuggestion(suggestionId);
        if (suggestion) {
            suggestion.reviewTime = (suggestion.reviewTime || 0) + reviewTime;
        }
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
}

module.exports = SuggestionService;
