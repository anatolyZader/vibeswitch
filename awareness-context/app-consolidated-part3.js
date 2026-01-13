/**
 * APP LAYER - CONSOLIDATED (PART 3/3)
 * 
 * This file contains part 3 of 3 of the app layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 4/15
 * Generated: 2026-01-13T15:56:48.098Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 12/15: app/suggestionService.js
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

// Import app layer services
// const KeepAllDetectorService = require('./keepAllDetectorService'); // Commented for consolidation

// Import domain utilities
// const { rangesOverlap } = require('../domain/utils/utils'); // Commented for consolidation

// Import domain events
// const AISuggestionOutcomeEvent = require('../domain/events/aiSuggestionOutcomeEvent'); // Commented for consolidation
// const KeepAllEvent = require('../domain/events/keepAllEvent'); // Commented for consolidation

// Import utilities
// const safe = require('../../../../helpers/safe'); // Commented for consolidation

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
        isActive
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
                        const result = {
                            batchId: batch.batchId,
                            suggestionIds: batch.getSuggestionIdStrings(),
                            filePath: batch.filePath.toString(),
                            acceptanceCount: batch.acceptedCount
                        };

                        if (this.keepAllDetectorService) {
                            this.keepAllDetectorService.trackAcceptance(result);
                        }

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
                    const timer = setTimeout(() => {
                        this.activeStatusCheckTimers.delete(timer);
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
        const timer = setTimeout(() => {
            this.activeStatusCheckTimers.delete(timer);
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

// module.exports = SuggestionService; // Commented for consolidation

})(); // End IIFE for app/suggestionService.js


// ============================================================================
// FILE 13/15: app/timerRegistry.js
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
// FILE 14/15: app/uriPathUtilities.js
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
// FILE 15/15: app/vscodeUtilities.js
// ============================================================================

(function() { // IIFE scope for app/vscodeUtilities.js
/**
 * VSCodeUtilities - Application layer utilities for VS Code operations
 * 
 * Contains technical/infrastructure utilities for VS Code API operations.
 * These are thin wrappers around VS Code API - not domain logic.
 */

class VSCodeUtilities {
    /**
     * Subscribe to text document change events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToTextDocumentChanges(vscodePort, handler) {
        return vscodePort.onDidChangeTextDocument(handler);
    }

    /**
     * Subscribe to file creation events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToFileCreation(vscodePort, handler) {
        return vscodePort.onDidCreateFiles(handler);
    }

    /**
     * Subscribe to file save events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToFileSave(vscodePort, handler) {
        return vscodePort.onDidSaveTextDocument(handler);
    }

    /**
     * Subscribe to file open events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToFileOpen(vscodePort, handler) {
        return vscodePort.onDidOpenTextDocument(handler);
    }

    /**
     * Subscribe to file close events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToFileClose(vscodePort, handler) {
        return vscodePort.onDidCloseTextDocument(handler);
    }

    /**
     * Subscribe to cursor move events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToCursorMove(vscodePort, handler) {
        return vscodePort.onDidChangeTextEditorSelection(handler);
    }

    /**
     * Subscribe to scroll events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToScroll(vscodePort, handler) {
        return vscodePort.onDidChangeTextEditorVisibleRanges(handler);
    }

    /**
     * Subscribe to editor change events
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Function} handler - Event handler function
     * @returns {Object} Disposable to unsubscribe
     */
    static subscribeToEditorChange(vscodePort, handler) {
        return vscodePort.onDidChangeActiveTextEditor(handler);
    }

    /**
     * Get relative path from URI
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {vscode.Uri} uri - URI to convert
     * @returns {string} Relative path
     */
    static asRelativePath(vscodePort, uri) {
        return vscodePort.asRelativePath(uri);
    }

    /**
     * Get Range constructor
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @returns {Function} Range constructor
     */
    static getRange(vscodePort) {
        return vscodePort.Range;
    }

    /**
     * Get text documents from workspace
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @returns {Array<vscode.TextDocument>} Array of text documents
     */
    static getTextDocuments(vscodePort) {
        return vscodePort.textDocuments || [];
    }

    /**
     * Get workspace folders
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @returns {Array} Array of workspace folders
     */
    static getWorkspaceFolders(vscodePort) {
        return vscodePort.workspaceFolders || [];
    }
}

// module.exports = VSCodeUtilities; // Commented for consolidation

})(); // End IIFE for app/vscodeUtilities.js

