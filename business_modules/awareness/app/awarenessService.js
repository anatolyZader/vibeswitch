/**
 * AwarenessService - Application service for awareness monitoring
 * 
 * Orchestrates business logic for tracking AI-generated code changes and user review activity.
 * This is the application layer that coordinates domain entities and uses adapters.
 */

// Import domain entities
const DebtManager = require('../domain/entities/debtManager');
const ChangeLedger = require('../domain/entities/changeLedger');
const ScoreCalculator = require('../domain/entities/scoreCalculator');
const SessionTracker = require('../domain/entities/sessionTracker');
const FileWatcher = require('../domain/entities/fileWatcher');
const EventHandlers = require('../domain/entities/eventHandlers');
const KeepAllDetector = require('../domain/entities/keepAllDetector');

// Import domain aggregates
const SuggestionAggregate = require('../domain/aggregates/suggestionAggregate');

// Import domain utilities
const { rangesOverlap } = require('../domain/utils/utils');

// Import domain events
const AISuggestionEvent = require('../domain/events/aiSuggestionEvent');
const AISuggestionOutcomeEvent = require('../domain/events/aiSuggestionOutcomeEvent');
const ScoreUpdateEvent = require('../domain/events/scoreUpdateEvent');
const KeepAllEvent = require('../domain/events/keepAllEvent');
const DebtClearedEvent = require('../domain/events/debtClearedEvent');
const SuggestionBatchCreatedEvent = require('../domain/events/suggestionBatchCreatedEvent');

// Import adapters
const AwarenessLoggerAdapter = require('../infrastructure/adapters/awarenessLoggerAdapter');
const AwarenessFileSystemAdapter = require('../infrastructure/adapters/awarenessFileSystemAdapter');
const AwarenessIdGeneratorAdapter = require('../infrastructure/adapters/awarenessIdGeneratorAdapter');
const AwarenessHashGeneratorAdapter = require('../infrastructure/adapters/awarenessHashGeneratorAdapter');

// Import utilities
const { getLogger } = require('../../../../logger');
const safe = require('../../../../helpers/safe');

// Import service interface
const IAwarenessService = require('./IAwarenessService');

class AwarenessService extends IAwarenessService {
    /**
     * @param {Object} adapters - Adapter instances
     * @param {Object} adapters.vscodeAdapter - VS Code adapter implementing IAwarenessVSCodePort
     * @param {Object} adapters.persistenceAdapter - Persistence adapter implementing IAwarenessPersistencePort
     * @param {Object} adapters.messagingAdapter - Messaging adapter implementing IAwarenessMessagingPort (optional)
     */
    constructor({ vscodeAdapter, persistenceAdapter, messagingAdapter = null }) {
        if (!vscodeAdapter) {
            throw new Error('AwarenessService requires vscodeAdapter');
        }
        if (!persistenceAdapter) {
            throw new Error('AwarenessService requires persistenceAdapter');
        }
        
        this.vscodeAdapter = vscodeAdapter;
        this.persistenceAdapter = persistenceAdapter;
        this.messagingAdapter = messagingAdapter; // Optional - events won't be published if not provided
        
        // Create infrastructure adapters for domain entities
        this.loggerAdapter = new AwarenessLoggerAdapter();
        this.fileSystemAdapter = new AwarenessFileSystemAdapter();
        this.idGeneratorAdapter = new AwarenessIdGeneratorAdapter();
        this.hashGeneratorAdapter = new AwarenessHashGeneratorAdapter();
        
        // Optional callbacks for external tracking (e.g., UsageStats)
        this.onAISuggestion = null;
        this.onAISuggestionOutcome = null;
        this.onKeepAll = null;
        this.onDebtCleared = null;
        this.onScoreUpdate = null;
        
        // Internal components (initialized in start())
        this.debtManager = null;
        this.suggestionAggregate = null; // Replaces agentSuggestionHandler
        this.sessionTracker = null;
        this.fileWatcher = null;
        this.changeLedger = null;
        this.eventHandlers = null;
        this.keepAllDetector = null;
        this.scoreCalculator = null;
        
        // State
        this.context = null;
        this.updateFileColorsInExplorer = null;
        this.activeDocument = { value: null };
        this.cursorPosition = { value: null };
        this.disposables = [];
        this.updateTimer = null;
        this.isActive = false;
        
        // Track timers for suggestion status checks
        this.activeStatusCheckTimers = new Set();
    }
    
