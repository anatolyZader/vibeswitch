/**
 * APP LAYER - CONSOLIDATED (PART 1/3)
 * 
 * This file contains part 1 of 3 of the app layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 4/13
 * Generated: 2026-01-12T18:19:21.019Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 1/13: app/IAwarenessService.js
// ============================================================================

(function() { // IIFE scope for app/IAwarenessService.js
/**
 * IAwarenessService - Interface for awareness monitoring service
 * 
 * Defines the contract for awareness monitoring operations.
 * This interface allows for different implementations and easier testing.
 */

class IAwarenessService {
    constructor() {
        if (new.target === IAwarenessService) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Set callbacks for external tracking (backward compatibility)
     * @param {Object} callbacks - Callback functions
     */
    setCallbacks(callbacks = {}) {
        throw new Error('Method not implemented.');
    }

    /**
     * Start monitoring (called when switching to DEV mode)
     * @param {Object} context - VS Code extension context
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors in Explorer
     * @param {string} mode - Current mode ('vibe', 'dev') for classifier config
     */
    async start(context, updateFileColorsInExplorer = null, mode = 'dev') {
        throw new Error('Method not implemented.');
    }

    /**
     * Stop monitoring (called when switching away from DEV mode)
     */
    async stop() {
        throw new Error('Method not implemented.');
    }

    /**
     * Update awareness score and trigger callbacks/events
     */
    updateScore() {
        throw new Error('Method not implemented.');
    }

    /**
     * Get current awareness score
     * @returns {Object} Score data with total, components, suggestions, debt, and debug info
     */
    getScore() {
        throw new Error('Method not implemented.');
    }

    /**
     * Handle externally created file
     * @param {string} filePath - Path to the externally created file
     */
    handleExternallyCreatedFile(filePath) {
        throw new Error('Method not implemented.');
    }

    /**
     * Get monitoring status
     * @returns {Object} Status information
     */
    getStatus() {
        throw new Error('Method not implemented.');
    }
}

// module.exports = IAwarenessService; // Commented for consolidation


})(); // End IIFE for app/IAwarenessService.js


// ============================================================================
// FILE 2/13: app/awarenessService.js
// ============================================================================

