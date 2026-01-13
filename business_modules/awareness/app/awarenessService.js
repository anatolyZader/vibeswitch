/**
 * AwarenessService - Application service for awareness monitoring
 * 
 * Orchestrates business logic for tracking AI-generated code changes and user review activity.
 * This is the application layer that coordinates domain entities and uses adapters.
 */

// Import application services
const DebtService = require('./debtService');
const ChangeLedgerService = require('./changeLedgerService');
const SessionService = require('./sessionService');
const FileWatcherService = require('./fileWatcherService');
const SuggestionService = require('./suggestionService');
const ClassificationService = require('./classificationService');
const ReviewTrackingService = require('./reviewTrackingService');
const TimerRegistry = require('./timerRegistry');

// Import app layer utilities (technical/infrastructure operations)
const VSCodeUtilities = require('./vscodeUtilities');
const RangeUtilities = require('./rangeUtilities');
const UriPathUtilities = require('./uriPathUtilities');

// Import input layer
const AwarenessEventListener = require('../input/awarenessEventListener');

// Import app layer services
const ScoreService = require('./scoreService');
const KeepAllDetectorService = require('./keepAllDetectorService');

// Import domain aggregates
const SuggestionAggregate = require('../domain/aggregates/suggestionAggregate');

// Import domain utilities
const { rangesOverlap, isPositionInRange: checkPositionInRange } = require('../domain/utils/utils');
const { buildDiffBullets } = require('../domain/utils/diffBulletBuilder');

// Import domain events
const AISuggestionEvent = require('../domain/events/aiSuggestionEvent');
const AISuggestionOutcomeEvent = require('../domain/events/aiSuggestionOutcomeEvent');
const ScoreUpdateEvent = require('../domain/events/scoreUpdateEvent');
const KeepAllEvent = require('../domain/events/keepAllEvent');
const DebtClearedEvent = require('../domain/events/debtClearedEvent');
const SuggestionBatchCreatedEvent = require('../domain/events/suggestionBatchCreatedEvent');