    /**
     * Set callbacks for external tracking
     * @param {Object} callbacks - Callback functions
     */
    setCallbacks(callbacks = {}) {
        this.onAISuggestion = callbacks.onAISuggestion || null;
        this.onAISuggestionOutcome = callbacks.onAISuggestionOutcome || null;
        this.onKeepAll = callbacks.onKeepAll || null;
        this.onDebtCleared = callbacks.onDebtCleared || null;
        this.onScoreUpdate = callbacks.onScoreUpdate || null;
    }
    
    /**
     * Start monitoring (called when switching to DEV mode)
     * @param {Object} context - VS Code extension context
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors in Explorer
     * @param {string} mode - Current mode ('vibe', 'dev') for classifier config
     */
    async start(context, updateFileColorsInExplorer = null, mode = 'dev') {
        if (!context) {
            throw new Error('AwarenessService.start() called with null/undefined context');
        }
        
        getLogger().log('AwarenessService: Starting real-time monitoring');
        
        // Stop any existing monitoring first
        this.stop();
        
        this.context = context;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.isActive = true;
        
        // Initialize domain entities with ports (adapters are injected as port implementations)
        this.debtManager = new DebtManager(
            this.onScoreUpdate,
            updateFileColorsInExplorer,
            this.persistenceAdapter, // Adapter implements IAwarenessPersistencePort
            this.loggerAdapter // Adapter implements ILoggerPort
        );
        this.debtManager.loadDebt();
        
        this.keepAllDetector = new KeepAllDetector(this.onKeepAll, this.loggerAdapter); // Adapter implements ILoggerPort
        
        this.scoreCalculator = new ScoreCalculator(this.vscodeAdapter, this.loggerAdapter); // Adapters implement ports

        // Create suggestion aggregate (replaces AgentSuggestionHandler)
        this.suggestionAggregate = new SuggestionAggregate(
            this.idGeneratorAdapter,
            this.loggerAdapter
        );
        
        // Create debt cleared callback that publishes event AND calls legacy callback
        const debtClearedCallback = (data) => {
            // Publish domain event
            if (this.messagingAdapter) {
                safe('publishDebtClearedEvent', async () => {
                    const event = new DebtClearedEvent({
                        clearedFiles: data.clearedFiles || [],
                        totalDebtCleared: data.totalDebtCleared || 0
                    });
                    await this.messagingAdapter.publishDebtClearedEvent(event);
                });
            }
            // Call legacy callback for backward compatibility
            if (this.onDebtCleared) {
                this.onDebtCleared(data);
            }
        };

        this.sessionTracker = new SessionTracker(
            this.debtManager,
            this, // Pass service instead of handler (service implements the interface)
            debtClearedCallback,
            () => this.updateScore(),
            updateFileColorsInExplorer,
            this.messagingAdapter // Pass messaging adapter for domain events
        );
        
        this.fileWatcher = new FileWatcher(
            this, // Pass service instead of handler (service implements the interface)
            this.debtManager,
            () => this.updateScore(),
            this.onScoreUpdate,
            this.vscodeAdapter, // Adapter implements IAwarenessVSCodePort
            this.fileSystemAdapter, // Adapter implements IFileSystemPort
            this.loggerAdapter // Adapter implements ILoggerPort
        );
        
        this.changeLedger = new ChangeLedger(
            2000,
            1000,
            this.persistenceAdapter, // Adapter implements IAwarenessPersistencePort
            this.hashGeneratorAdapter, // Adapter implements IHashGeneratorPort
            this.loggerAdapter // Adapter implements ILoggerPort
        );
        
        this.eventHandlers = new EventHandlers(
            this, // Pass service instead of handler (service implements the interface)
            this.debtManager,
            this.sessionTracker,
            this.activeDocument,
            this.cursorPosition,
            mode,
            this.changeLedger,
            {},
            this.vscodeAdapter, // Adapter implements IAwarenessVSCodePort
            this.loggerAdapter // Adapter implements ILoggerPort
        );
        
        // Register event listeners using adapters
        this.disposables.push(
            this.vscodeAdapter.onDidChangeTextDocument((event) => {
                safe('onTextChange', () => this.eventHandlers.onTextChange(event));
            })
        );
        
        this.disposables.push(
            this.vscodeAdapter.onDidCreateFiles((event) => {
                safe('onFilesCreated', () => this.eventHandlers.onFilesCreated(event));
            })
        );
        
        this.disposables.push(
            this.vscodeAdapter.onDidSaveTextDocument((document) => {
                safe('onFileSaved', () => this.eventHandlers.onFileSaved(document));
            })
        );
        
        this.disposables.push(
            this.vscodeAdapter.onDidOpenTextDocument((document) => {
                safe('onFileOpened', () => this.eventHandlers.onFileOpened(document));
            })
        );
        
        this.disposables.push(
            this.vscodeAdapter.onDidCloseTextDocument((document) => {
                safe('onDocumentClose', () => this.eventHandlers.onDocumentClose(document));
            })
        );
        
        this.disposables.push(
            this.vscodeAdapter.onDidChangeTextEditorSelection((event) => {
                safe('onCursorMove', () => this.eventHandlers.onCursorMove(event));
            })
        );
        
        this.disposables.push(
            this.vscodeAdapter.onDidChangeTextEditorVisibleRanges((event) => {
                safe('onScroll', () => this.eventHandlers.onScroll(event));
            })
        );
        
        this.disposables.push(
            this.vscodeAdapter.onDidChangeActiveTextEditor((editor) => {
                safe('onEditorChange', () => this.eventHandlers.onEditorChange(editor));
            })
        );
        
        // Start file watcher
        if (this.fileWatcher) {
            safe('setupFileSystemWatcher', () => {
                this.fileWatcher.setupFileSystemWatcher();
            });
            safe('scanExistingFiles', () => {
                this.fileWatcher.scanExistingFiles();
            });
        }
        
        // Initial score update
        this.updateScore();
        
        // Periodic score updates
        this.updateTimer = setInterval(() => {
            safe('updateScore', () => {
                this.updateScore();
                if (this.sessionTracker) {
                    this.sessionTracker.checkProgress();
                }
            });
        }, 10000);
        
        getLogger().log('AwarenessService: Monitoring started successfully');
    }
    