(function() { // IIFE scope for app/awarenessService.js
/**
 * AwarenessService - Application service for awareness monitoring
 * 
 * Orchestrates business logic for tracking AI-generated code changes and user review activity.
 * This is the application layer that coordinates domain entities and uses adapters.
 */

// Import application services
// const DebtService = require('./debtService'); // Commented for consolidation
// const ChangeLedgerService = require('./changeLedgerService'); // Commented for consolidation
// const SessionService = require('./sessionService'); // Commented for consolidation
// const FileWatcherService = require('./fileWatcherService'); // Commented for consolidation
// const SuggestionService = require('./suggestionService'); // Commented for consolidation
// const ClassificationService = require('./classificationService'); // Commented for consolidation
// const ReviewTrackingService = require('./reviewTrackingService'); // Commented for consolidation
// const TimerRegistry = require('./timerRegistry'); // Commented for consolidation

// Import app layer utilities (technical/infrastructure operations)
// const VSCodeUtilities = require('./vscodeUtilities'); // Commented for consolidation
// const RangeUtilities = require('./rangeUtilities'); // Commented for consolidation
// const UriPathUtilities = require('./uriPathUtilities'); // Commented for consolidation

// Import input layer
// const AwarenessEventListener = require('../input/awarenessEventListener'); // Commented for consolidation

// Import domain services
// const ScoreCalculator = require('../domain/services/scoreCalculator'); // Commented for consolidation
// const KeepAllDetector = require('../domain/services/keepAllDetector'); // Commented for consolidation
// EventSubscriptionDService and VSCodeWorkspaceDService are now injected via constructor (created in extension.js)

// Import domain aggregates
// const SuggestionAggregate = require('../domain/aggregates/suggestionAggregate'); // Commented for consolidation

// Import domain utilities
// const { rangesOverlap, isPositionInRange: checkPositionInRange } = require('../domain/utils/utils'); // Commented for consolidation
// const { buildDiffBullets } = require('../domain/utils/diffBulletBuilder'); // Commented for consolidation

// Import domain events
// const AISuggestionEvent = require('../domain/events/aiSuggestionEvent'); // Commented for consolidation
// const AISuggestionOutcomeEvent = require('../domain/events/aiSuggestionOutcomeEvent'); // Commented for consolidation
// const ScoreUpdateEvent = require('../domain/events/scoreUpdateEvent'); // Commented for consolidation
// const KeepAllEvent = require('../domain/events/keepAllEvent'); // Commented for consolidation
// const DebtClearedEvent = require('../domain/events/debtClearedEvent'); // Commented for consolidation
// const SuggestionBatchCreatedEvent = require('../domain/events/suggestionBatchCreatedEvent'); // Commented for consolidation

// Adapters are now injected via constructor (no imports needed)

// Import utilities
// const { getLogger } = require('../../../../logger'); // Commented for consolidation
// const safe = require('../../../../helpers/safe'); // Commented for consolidation

// Import service interface
// const IAwarenessService = require('./IAwarenessService'); // Commented for consolidation

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
        suggestionBatchServiceD
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
        this.keepAllDetector = null;
        this.scoreCalculator = null;
        
        // Centralized timer registry
        this.timerRegistry = new TimerRegistry();
        
        // State
        this.context = null;
        this.updateFileColorsInExplorer = null;
        this.disposables = [];
        this.updateTimer = null;
        this.isActive = false;
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

        // Create suggestion service for lifecycle management
        this.suggestionService = new SuggestionService({
            suggestionAggregate: this.suggestionAggregate,
            debtService: this.debtService,
            keepAllDetector: this.keepAllDetector,
            vscodeAdapter: this.vscodeAdapter,
            loggerAdapter: this.loggerAdapter,
            messagingAdapter: this.messagingAdapter,
            updateScore: () => this.updateScore(),
            updateFileColorsInExplorer: updateFileColorsInExplorer,
            onAISuggestion: this.onAISuggestion,
            onAISuggestionOutcome: this.onAISuggestionOutcome,
            onKeepAll: this.onKeepAll,
            activeStatusCheckTimers: this.activeStatusCheckTimers,
            isActive: () => this.isActive
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
        this.reviewTrackingService = new ReviewTrackingService(
            this.suggestionService,
            this.rangeOperationServiceD,
            this.vscodeAdapter,
            this.loggerAdapter,
            (suggestionId) => {
                // Callback when suggestion is reviewed
                this.markSuggestionAsReviewed(suggestionId);
            },
            (suggestionId) => {
                // Callback to trigger status check
                if (this.suggestionService) {
                    this.suggestionService.checkSuggestionStatus(suggestionId);
                }
            },
            this.timerRegistry // Pass timer registry for centralized timer management
        );
        
        this.fileWatcher = new FileWatcherService(
            this.suggestionService, // Pass suggestionService
            this.debtService,
            () => this.updateScore(),
            this.onScoreUpdate,
            this.vscodeAdapter, // Adapter implements IAwarenessVSCodePort
            this.fileSystemAdapter, // Adapter implements IFileSystemPort
            this.loggerAdapter // Adapter implements ILoggerPort
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
        
        // Clear session tracker (session-specific data only)
        if (this.sessionTracker) {
            safe('clearSessionTracker', () => {
                this.sessionTracker.clear();
            });
        }
        
        // Keep: suggestionAggregate, scoreCalculator, debtService, keepAllDetector
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
            if (!this.debtService) return 0;
            return this.debtService.calculateDebtScore(suggestions);
        };
        const getReviewDebtSummary = () => {
            if (!this.debtService) {
                return { total: 0, files: [] };
            }
            return this.debtService.getDebtSummary();
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
            if (!this.debtService) {
                return { total: 0, files: [] };
            }
            return this.debtService.getDebtSummary();
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
            currentScore: this.scoreCalculator ? this.scoreCalculator.getCurrentScore() : 0,
            scores: this.scoreCalculator ? this.scoreCalculator.getScoreComponents() : {},
            hasFileSystemWatcher: this.fileWatcher ? this.fileWatcher.isActive() : false,
            hasUpdateTimer: !!this.updateTimer,
            watchedDirectories: this.fileWatcher ? this.fileWatcher.getWatchedDirectories() : [],
            workspaceFolders: VSCodeUtilities.getWorkspaceFolders(this.vscodeAdapter).map(f => f.uri.fsPath),
            recentAcceptances: this.keepAllDetector ? this.keepAllDetector.getRecentAcceptanceCount() : 0
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
     * Mark suggestion as reviewed
     * @param {string} suggestionId - Suggestion ID
     */
    markSuggestionAsReviewed(suggestionId) {
        if (this.suggestionAggregate) {
            const suggestion = this.suggestionAggregate.findSuggestion(suggestionId);
            if (suggestion) {
                suggestion.reviewed = true;
            }
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

// module.exports = AwarenessService; // Commented for consolidation


})(); // End IIFE for app/awarenessService.js


// ============================================================================
// FILE 3/13: app/changeLedgerService.js
// ============================================================================

(function() { // IIFE scope for app/changeLedgerService.js
/**
 * ChangeLedgerService - Application service for managing change ledger
 * 
 * Manages persistence, buffering, and orchestration of change ledger entries.
 * This is an application service that handles infrastructure concerns.
 */

class ChangeLedgerService {
    /**
     * @param {number} maxEntries - Maximum entries to keep (default: 2000)
     * @param {number} flushIntervalMs - Flush interval in milliseconds (default: 1000)
     * @param {IAwarenessPersistencePort} persistencePort - Persistence port (interface, required)
     * @param {IHashGeneratorPort} hashGeneratorPort - Hash generator port (interface, required)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(maxEntries = 2000, flushIntervalMs = 1000, persistencePort, hashGeneratorPort, loggerPort = null) {
        if (!persistencePort) {
            throw new Error('ChangeLedgerService requires persistencePort');
        }
        if (!hashGeneratorPort) {
            throw new Error('ChangeLedgerService requires hashGeneratorPort');
        }
        
        this.persistencePort = persistencePort;
        this.hashGeneratorPort = hashGeneratorPort;
        this.loggerPort = loggerPort;
        this.maxEntries = maxEntries;
        this.key = 'vibeswitch.changeLedger.v1';
        this.ckKey = 'vibeswitch.changeLedger.checkpoint.v1';
        
        // Fix: In-memory buffer for batched writes
        this._memEntries = null; // Lazy load on first access
        this._dirty = false;
        this._flushTimer = null;
        this._flushIntervalMs = flushIntervalMs;
        this._flushPending = false; // Mutex for flush operations
        this._flushQueued = false; // Flag to queue another flush if one is pending
        
        // Fix: Default checkpoint to activation time (not 0) to avoid dumping full history
        this._activationTime = Date.now();
    }

    _load() {
        if (this._memEntries === null) {
            // Use persistence port for loading
            this._memEntries = this.persistencePort.loadSync(this.key) || [];
        }
        return this._memEntries;
    }

    async _flush() {
        // Mutex: prevent concurrent flushes, but queue another if needed
        if (this._flushPending) {
            this._flushQueued = true; // Mark that we need another flush after this one
            return;
        }
        
        if (!this._dirty || !this._memEntries) {
            return;
        }
        
        this._flushPending = true;
        try {
            // Trim old entries if over limit
            if (this._memEntries.length > this.maxEntries) {
                this._memEntries.splice(0, this._memEntries.length - this.maxEntries);
            }
            
            // Use persistence port for saving
            await this.persistencePort.save(this.key, this._memEntries);
            this._dirty = false;
        } finally {
            this._flushPending = false;
            
            // Fix: If another flush was queued or dirty flag set, flush again
            if (this._flushQueued || this._dirty) {
                this._flushQueued = false;
                // Fix: Use queueMicrotask for smoother scheduling (avoids starving if flush work piles up)
                // queueMicrotask is available in Node.js and VS Code extension host
                if (typeof queueMicrotask === 'function') {
                    queueMicrotask(() => this._flush().catch(err => {
                        if (this.loggerPort) {
                            this.loggerPort.error('ChangeLedgerService: Queued flush error', err);
                        }
                    }));
                } else {
                    // Fallback for older Node versions
                    Promise.resolve().then(() => this._flush().catch(err => {
                        if (this.loggerPort) {
                            this.loggerPort.error('ChangeLedgerService: Queued flush error', err);
                        }
                    }));
                }
            }
        }
    }

    _scheduleFlush() {
        // Fix: If timer already scheduled, don't reset it (coalesce to earliest flush)
        // This reduces timer churn and ensures we don't delay flushes unnecessarily
        if (this._flushTimer) {
            return; // Keep existing scheduled flush
        }
        
        this._flushTimer = setTimeout(() => {
            this._flushTimer = null; // Clear timer ref
            this._flush().catch(err => {
                // Log but don't throw - ledger writes shouldn't crash the extension
                if (this.loggerPort) {
                    this.loggerPort.error('ChangeLedgerService: Flush error', err);
                }
            });
        }, this._flushIntervalMs);
    }

    _generateBatchId() {
        // Use hash generator port for ID generation (use hash of timestamp + random)
        const random = Math.random().toString(36).substring(2, 15);
        const timestamp = Date.now().toString();
        return this.hashGeneratorPort.createHash('md5', timestamp + random).substring(0, 36);
    }

    append(entry) {
        const entries = this._load();
        let batchId = entry.batchId;
        
        // Fix: Generate batchId if not provided and kind is 'batch'
        if (entry.kind === 'batch' && !batchId) {
            batchId = this._generateBatchId();
            entry.batchId = batchId;
        }
        
        // Fix: Auto-link diff_bullets to most recent batch if batchId not provided
        // Prefer URI match first (handles multi-root workspaces), then fallback to file
        if (entry.kind === 'diff_bullets' && !batchId) {
            // Find most recent batch entry matching URI first, then file
            for (let i = entries.length - 1; i >= 0; i--) {
                if (entries[i].kind === 'batch') {
                    // Prefer URI match (handles multi-root workspaces, remote URIs)
                    if (entry.uri && entries[i].uri === entry.uri) {
                        batchId = entries[i].batchId;
                        entry.batchId = batchId;
                        break;
                    }
                    // Fallback to file match (for backwards compatibility)
                    if (!batchId && entry.file && entries[i].file === entry.file) {
                        batchId = entries[i].batchId;
                        entry.batchId = batchId;
                        // Don't break - continue to find URI match if available
                    }
                }
            }
            
            // Fix: Invariant check in dev - log error if still no batchId found
            if (!batchId && process.env.NODE_ENV !== 'production' && this.loggerPort) {
                const recentTail = entries.slice(-5).map(e => `${e.kind}:${e.uri || e.file || 'unknown'}`).join(', ');
                this.loggerPort.log(`ChangeLedgerService: diff_bullets entry missing batchId for ${entry.uri || entry.file || 'unknown'}. Recent entries: ${recentTail}`);
            }
        }
        
        entries.push({
            ...entry,
            ts: entry.ts || Date.now()
        });
        
        this._dirty = true;
        this._scheduleFlush();
        
        return batchId;
    }

    async flush() {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }
        await this._flush();
    }

    async checkpointNow(options = {}) {
        const checkpoint = {
            ts: Date.now(),
            reason: options.reason || 'markReviewed',
            mode: options.mode || 'dev',
            workspaceFolder: options.workspaceFolder || null
        };
        
        // Use persistence port for saving checkpoint
        await this.persistencePort.save(this.ckKey, checkpoint);
    }

    getCheckpoint() {
        // Use persistence port for loading checkpoint
        const checkpoint = this.persistencePort.loadSync(this.ckKey) || null;
        
        // Fix: If checkpoint is 0 or missing, use activation time
        if (!checkpoint) {
            return { ts: this._activationTime, reason: 'activation' };
        }
        
        // Handle legacy numeric checkpoints
        if (typeof checkpoint === 'number') {
            return { ts: checkpoint, reason: 'legacy' };
        }
        
        return checkpoint;
    }

    getSinceCheckpoint() {
        const checkpoint = this.getCheckpoint();
        const since = checkpoint ? checkpoint.ts : this._activationTime;
        return this._load().filter(e => e.ts > since);
    }

    getAll() {
        return this._load();
    }

    async clear() {
        this._memEntries = [];
        this._dirty = true;
        await this.flush();
        // Use persistence port for saving
        await this.persistencePort.save(this.ckKey, null);
    }

    async dispose() {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }
        await this.flush();
    }
}

// module.exports = ChangeLedgerService; // Commented for consolidation

})(); // End IIFE for app/changeLedgerService.js


// ============================================================================
// FILE 4/13: app/classificationService.js
// ============================================================================

(function() { // IIFE scope for app/classificationService.js
/**
 * ClassificationService - Application service for change classification
 * 
 * Orchestrates all classification-related business logic:
 * - Manages the ChangeClassifier lifecycle
 * - Converts raw VS Code changes to Change domain entities
 * - Handles classification configuration
 * - Processes classification results (routing, batch recording, diff bullets)
 * - Provides a clean interface for classification workflow
 */

// const ChangeClassifier = require('../domain/utils/changeClassifier'); // Commented for consolidation
// const Change = require('../domain/entities/change'); // Commented for consolidation
// const IIdGeneratorPort = require('../domain/ports/IIdGeneratorPort'); // Commented for consolidation
// const ILoggerPort = require('../domain/ports/ILoggerPort'); // Commented for consolidation
// const { buildDiffBullets } = require('../domain/utils/diffBulletBuilder'); // Commented for consolidation

class ClassificationService {
    /**
     * @param {IIdGeneratorPort} idGeneratorPort - ID generator port for creating change IDs
     * @param {string} mode - Current mode ('vibe', 'dev') for classifier config
     * @param {number} debounceMs - Debounce window in milliseconds (default: 200)
     * @param {ILoggerPort} loggerPort - Logger port (optional)
     * @param {IAwarenessVSCodePort} vscodeAdapter - VS Code adapter (required for handleClassifiedChanges)
     * @param {Function} recordChangeBatch - Function to record change batches (required for handleClassifiedChanges)
     * @param {Function} generateDiffBullets - Function to generate diff bullets (optional, uses default if not provided)
     * @param {Function} handleAISuggestionBatch - Function to handle AI suggestion batches (required for handleClassifiedChanges)
     * @param {Function} handleUserEditBatch - Function to handle user edit batches (required for handleClassifiedChanges)
     */
    constructor({
        idGeneratorPort,
        mode = 'dev',
        debounceMs = 200,
        loggerPort = null,
        vscodeAdapter = null,
        recordChangeBatch = null,
        generateDiffBullets: generateDiffBulletsFn = null,
        handleAISuggestionBatch = null,
        handleUserEditBatch = null
    }) {
        if (!idGeneratorPort) {
            throw new Error('ClassificationService requires idGeneratorPort');
        }
        
        this.idGeneratorPort = idGeneratorPort;
        this.loggerPort = loggerPort;
        this.mode = mode;
        this.vscodeAdapter = vscodeAdapter;
        this.recordChangeBatch = recordChangeBatch;
        this.generateDiffBulletsFn = generateDiffBulletsFn;
        this.handleAISuggestionBatch = handleAISuggestionBatch;
        this.handleUserEditBatch = handleUserEditBatch;
        
        // Get classification configuration for mode
        const classifierConfig = this._getClassifierConfig(mode);
        
        // Create change classifier
        this.changeClassifier = new ChangeClassifier(debounceMs, classifierConfig);
    }
    
    /**
     * Get classification configuration for mode
     * @param {string} mode - Current mode ('vibe', 'dev')
     * @returns {Object} Configuration object
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
            rapidScatteredEventCount: 8, // Minimum events in window
            rapidScatteredRangeCount: 6, // Minimum distinct line ranges
            rapidScatteredMinSize: 50, // Minimum total size
            rapidBurstChangeCount: 10, // Minimum changes for rapid burst branch
            // Behavioral inference mode: use heuristics as primary, markers as strong signal when present
            markerOnly: false
        };
        
        // VIBE: more permissive (lower thresholds) - behavioral inference enabled
        if (mode === 'vibe') {
            return {
                ...baseConfig,
                pureInsertionSize: 15,
                largeInsertionThreshold: 80,
                aiMultiLineSize: 40,
                rapidScatteredEventCount: 6, // Lower threshold for vibe mode
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
     * Convert raw VS Code changes to Change domain entities
     * @param {Array} rawChanges - Array of TextDocumentContentChangeEvent objects
     * @param {string} documentUri - Document URI string
     * @param {string} batchId - Optional batch ID
     * @returns {Array<Change>} Array of Change entities
     */
    _convertToChangeEntities(rawChanges, documentUri, batchId = null) {
        return rawChanges.map((rawChange, index) => {
            const changeId = this.idGeneratorPort.generateId();
            const timestamp = Date.now();
            
            return new Change(
                changeId,
                documentUri,
                rawChange.range,
                rawChange.text || '',
                rawChange.rangeLength || 0,
                timestamp,
                { batchId }
            );
        });
    }
    
    /**
     * Classify a text document change event
     * @param {vscode.TextDocumentChangeEvent} event - VS Code text document change event
     * @param {Function} onClassified - Callback function (document, classification, changes[])
     *   - document: vscode.TextDocument
     *   - classification: {label, confidence, reasons, meta}
     *   - changes: Array<Change> - Domain entities
     */
    classifyEvent(event, onClassified) {
        if (!event || !event.contentChanges || event.contentChanges.length === 0) {
            return;
        }
        
        const documentUri = event.document.uri.toString();
        
        // Register with classifier - it will debounce and call our callback
        this.changeClassifier.addEvent(event, (document, classification, rawChanges) => {
            // Convert raw changes to Change domain entities
            const changes = this._convertToChangeEntities(rawChanges, documentUri);
            
            // Classify each change entity
            changes.forEach(change => {
                change.classify(classification);
            });
            
            // Call the provided callback with domain entities
            if (onClassified) {
                onClassified(document, classification, changes);
            }
        });
    }
    
    /**
     * Handle classified changes (orchestrates all post-classification logic)
     * @param {vscode.TextDocument} document - The document
     * @param {Object} classification - Classification result {label, confidence, reasons, meta}
     * @param {Array<Change>} changes - Array of Change domain entities
     */
    handleClassifiedChanges(document, classification, changes) {
        const isAI = classification.label === 'ai';
        const isFormatter = classification.label === 'formatter';
        
        // Convert Change entities to raw format for buildDiffBullets (if needed)
        const rawChanges = changes.map(change => ({
            range: change.range,
            text: change.text,
            rangeLength: change.rangeLength
        }));
        
        // DIFF bullet tracking: record batch event and generate bullets
        const uri = document.uri.toString();
        const file = this.vscodeAdapter ? this.vscodeAdapter.asRelativePath(document.uri) : document.uri.toString();
        const inserted = changes.reduce((sum, c) => sum + c.size, 0);
        const deleted = changes.reduce((sum, c) => sum + c.deletedSize, 0);
        
        // Calculate line span and distinct range count
        const startLines = changes.map(c => c.range.start.line);
        const endLines = changes.map(c => c.range.end.line);
        const minLine = Math.min(...startLines, ...endLines);
        const maxLine = Math.max(...startLines, ...endLines);
        const lineSpan = maxLine - minLine;
        
        // Count distinct ranges (by start line for simplicity)
        const distinctRanges = new Set(changes.map(c => c.range.start.line));
        const distinctRangeCount = distinctRanges.size;
        
        // Record change batch
        if (this.recordChangeBatch) {
            const batchId = this.recordChangeBatch({
                ts: Date.now(),
                uri,
                file,
                label: classification.label,
                confidence: classification.confidence,
                reasons: classification.reasons,
                changeCount: changes.length,
                inserted,
                deleted,
                lineSpan,
                distinctRangeCount,
                kind: 'batch'
            });
            
            // Generate and record DIFF bullet skeletons (explicitly linked via batchId)
            const bullets = this._generateDiffBullets(document, rawChanges, classification);
            if (bullets.length > 0) {
                this.recordChangeBatch({
                    ts: Date.now(),
                    uri,
                    file,
                    kind: 'diff_bullets',
                    batchId, // Fix: Explicit link to batch entry
                    bullets
                });
            }
        }
        
        // Route based on classification
        if (isAI) {
            const totalSize = changes.reduce((sum, c) => sum + c.size, 0);
            const reasonsStr = classification.reasons.join('; ');
            if (this.loggerPort) {
                this.loggerPort.log(
                    `AwarenessMonitor: ✅ AI change detected (confidence=${(classification.confidence * 100).toFixed(0)}%): size=${totalSize}, changes=${changes.length}, reasons=[${reasonsStr}], file=${document.fileName}`,
                    false,
                    false,
                    `aiDetected:${uri}`
                );
            }
            // Record as single batch suggestion (not per-change)
            // This prevents dozens of "pending suggestions" from a single AI refactor
            // Pass Change entities directly (optimized - preserves classification metadata)
            if (this.handleAISuggestionBatch) {
                this.handleAISuggestionBatch(document, changes);
            }
        } else if (isFormatter) {
            // Formatters should not mark AI suggestions as adapted
            // Treat formatter detection as "neutral" - don't call recordUserEdit
            // This prevents auto-formatters from accidentally marking AI suggestions as adapted
            if (this.loggerPort) {
                this.loggerPort.log(
                    `AwarenessMonitor: 🔧 Formatter detected: ${classification.reasons.join('; ')}`,
                    false,
                    false,
                    `formatterDetected:${uri}`
                );
            }
            // Don't record formatter edits - they're not user edits and shouldn't affect suggestion status
        } else if (classification.label === 'user') {
            // Only record user edits for explicit 'user' label, not 'unknown'
            // Unknown means we couldn't determine origin - don't assume it's user
            // Pass Change entities directly
            if (this.handleUserEditBatch) {
                this.handleUserEditBatch(document, changes);
            }
        } else {
            // Unknown label - don't record as user edits (could be AI we missed, or ambiguous)
            // Ledger will still capture it for audit trail, but don't mark suggestions as adapted
        }
    }
    
    /**
     * Generate diff bullets from changes
     * @param {vscode.TextDocument} document - Document
     * @param {Array} rawChanges - Raw change objects (for buildDiffBullets compatibility)
     * @param {Object} classification - Classification result
     * @returns {Array<string>} Array of diff bullet strings
     */
    _generateDiffBullets(document, rawChanges, classification) {
        if (this.generateDiffBulletsFn) {
            return this.generateDiffBulletsFn(document, rawChanges, classification);
        }
        
        // Fallback to default implementation
        if (this.vscodeAdapter) {
            return buildDiffBullets(document, rawChanges, classification, this.vscodeAdapter);
        }
        
        return [];
    }
    
    /**
     * Flush pending changes for a document
     * @param {vscode.TextDocument} document - Document to flush
     * @param {Object} options - Flush options
     * @param {string} options.source - Source of flush ('close', 'switch', etc.)
     */
    flush(document, options = {}) {
        this.changeClassifier.flush(document, options);
    }
    
    /**
     * Flush all pending changes
     * @param {Function} onClassified - Callback for each classified batch
     *   (document, classification, changes[])
     */
    flushAll(onClassified) {
        this.changeClassifier.flushAll((document, classification, rawChanges) => {
            const documentUri = document.uri.toString();
            const changes = this._convertToChangeEntities(rawChanges, documentUri);
            
            // Classify each change entity
            changes.forEach(change => {
                change.classify(classification);
            });
            
            // Call the provided callback with domain entities
            if (onClassified) {
                onClassified(document, classification, changes);
            }
        });
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        if (this.changeClassifier) {
            this.changeClassifier.clear();
        }
    }
    
    /**
     * Get classification statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        return this.changeClassifier ? this.changeClassifier.getStatistics() : null;
    }
}

// module.exports = ClassificationService; // Commented for consolidation

})(); // End IIFE for app/classificationService.js