// Adapters are now injected via constructor (no imports needed)

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
     * @param {Object} adapters.loggerAdapter - Logger adapter implementing ILoggerPort
     * @param {Object} adapters.fileSystemAdapter - File system adapter implementing IFileSystemPort
     * @param {Object} adapters.idGeneratorAdapter - ID generator adapter implementing IIdGeneratorPort
     * @param {Object} adapters.rangeOperationServiceD - Range operation domain service (domain logic only)
     * @param {Object} adapters.uriPathOperationServiceD - URI/path operation domain service (domain validation only)
     * @param {Object} adapters.suggestionLifecycleServiceD - Suggestion lifecycle domain service
     * @param {Object} adapters.changeClassificationServiceD - Change classification domain service
     * @param {Object} adapters.reviewSessionServiceD - Review session domain service
     * @param {Object} adapters.debtCalculationServiceD - Debt calculation domain service
     * @param {Object} adapters.suggestionBatchServiceD - Suggestion batch domain service
     * @param {Object} adapters.scoreCalculationServiceD - Score calculation domain service
     */
    constructor({ 
        vscodeAdapter, 
        persistenceAdapter, 
        messagingAdapter = null,
        loggerAdapter,
        fileSystemAdapter,
        idGeneratorAdapter,
        hashGeneratorAdapter,
        rangeOperationServiceD,
        uriPathOperationServiceD,
        suggestionLifecycleServiceD,
        changeClassificationServiceD,
        reviewSessionServiceD,
        debtCalculationServiceD,
        suggestionBatchServiceD,
        scoreCalculationServiceD
    }) {
        // Validate required adapters
        if (!vscodeAdapter) {
            throw new Error('AwarenessService requires vscodeAdapter');
        }
        if (!persistenceAdapter) {
            throw new Error('AwarenessService requires persistenceAdapter');
        }
        if (!loggerAdapter) {
            throw new Error('AwarenessService requires loggerAdapter');
        }
        if (!fileSystemAdapter) {
            throw new Error('AwarenessService requires fileSystemAdapter');
        }
        if (!idGeneratorAdapter) {
            throw new Error('AwarenessService requires idGeneratorAdapter');
        }
        if (!hashGeneratorAdapter) {
            throw new Error('AwarenessService requires hashGeneratorAdapter');
        }
        if (!rangeOperationServiceD) {
            throw new Error('AwarenessService requires rangeOperationServiceD');
        }
        if (!uriPathOperationServiceD) {
            throw new Error('AwarenessService requires uriPathOperationServiceD');
        }
        if (!suggestionLifecycleServiceD) {
            throw new Error('AwarenessService requires suggestionLifecycleServiceD');
        }
        if (!changeClassificationServiceD) {
            throw new Error('AwarenessService requires changeClassificationServiceD');
        }
        if (!reviewSessionServiceD) {
            throw new Error('AwarenessService requires reviewSessionServiceD');
        }
        if (!debtCalculationServiceD) {
            throw new Error('AwarenessService requires debtCalculationServiceD');
        }
        if (!suggestionBatchServiceD) {
            throw new Error('AwarenessService requires suggestionBatchServiceD');
        }
        if (!scoreCalculationServiceD) {
            throw new Error('AwarenessService requires scoreCalculationServiceD');
        }
        
        // Store all injected adapters (Ports and Adapters pattern)
        this.vscodeAdapter = vscodeAdapter;
        this.persistenceAdapter = persistenceAdapter;
        this.messagingAdapter = messagingAdapter; // Optional - events won't be published if not provided
        this.loggerAdapter = loggerAdapter;
        this.fileSystemAdapter = fileSystemAdapter;
        this.idGeneratorAdapter = idGeneratorAdapter;
        this.hashGeneratorAdapter = hashGeneratorAdapter;
        
        // Store injected domain services (core domain logic only)
        // Note: Technical utilities (VSCodeUtilities, RangeUtilities, UriPathUtilities) are static classes
        this.rangeOperationServiceD = rangeOperationServiceD; // Domain logic: rangesOverlap, isPositionInRange
        this.uriPathOperationServiceD = uriPathOperationServiceD; // Domain validation: isCodeDocument, isSkippableUri
        this.suggestionLifecycleServiceD = suggestionLifecycleServiceD;
        this.changeClassificationServiceD = changeClassificationServiceD;
        this.reviewSessionServiceD = reviewSessionServiceD;
        this.debtCalculationServiceD = debtCalculationServiceD;
        this.suggestionBatchServiceD = suggestionBatchServiceD;
        this.scoreCalculationServiceD = scoreCalculationServiceD;
        
        // Optional callbacks for external tracking (e.g., UsageStats)
        this.onAISuggestion = null;
        this.onAISuggestionOutcome = null;
        this.onKeepAll = null;
        this.onDebtCleared = null;
        this.onScoreUpdate = null;
        
        // Internal components (initialized in start())
        this.debtService = null;
        this.suggestionAggregate = null; // Replaces agentSuggestionHandler
        this.suggestionService = null; // Suggestion lifecycle management
        this.sessionTracker = null;
        this.reviewTrackingService = null; // Review tracking service
        this.fileWatcher = null;
        this.changeLedger = null;
        this.classificationService = null; // Classification service
        this.eventHandlers = null;
        this.keepAllDetectorService = null;
        this.scoreService = null;
        
        // Centralized timer registry
        this.timerRegistry = new TimerRegistry();
        
        // Instance ID for generation-based timer cancellation (prevents zombie timers)
        this.instanceId = null;
        
        // State
        this.context = null;
        this.updateFileColorsInExplorer = null;
        this.disposables = [];
        this.updateTimer = null;
        this.isActive = false;
        this.activeStatusCheckTimers = new Set(); // Track status check timers for cleanup
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
     * @param {AwarenessController} controller - Awareness controller instance (required for event listener)
     */
    async start(context, updateFileColorsInExplorer = null, mode = 'dev', controller = null) {
        if (!context) {
            throw new Error('AwarenessService.start() called with null/undefined context');
        }
        
        getLogger().log('AwarenessService: Starting real-time monitoring');
        
        // Stop any existing monitoring first
        this.stop();
        
        // Generate new instance ID to invalidate any zombie timers
        this.instanceId = this.idGeneratorAdapter.generateUUID();
        
        this.context = context;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.isActive = true;
        
        // Initialize application services
        this.debtService = new DebtService(
            this.onScoreUpdate,
            updateFileColorsInExplorer,
            this.persistenceAdapter, // Adapter implements IAwarenessPersistencePort
            this.loggerAdapter // Adapter implements ILoggerPort
        );
        this.debtService.loadDebt();
        
        this.keepAllDetectorService = new KeepAllDetectorService(this.onKeepAll, this.loggerAdapter); // Adapter implements ILoggerPort
        
        this.scoreService = new ScoreService(this.scoreCalculationServiceD, this.vscodeAdapter, this.loggerAdapter); // Domain service + adapters

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

        // Create suggestion service for lifecycle management
        this.suggestionService = new SuggestionService({
            suggestionAggregate: this.suggestionAggregate,
            debtService: this.debtService,
            keepAllDetectorService: this.keepAllDetectorService,
            vscodeAdapter: this.vscodeAdapter,
            loggerAdapter: this.loggerAdapter,
            messagingAdapter: this.messagingAdapter,
            updateScore: () => this.updateScore(),
            updateFileColorsInExplorer: updateFileColorsInExplorer,
            onAISuggestion: this.onAISuggestion,
            onAISuggestionOutcome: this.onAISuggestionOutcome,
            onKeepAll: this.onKeepAll,
            activeStatusCheckTimers: this.activeStatusCheckTimers,
            isActive: () => this.isActive,
            instanceId: this.instanceId // Pass instance ID for generation-based cancellation
        });

        this.sessionTracker = new SessionService(
            this.debtService,
            this.suggestionService, // Pass suggestionService
            debtClearedCallback,
            () => this.updateScore(),
            updateFileColorsInExplorer,
            this.messagingAdapter // Pass messaging adapter for domain events
        );

        // Create review tracking service (handles cursor/scroll tracking for suggestions)
        // ReviewTrackingService only emits signals - SuggestionService owns all state mutations
        this.reviewTrackingService = new ReviewTrackingService(
            this.suggestionService,
            this.rangeOperationServiceD,
            this.vscodeAdapter,
            this.loggerAdapter,
            (suggestionId, reviewTime) => {
                // Signal: suggestion was reviewed (dwell time reached)
                // SuggestionService owns the state mutation - single authority
                if (this.suggestionService) {
                    this.suggestionService.markSuggestionAsReviewed(suggestionId, reviewTime);
                }
            },
            (suggestionId) => {
                // Signal: trigger status check (after review state updated)
                // SuggestionService owns the status determination - single authority
                if (this.suggestionService) {
                    this.suggestionService.checkSuggestionStatus(suggestionId);
                }
            },
            this.timerRegistry // Pass timer registry for centralized timer management
        );
        
        // FileWatcherService no longer uses fs.watch - relies on VS Code events only
        this.fileWatcher = new FileWatcherService(
            this.suggestionService, // Pass suggestionService
            this.debtService,
            () => this.updateScore(),
            this.onScoreUpdate,
            this.vscodeAdapter, // Adapter implements IAwarenessVSCodePort
            this.loggerAdapter // Adapter implements ILoggerPort (fileSystemAdapter no longer needed)
        );
        
        this.changeLedger = new ChangeLedgerService(
            2000,
            1000,
            this.persistenceAdapter, // Adapter implements IAwarenessPersistencePort
            this.hashGeneratorAdapter, // Adapter implements IHashGeneratorPort
            this.loggerAdapter // Adapter implements ILoggerPort
        );

        // Create classification service
        this.classificationService = new ClassificationService({
            idGeneratorPort: this.idGeneratorAdapter,
            mode: mode,
            debounceMs: 200,
            loggerPort: this.loggerAdapter,
            vscodeAdapter: this.vscodeAdapter,
            recordChangeBatch: (entry) => this.recordChangeBatch(entry),
            generateDiffBullets: (document, rawChanges, classification) => this.generateDiffBullets(document, rawChanges, classification),
            handleAISuggestionBatch: (document, changes) => this.handleAISuggestionBatch(document, changes),
            handleUserEditBatch: (document, changes) => this.handleUserEditBatch(document, changes)
        });

        // Create event listener in input layer (requires controller)
        if (!controller) {
            throw new Error('AwarenessService.start() requires controller parameter for event listener');
        }
        
        this.eventHandlers = new AwarenessEventListener(
            controller // Pass controller (input layer)
        );
        
        // Register event listeners using app layer utilities (technical operations)
        this.disposables.push(
            VSCodeUtilities.subscribeToTextDocumentChanges(
                this.vscodeAdapter,
                (event) => {
                    safe('onTextChange', () => this.eventHandlers.onTextChange(event));
                }
            )
        );
        
        this.disposables.push(
            VSCodeUtilities.subscribeToFileCreation(
                this.vscodeAdapter,
                (event) => {
                    safe('onFilesCreated', () => this.eventHandlers.onFilesCreated(event));
                }
            )
        );
        
        this.disposables.push(
            VSCodeUtilities.subscribeToFileSave(
                this.vscodeAdapter,
                (document) => {
                    safe('onFileSaved', () => this.eventHandlers.onFileSaved(document));
                }
            )
        );
        
        this.disposables.push(
            VSCodeUtilities.subscribeToFileOpen(
                this.vscodeAdapter,
                (document) => {
                    safe('onFileOpened', () => this.eventHandlers.onFileOpened(document));
                }
            )
        );
        
        this.disposables.push(
            VSCodeUtilities.subscribeToFileClose(
                this.vscodeAdapter,
                (document) => {
                    safe('onDocumentClose', () => this.eventHandlers.onDocumentClose(document));
                }
            )
        );
        
        this.disposables.push(
            VSCodeUtilities.subscribeToCursorMove(
                this.vscodeAdapter,
                (event) => {
                    safe('onCursorMove', () => this.eventHandlers.onCursorMove(event));
                }
            )
        );
        
        this.disposables.push(
            VSCodeUtilities.subscribeToScroll(
                this.vscodeAdapter,
                (event) => {
                    safe('onScroll', () => this.eventHandlers.onScroll(event));
                }
            )
        );
        
        this.disposables.push(
            VSCodeUtilities.subscribeToEditorChange(
                this.vscodeAdapter,
                (editor) => {
                    safe('onEditorChange', () => this.eventHandlers.onEditorChange(editor));
                }
            )
        );
        
        // FileWatcherService setup (NO-OP - fs.watch removed, using VS Code events only)
        // VS Code events (onDidCreateFiles, onDidSaveTextDocument) handle file detection
        if (this.fileWatcher) {
            // setupFileSystemWatcher() and scanExistingFiles() are now NO-OPs
            // They're kept for backward compatibility but do nothing
            // File detection is handled by VS Code events in AwarenessEventListener
        }
        
        // Initial score update
        this.updateScore();
        
        // Periodic score updates (use timer registry)
        this.updateTimer = this.timerRegistry.setInterval(() => {
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
        
        // Save debt before stopping (await to ensure persistence)
        if (this.debtService) {
            await safe('saveDebt', async () => {
                await this.debtService.saveDebt();
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
        
        // Dispose classification service
        if (this.classificationService) {
            safe('disposeClassificationService', () => {
                this.classificationService.dispose();
            });
        }
        
        // Flush ledger after classifier flush
        if (this.changeLedger) {
            await safe('flushChangeLedger', async () => {
                await this.changeLedger.flush();
            });
        }
        
        // Dispose review tracking service (cleans up all dwell timers)
        if (this.reviewTrackingService) {
            this.reviewTrackingService.dispose();
        }
        
        // Clean up file system watcher
        if (this.fileWatcher) {
            safe('closeFileWatcher', () => {
                this.fileWatcher.close();
            });
        }
        
        // Clear all timers through registry (includes updateTimer and all other timers)
        this.timerRegistry.clear();
        this.updateTimer = null;
        
        // Clear all status check timers (zombie timer prevention)
        for (const timer of this.activeStatusCheckTimers) {
            clearTimeout(timer);
        }
        this.activeStatusCheckTimers.clear();
        
        // Invalidate instance ID to prevent any remaining timers from executing
        this.instanceId = null;
        
        // Clear session tracker (session-specific data only)
        if (this.sessionTracker) {
            safe('clearSessionTracker', () => {
                this.sessionTracker.clear();
            });
        }
        
        // Keep: suggestionAggregate, scoreService, debtService, keepAllDetectorService
        // (preserve state for when monitoring restarts)
        
        getLogger().log('AwarenessService: Monitoring stopped');
    }
    
    /**
     * Update awareness score and trigger callbacks
     * Delegates to ScoreService.updateScore() to match AwarenessMonitor behavior
     */
    updateScore() {
        if (!this.isActive || !this.scoreService) {
            return;
        }
        
        const suggestions = this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
        const getDebtScore = () => {
            if (!this.debtService) return 0;
            // Use domain service for proper separation of file-level and suggestion-level debt
            if (this.debtCalculationServiceD) {
                return this.debtService.calculateDebtScoreWithDomainService(suggestions, this.debtCalculationServiceD);
            }
            // Fallback to app-level calculation
            return this.debtService.calculateDebtScore(suggestions);
        };
        const getReviewDebtSummary = () => {
            if (!this.debtService) {
                return { total: 0, files: [] };
            }
            return this.debtService.getDebtSummary();
        };
        
        this.scoreService.updateScore(
            suggestions,
            getDebtScore,
            getReviewDebtSummary,
            () => {
                // Publish domain event
                if (this.messagingAdapter) {
                    safe('publishScoreUpdateEvent', async () => {
                        const scoreData = this.scoreService.getScore(suggestions, getReviewDebtSummary);
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
     * Delegates to ScoreService to match the format expected by UI components
     * @returns {Object} Score data with total, components, suggestions, debt, and debug info
     */
    getScore() {
        if (!this.scoreService) {
            // Return default score if service not initialized
            return {
                total: 0,
                components: {},
                suggestions: { total: 0, pending: 0, pendingFiles: [] },
                debt: { unreviewedFiles: 0, files: [] },
                debug: { monitoringActive: false, error: 'ScoreService not initialized' }
            };
        }
        
        const suggestions = this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
        const getReviewDebtSummary = () => {
            if (!this.debtService) {
                return { total: 0, files: [] };
            }
            return this.debtService.getDebtSummary();
        };
        
        const score = this.scoreService.getScore(suggestions, getReviewDebtSummary);
        
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
    // Delegation Methods - Delegate to SuggestionService
    // ============================================

    /**
     * Record a detected AI suggestion
     * @param {vscode.TextDocument} document - The document
     * @param {vscode.TextDocumentContentChangeEvent} change - The change event
     */
    recordAISuggestion(document, change) {
        if (this.suggestionService) {
            this.suggestionService.recordAISuggestion(document, change);
        }
    }

    /**
     * Record a batch of AI changes as a single suggestion
     * @param {vscode.TextDocument} document - The document
     * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Batch of changes
     * @param {Object} meta - Optional metadata
     */
    recordAISuggestionBatch(document, aggregatedChanges, meta = {}) {
        if (this.suggestionService) {
            this.suggestionService.recordAISuggestionBatch(document, aggregatedChanges, meta);
        }
    }

    /**
     * Process a file as an AI-generated suggestion
     * @param {vscode.Uri} fileUri - URI of the file
     * @param {Object} options - Processing options
     * @returns {Promise<Object|null>} Suggestion entity or null
     */
    async processFileAsSuggestion(fileUri, options = {}) {
        if (this.suggestionService) {
            return await this.suggestionService.processFileAsSuggestion(fileUri, options);
        }
        return null;
    }

    /**
     * Record a batch of user edits (might be adapting AI suggestions)
     * @param {vscode.TextDocument} document - The document
     * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Batch of changes
     */
    recordUserEditBatch(document, aggregatedChanges) {
        if (this.suggestionService) {
            this.suggestionService.recordUserEditBatch(document, aggregatedChanges);
        }
    }

    /**
     * Record user edits (might be adapting AI suggestions)
     * @deprecated Use recordUserEditBatch for batch processing
     * @param {vscode.TextDocument} document - The document
     * @param {vscode.TextDocumentContentChangeEvent} change - The change event
     */
    recordUserEdit(document, change) {
        if (this.suggestionService) {
            this.suggestionService.recordUserEdit(document, change);
        }
    }

    /**
     * Check if suggestion was accepted, rejected, or adapted
     * @param {string} suggestionId - ID of the suggestion to check
     */
    async checkSuggestionStatus(suggestionId) {
        if (this.suggestionService) {
            await this.suggestionService.checkSuggestionStatus(suggestionId);
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
        if (this.suggestionService) {
            return this.suggestionService.createSuggestionAndTrack(options, contentLength);
        }
        return null;
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
            reviewDebtCount: this.debtService ? this.debtService.getDebtSize() : 0,
            currentScore: this.scoreService ? this.scoreService.getCurrentScore() : 0,
            scores: this.scoreService ? this.scoreService.getScoreComponents() : {},
            hasFileSystemWatcher: this.fileWatcher ? this.fileWatcher.isActive() : false,
            hasUpdateTimer: !!this.updateTimer,
            watchedDirectories: this.fileWatcher ? this.fileWatcher.getWatchedDirectories() : [],
            workspaceFolders: VSCodeUtilities.getWorkspaceFolders(this.vscodeAdapter).map(f => f.uri.fsPath),
            recentAcceptances: this.keepAllDetectorService ? this.keepAllDetectorService.getRecentAcceptanceCount() : 0
        };
    }
    
    // ============================================
    // Event Handling Methods - Called by Controller
    // ============================================
    
    /**
     * Classify text document change event
     * @param {vscode.TextDocumentChangeEvent} event - VS Code text document change event
     * @param {Function} onClassified - Callback (document, classification, changes[])
     */
    classifyTextChange(event, onClassified) {
        if (!this.classificationService) {
            return;
        }
        
        this.classificationService.classifyEvent(event, (document, classification, changes) => {
            // Process classification results (handles routing, batch recording, diff bullets)
            this.classificationService.handleClassifiedChanges(document, classification, changes);
            
            // Call the provided callback (for event listener compatibility)
            if (onClassified) {
                onClassified(document, classification, changes);
            }
        });
    }
    
    /**
     * Handle classified changes (delegates to classification service)
     * @param {vscode.TextDocument} document - The document
     * @param {Object} classification - Classification result {label, confidence, reasons, meta}
     * @param {Array<Change>} changes - Array of Change domain entities
     */
    handleClassifiedChanges(document, classification, changes) {
        if (this.classificationService) {
            this.classificationService.handleClassifiedChanges(document, classification, changes);
        }
    }
    
    /**
     * Handle AI suggestion batch (from text change classification)
     * @param {vscode.TextDocument} document - The document
     * @param {Array<Change>} changes - Array of Change domain entities
     */
    handleAISuggestionBatch(document, changes) {
        if (this.suggestionService) {
            this.suggestionService.recordAISuggestionBatch(document, changes);
        }
    }
    
    /**
     * Handle user edit batch (from text change classification)
     * @param {vscode.TextDocument} document - The document
     * @param {Array<Change>} changes - Array of Change domain entities
     */
    handleUserEditBatch(document, changes) {
        if (this.suggestionService) {
            this.suggestionService.recordUserEditBatch(document, changes);
        }
    }
    
    /**
     * Handle file created event
     * @param {vscode.Uri} fileUri - The file URI
     * @param {Object} options - Options
     * @returns {Promise} Promise resolving to suggestion or null
     */
    async handleFileCreated(fileUri, options = {}) {
        if (this.suggestionService) {
            return await this.suggestionService.processFileAsSuggestion(fileUri, options);
        }
        return null;
    }
    
    /**
     * Handle file saved event
     * @param {vscode.TextDocument} document - The saved document
     * @returns {boolean} True if file was processed, false otherwise
     */
    handleFileSaved(document) {
        if (!this.suggestionService) {
            return false;
        }
        
        const content = document.getText();
        
        // Lowered threshold to catch more AI file operations (business logic)
        if (content.length <= 200) {
            return false; // Below threshold, skip
        }
        
        // Fixed: Range math bug - lineCount is 1-based count, but line indices are 0-based
        const lastLine = Math.max(0, document.lineCount - 1);
        const lastLineText = document.lineAt(lastLine).text;
        const lastChar = lastLineText.length;
        
        // Get Range constructor from adapter
        const Range = this.getRange();
        if (!Range) {
            return false; // Cannot create range without Range constructor
        }
        
        // Create range for entire file
        const range = new Range(0, 0, lastLine, lastChar);
        const uri = document.uri.toString();
        
        // Create and track suggestion
        this.suggestionService.createSuggestionAndTrack({
            document: uri,
            range: range,
            text: content,
            size: content.length,
            isFileWrite: true
        }, content.length);
        
        return true; // Successfully processed
    }
    
    /**
     * Get content hash for cache (simple hash for duplicate detection)
     * @param {string} content - Content to hash
     * @returns {string} Hash string
     */
    getContentHash(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }
    
    /**
     * Handle file opened event
     * @param {string} uri - Document URI string
     */
    handleFileOpened(uri) {
        const hasUnreviewedDebt = this.debtService && this.debtService.hasUnreviewedDebt(uri);
        const hasPendingSuggestions = this.suggestionService ? 
            this.suggestionService.hasPendingSuggestions(uri) : false;
        
        if (hasUnreviewedDebt || hasPendingSuggestions) {
            // Initialize review session tracking
            if (this.sessionTracker) {
                this.sessionTracker.initializeSession(uri);
            }
        }
    }
    
    /**
     * Handle cursor move event
     * @param {string} uri - Document URI string
     * @param {vscode.Position} position - Cursor position
     */
    handleCursorMove(uri, position) {
        // Update review tracking for suggestions (dwell time, marking as reviewed)
        if (this.reviewTrackingService) {
            this.reviewTrackingService.onCursorMoved(uri, position);
        }
        
        // Update session tracking for debt (engagement metrics)
        if (this.sessionTracker) {
            this.sessionTracker.updateCursorActivity(uri);
        }
    }
    
    /**
     * Handle scroll event
     * @param {string} uri - Document URI string
     */
    handleScroll(uri) {
        // Update review tracking for suggestions
        if (this.reviewTrackingService) {
            this.reviewTrackingService.onScroll(uri);
        }
        
        // Update session tracking for debt (engagement metrics)
        if (this.sessionTracker) {
            this.sessionTracker.updateScrollActivity(uri);
        }
    }
    
    /**
     * Record change batch in ledger
     * @param {Object} entry - Change ledger entry
     * @returns {string} Batch ID
     */
    recordChangeBatch(entry) {
        if (this.changeLedger) {
            return this.changeLedger.append(entry);
        }
        return null;
    }
    
    /**
     * Update suggestion review time
     * @param {string} suggestionId - Suggestion ID
     * @param {number} reviewTime - Review time in milliseconds
     */
    updateSuggestionReviewTime(suggestionId, reviewTime) {
        if (this.suggestionAggregate) {
            const suggestion = this.suggestionAggregate.findSuggestion(suggestionId);
            if (suggestion) {
                suggestion.reviewTime = reviewTime;
            }
        }
    }
    
    /**
     * Mark suggestion as reviewed (delegates to SuggestionService - single authority)
     * @param {string} suggestionId - Suggestion ID
     * @deprecated Use suggestionService.markSuggestionAsReviewed() directly
     */
    markSuggestionAsReviewed(suggestionId) {
        // Delegate to SuggestionService - it is the single authority for suggestion state
        if (this.suggestionService) {
            this.suggestionService.markSuggestionAsReviewed(suggestionId, 0);
        }
    }
    
    /**
     * Flush pending changes for a document
     * @param {vscode.TextDocument} document - Document to flush
     * @param {Object} options - Flush options
     * @param {string} options.source - Source of flush ('close', 'switch', etc.)
     */
    flushChanges(document, options = {}) {
        if (this.classificationService) {
            this.classificationService.flush(document, options);
        }
    }
    
    /**
     * Flush all pending changes
     * @param {Function} onClassified - Callback for each classified batch
     *   (document, classification, changes[])
     */
    flushAllChanges(onClassified) {
        if (this.classificationService) {
            this.classificationService.flushAll((document, classification, changes) => {
                // Process classification results
                this.classificationService.handleClassifiedChanges(document, classification, changes);
                
                // Call the provided callback
                if (onClassified) {
                    onClassified(document, classification, changes);
                }
            });
        }
    }
    
    /**
     * Generate diff bullets from changes (business logic)
     * @param {vscode.TextDocument} document - Document
     * @param {Array} rawChanges - Raw change objects (for buildDiffBullets compatibility)
     * @param {Object} classification - Classification result
     * @returns {Array<string>} Array of diff bullet strings
     */
    generateDiffBullets(document, rawChanges, classification) {
        if (!this.vscodeAdapter) {
            return [];
        }
        return buildDiffBullets(document, rawChanges, classification, this.vscodeAdapter);
    }
    
    /**
     * Check if position is within range (business logic)
     * @param {vscode.Position} position - Position to check
     * @param {vscode.Range} range - Range to check against
     * @returns {boolean} True if position is within range
     */
    isPositionInRange(position, range) {
        return checkPositionInRange(position, range);
    }
    
    /**
     * Get relative path from URI (delegates to domain service, passes adapter as port)
     * @param {vscode.Uri} uri - URI to convert
     * @returns {string} Relative path
     */
    asRelativePath(uri) {
        return VSCodeUtilities.asRelativePath(this.vscodeAdapter, uri);
    }
    
    /**
     * Get Range constructor (uses app layer utility)
     * @returns {Function} Range constructor
     */
    getRange() {
        return VSCodeUtilities.getRange(this.vscodeAdapter);
    }
    
    /**
     * Get text documents from workspace (uses app layer utility)
     * @returns {Array<vscode.TextDocument>} Array of text documents
     */
    getTextDocuments() {
        return VSCodeUtilities.getTextDocuments(this.vscodeAdapter);
    }
    
    /**
     * Validate if document is a code document (delegates to domain service)
     * @param {vscode.TextDocument} document - Document to validate
     * @returns {boolean} True if document should be processed
     */
    isValidCodeDocument(document) {
        return this.uriPathOperationServiceD.isCodeDocument(this.vscodeAdapter, document);
    }
    
    /**
     * Validate if URI should be processed (delegates to domain service)
     * @param {vscode.Uri|string} uriOrScheme - URI or scheme string
     * @returns {boolean} True if URI should be processed
     */
    isValidUri(uriOrScheme) {
        // For string schemes, check directly
        if (typeof uriOrScheme === 'string' && !uriOrScheme.includes('://')) {
            return !this.uriPathOperationServiceD.isSkippableUri(this.vscodeAdapter, uriOrScheme);
        }
        // For URI objects or URI strings, use domain service
        return !this.uriPathOperationServiceD.isSkippableUri(this.vscodeAdapter, uriOrScheme);
    }
}

module.exports = AwarenessService;