    /**
     * Stop monitoring (called when switching away from DEV mode)
     */
    async stop() {
        if (!this.isActive) {
            return;
        }
        
        getLogger().log('AwarenessService: Stopping monitoring');
        
        this.isActive = false;
        
        // Save debt before stopping
        if (this.debtManager) {
            safe('saveDebt', () => {
                this.debtManager.saveDebt();
            });
        }
        
        // Dispose all event listeners
        this.disposables.forEach(d => {
            safe('disposeListener', () => {
                if (d && typeof d.dispose === 'function') {
                    d.dispose();
                }
            });
        });
        this.disposables = [];
        
        // Clean up event handlers (flushes classifier)
        if (this.eventHandlers) {
            await safe('disposeEventHandlers', async () => {
                await this.eventHandlers.dispose();
            });
        }
        
        // Flush ledger after classifier flush
        if (this.changeLedger) {
            await safe('flushChangeLedger', async () => {
                await this.changeLedger.flush();
            });
        }
        
        // Clear all status check timers
        for (const timer of this.activeStatusCheckTimers) {
            clearTimeout(timer);
        }
        this.activeStatusCheckTimers.clear();
        
        // Clean up file system watcher
        if (this.fileWatcher) {
            safe('closeFileWatcher', () => {
                this.fileWatcher.close();
            });
        }
        
        // Clear update timer
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        // Clear session tracker (session-specific data only)
        if (this.sessionTracker) {
            safe('clearSessionTracker', () => {
                this.sessionTracker.clear();
            });
        }
        
        // Keep: suggestionAggregate, scoreCalculator, debtManager, keepAllDetector
        // (preserve state for when monitoring restarts)
        
        getLogger().log('AwarenessService: Monitoring stopped');
    }
    
