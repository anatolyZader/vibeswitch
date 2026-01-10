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
const EventService = require('./eventService');
const SuggestionService = require('./suggestionService');

// Import domain services
const ScoreCalculator = require('../domain/services/scoreCalculator');
const KeepAllDetector = require('../domain/services/keepAllDetector');

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
        this.debtService = null;
        this.suggestionAggregate = null; // Replaces agentSuggestionHandler
        this.suggestionService = null; // Suggestion lifecycle management
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

        this.eventHandlers = new EventService(
            this.suggestionService, // Pass suggestionService
            this.debtService,
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
        if (this.debtService) {
            safe('saveDebt', () => {
                this.debtService.saveDebt();
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
            workspaceFolders: this.vscodeAdapter.workspaceFolders ? 
                this.vscodeAdapter.workspaceFolders.map(f => f.uri.fsPath) : [],
            recentAcceptances: this.keepAllDetector ? this.keepAllDetector.getRecentAcceptanceCount() : 0
        };
    }
}

module.exports = AwarenessService;