    /**
     * Update awareness score and trigger callbacks
     * Delegates to ScoreCalculator.updateScore() to match AwarenessMonitor behavior
     */
    updateScore() {
        if (!this.isActive || !this.scoreCalculator) {
            return;
        }
        
        const suggestions = this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
        const getDebtScore = () => {
            if (!this.debtManager) return 0;
            return this.debtManager.calculateDebtScore(suggestions);
        };
        const getReviewDebtSummary = () => {
            if (!this.debtManager) {
                return { total: 0, files: [] };
            }
            return this.debtManager.getDebtSummary();
        };
        
        this.scoreCalculator.updateScore(
            suggestions,
            getDebtScore,
            getReviewDebtSummary,
            () => {
                // Publish domain event
                if (this.messagingAdapter) {
                    safe('publishScoreUpdateEvent', async () => {
                        const scoreData = this.scoreCalculator.getScore(suggestions, getReviewDebtSummary);
                        const event = new ScoreUpdateEvent({
                            score: scoreData.total || 0,
                            components: scoreData.components || {},
                            suggestions: scoreData.suggestions || { total: 0, pending: 0, pendingFiles: [] },
                            debt: scoreData.debt || { unreviewedFiles: 0, files: [] }
                        });
                        await this.messagingAdapter.publishScoreUpdateEvent(event);
                    });
                }
                // Call legacy callback for backward compatibility
                if (this.onScoreUpdate) {
                    this.onScoreUpdate();
                }
                if (this.updateFileColorsInExplorer) {
                    this.updateFileColorsInExplorer();
                }
            }
        );
    }
    
    /**
     * Get current awareness score
     * Delegates to ScoreCalculator to match the format expected by UI components
     * @returns {Object} Score data with total, components, suggestions, debt, and debug info
     */
    getScore() {
        if (!this.scoreCalculator) {
            // Return default score if calculator not initialized
            return {
                total: 0,
                components: {},
                suggestions: { total: 0, pending: 0, pendingFiles: [] },
                debt: { unreviewedFiles: 0, files: [] },
                debug: { monitoringActive: false, error: 'ScoreCalculator not initialized' }
            };
        }
        
        const suggestions = this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
        const getReviewDebtSummary = () => {
            if (!this.debtManager) {
                return { total: 0, files: [] };
            }
            return this.debtManager.getDebtSummary();
        };
        
        const score = this.scoreCalculator.getScore(suggestions, getReviewDebtSummary);
        
        // Add monitoringActive to debug info
        if (score.debug) {
            score.debug.monitoringActive = this.updateTimer !== null;
        }
        
        return score;
    }
    
    /**
     * Handle externally created file
     * @param {string} filePath - Path to the externally created file
     */
    handleExternallyCreatedFile(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('handleExternallyCreatedFile() called with invalid filePath');
        }
        
        if (this.fileWatcher) {
            this.fileWatcher.handleExternallyCreatedFile(filePath);
        }
    }

    // ============================================
    // Orchestration Methods (moved from AgentSuggestionHandler)
    // These methods coordinate between aggregate, debtManager, callbacks, etc.
    // ============================================

    /**
     * Record a detected AI suggestion
     * @param {vscode.TextDocument} document - The document
     * @param {vscode.TextDocumentContentChangeEvent} change - The change event
     */
    recordAISuggestion(document, change) {
        if (!this.suggestionAggregate) return;
        
        const uri = document.uri.toString();
        const changeSize = change.text.length;
        
        // Derive fileName from URI for display purposes only
        const fileName = uri.split('/').pop().split('?')[0];
        if (this.loggerAdapter) {
            this.loggerAdapter.debug(`[DEBUG] 📝 AI suggestion: ${changeSize} chars in ${fileName}`);
        }
        
        // Create suggestion entity
        const suggestion = this.suggestionAggregate.createSuggestion({
            document: uri,
            range: change.range,
            text: change.text,
            size: changeSize
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
     * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Batch of changes
     * @param {Object} meta - Optional metadata
     */
    recordAISuggestionBatch(document, aggregatedChanges, meta = {}) {
        if (!this.suggestionAggregate || !aggregatedChanges || aggregatedChanges.length === 0) {
            return;
        }

        const uri = document.uri.toString();
        
        // Calculate merged range (union of all change ranges)
        const start = aggregatedChanges.reduce((min, c) => 
            c.range.start.isBefore(min) ? c.range.start : min, 
            aggregatedChanges[0].range.start
        );
        const end = aggregatedChanges.reduce((max, c) => 
            c.range.end.isAfter(max) ? c.range.end : max, 
            aggregatedChanges[0].range.end
        );
        const Range = this.vscodeAdapter.Range;
        const mergedRange = new Range(start, end);
        
        // Cap merged range span for debt sizing if huge but inserted tiny
        const lineSpan = end.line - start.line;
        const totalInserted = aggregatedChanges.reduce((sum, c) => sum + (c.text?.length || 0), 0);
        const avgInsertedPerLine = lineSpan > 0 ? totalInserted / lineSpan : totalInserted;
        
        let effectiveRange = mergedRange;
        if (lineSpan > 100 && avgInsertedPerLine < 5) {
            const firstChange = aggregatedChanges[0];
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
            this.loggerAdapter.debug(`[DEBUG] 📝 AI suggestion batch: ${aggregatedChanges.length} changes, ${mergedSize} chars in ${fileName}`);
        }

        // Create suggestion entity
        const suggestion = this.suggestionAggregate.createSuggestion({
            document: uri,
            range: mergedRange,
            text: mergedText,
            size: mergedSize,
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
                this.loggerAdapter.error(`AwarenessService: Error processing file ${fileUri.fsPath || fileUri}`, err);
            }
        }
        
        return null;
    }

    /**
     * Record a batch of user edits (might be adapting AI suggestions)
     * @param {vscode.TextDocument} document - The document
     * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Batch of changes
     */
    recordUserEditBatch(document, aggregatedChanges) {
        if (!this.suggestionAggregate || !aggregatedChanges || aggregatedChanges.length === 0) {
            return;
        }
        
        const uri = document.uri.toString();
        const fileName = uri.split('/').pop().split('?')[0];
        
        // Get pending suggestions for this document
        const pendingSuggestions = this.suggestionAggregate.getPendingSuggestionsForFile(uri);
        if (pendingSuggestions.length === 0) {
            return; // No pending suggestions for this document
        }
        
        // Merge ranges
        const sortedRanges = [...aggregatedChanges]
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
     * @param {vscode.TextDocumentContentChangeEvent} change - The change event
     */
    recordUserEdit(document, change) {
        // Convert single change to batch format
        this.recordUserEditBatch(document, [change]);
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
                        
                        if (this.keepAllDetector) {
                            this.keepAllDetector.trackAcceptance(result);
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
                        if (this.isActive) {
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
            this.updateScore();
        } catch (err) {
            if (this.loggerAdapter) {
                this.loggerAdapter.error('AwarenessService: Error checking suggestion status', err);
            }
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
     * Internal helper: Add suggestion to aggregate and track (debt, status check, score update)
     * @private
     */
    _addSuggestionAndTrack(suggestion, contentLength) {
        if (!this.suggestionAggregate) return;
        
        // Add to aggregate
        this.suggestionAggregate.addSuggestion(suggestion);
        
        // Add to debt
        if (this.debtManager) {
            const uri = suggestion.document;
            this.debtManager.addToDebt(uri, contentLength, () => this.updateScore());
        }
        
        // Update file colors immediately when new suggestion is added
        if (this.updateFileColorsInExplorer) {
            this.updateFileColorsInExplorer();
        }
        
        // Schedule status check after 5 seconds
        const timer = setTimeout(() => {
            this.activeStatusCheckTimers.delete(timer);
            if (this.isActive) {
                this.checkSuggestionStatus(suggestion.id);
            }
        }, 5000);
        this.activeStatusCheckTimers.add(timer);
        
        // Immediately update score to reflect new activity
        this.updateScore();
    }
    
    /**
     * Get monitoring status
     * @returns {Object} Status information
     */
    getStatus() {
        const suggestions = this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
        return {
            isActive: this.isActive,
            hasContext: !!this.context,
            hasCallback: !!this.onScoreUpdate,
            hasCallbacks: !!(this.onAISuggestion || this.onAISuggestionOutcome || this.onKeepAll || this.onDebtCleared),
            aiSuggestionsCount: suggestions.length,
            reviewDebtCount: this.debtManager ? this.debtManager.getDebtSize() : 0,
            currentScore: this.scoreCalculator ? this.scoreCalculator.getCurrentScore() : 0,
            scores: this.scoreCalculator ? this.scoreCalculator.getScoreComponents() : {},
            hasFileSystemWatcher: this.fileWatcher ? this.fileWatcher.isActive() : false,
            hasUpdateTimer: !!this.updateTimer,
            watchedDirectories: this.fileWatcher ? this.fileWatcher.getWatchedDirectories() : [],
            workspaceFolders: this.vscodeAdapter.workspaceFolders ? 
                this.vscodeAdapter.workspaceFolders.map(f => f.uri.fsPath) : [],
            recentAcceptances: this.keepAllDetector ? this.keepAllDetector.getRecentAcceptanceCount() : 0
        };
    }
}

module.exports = AwarenessService;

