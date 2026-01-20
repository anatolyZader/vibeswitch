/**
 * AwarenessEngine - Central orchestrator for awareness monitoring
 * 
 * The engine coordinates all operations for tracking AI-generated code changes and user review activity.
 * This is the central orchestrator that coordinates domain entities, app services, and adapters.
 */

// Import application services
const DebtService = require('./debt/debtService');
const ChangeLedgerService = require('./persistence/changeLedgerService');
const SessionService = require('./sessions/sessionService');
const SuggestionLifecycleService = require('./suggestions/suggestionLifecycleService');
const ClassificationService = require('./classificationService');
const TimerRegistry = require('./utilities/timerRegistry');

const AwarenessEventListener = require('../input/awarenessEventListener');

const ScoreService = require('./scoring/scoreService');

// Import domain aggregates
const SuggestionAggregate = require('../domain/aggregates/suggestionAggregate');

const { isPositionInRange: checkPositionInRange, getRelativePath } = require('./utilities/vscodeDocUtilities');
const { buildDiffBullets } = require('./utilities/diffBulletService');

// Domain events removed - using callbacks instead for engine-based design

// Import utilities
const safe = require('../../../safe');

class AwarenessEngine {
    /**
     * @param {Object} adapters - Adapter instances
     * @param {Object} adapters.vscodeAdapter - VS Code adapter implementing IAwarenessVSCodePort
     * @param {Object} adapters.persistenceAdapter - Persistence adapter implementing IAwarenessPersistencePort
     * @param {Object} adapters.loggerAdapter - Logger adapter implementing ILoggerPort
     * @param {Object} adapters.idGeneratorAdapter - ID generator adapter implementing IIdGeneratorPort
     * @param {Object} adapters.hashGeneratorAdapter - Hash generator adapter implementing IHashGeneratorPort
     * @param {Object} adapters.rangeOperationServiceD - Range operation domain service (domain logic only)
     * @param {Object} adapters.uriPathOperationServiceD - URI/path operation domain service (domain validation only)
     */
    constructor({ 
        vscodeAdapter, 
        persistenceAdapter, 
        loggerAdapter,
        idGeneratorAdapter,
        hashGeneratorAdapter,
        rangeOperationServiceD,
        uriPathOperationServiceD
    }) {
        // Validate required adapters
        if (!vscodeAdapter) {
            throw new Error('AwarenessEngine requires vscodeAdapter');
        }
        if (!persistenceAdapter) {
            throw new Error('AwarenessEngine requires persistenceAdapter');
        }
        if (!loggerAdapter) {
            throw new Error('AwarenessEngine requires loggerAdapter');
        }
        if (!idGeneratorAdapter) {
            throw new Error('AwarenessEngine requires idGeneratorAdapter');
        }
        if (!hashGeneratorAdapter) {
            throw new Error('AwarenessEngine requires hashGeneratorAdapter');
        }
        if (!rangeOperationServiceD) {
            throw new Error('AwarenessEngine requires rangeOperationServiceD');
        }
        if (!uriPathOperationServiceD) {
            throw new Error('AwarenessEngine requires uriPathOperationServiceD');
        }
        
        // Store all injected adapters (Ports and Adapters pattern)
        this.vscodeAdapter = vscodeAdapter;
        this.persistenceAdapter = persistenceAdapter;
        this.loggerAdapter = loggerAdapter;
        this.idGeneratorAdapter = idGeneratorAdapter;
        this.hashGeneratorAdapter = hashGeneratorAdapter;
        
        // Store injected domain services (core domain logic only)
        // Note: Technical utilities (VSCodeUtilities, RangeUtilities, UriPathUtilities) are static classes
        this.rangeOperationServiceD = rangeOperationServiceD; // Domain logic: rangesOverlap, isPositionInRange
        this.uriPathOperationServiceD = uriPathOperationServiceD; // Domain validation: isCodeDocument, isSkippableUri
        
        // Optional callbacks for external tracking (e.g., UsageStats, UI updates)
        // Initialized via setCallbacks() method
        
        // Internal components (initialized in start())
        this.debtService = null;
        this.suggestionAggregate = null; // Replaces agentSuggestionHandler
        this.suggestionLifecycleService = null; // Suggestion lifecycle management (includes review tracking and keep-all detection)
        this.sessionTracker = null;
        // FileWatcherService removed - using VS Code events only
        this.changeLedger = null;
        this.classificationService = null; // Classification service (determines AI/user/formatter)
        this.scoreService = null; // Score service (calculates and stores awareness metrics)
        this.eventHandlers = null;
        
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

        // Optional LLM enrichment (wired from composition root)
        this.llmInsightService = null;
        this.llmInsightStore = null;
    }

    /**
     * Wire LLM services (optional).
     * Kept as a setter to avoid forcing the awareness module to construct llm dependencies.
     */
    setLLMServices({ insightService = null, insightStore = null } = {}) {
        this.llmInsightService = insightService;
        this.llmInsightStore = insightStore;
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
        
        // Lifecycle state machine: 'stopped' | 'starting' | 'running' | 'stopping'
        this.state = 'stopped';
    }
    
    /**
     * Start monitoring (called when switching to DEV mode)
     * @param {Object} context - VS Code extension context
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors in Explorer
     * @param {string} mode - Current mode ('vibe', 'dev') for classifier config
     */
    async start(context, updateFileColorsInExplorer = null, mode = 'dev') {
        if (!context) {
            throw new Error('AwarenessEngine.start() called with null/undefined context');
        }
        
        // State machine: prevent re-entrancy
        if (this.state === 'starting') {
            return;
        }
        if (this.state === 'stopping') {
            // Wait for stop to complete before starting
            while (this.state === 'stopping') {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        if (this.state === 'running') {
            // Already running, stop first
            await this.stop();
        }
        
        this.state = 'starting';
        
        if (this.loggerAdapter) {
            this.loggerAdapter.log('AwarenessService: Starting real-time monitoring');
        }
        
        // Stop any existing monitoring first (CRITICAL: await to prevent race conditions)
        await this.stop();
        
        // Generate new instance ID to invalidate any zombie timers
        this.instanceId = this.idGeneratorAdapter.generateUUID();
        
        // Provide getter for instance ID (allows services to check current generation)
        this.getInstanceId = () => this.instanceId;
        
        this.context = context;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.isActive = true;
        this.state = 'running';
        
        // Initialize application services
        this.debtService = new DebtService(
            this.onScoreUpdate,
            updateFileColorsInExplorer,
            this.persistenceAdapter, // Adapter implements IAwarenessPersistencePort
            this.loggerAdapter, // Adapter implements ILoggerPort
            this.llmInsightStore ? this.llmInsightStore.getSemanticRiskMultiplier.bind(this.llmInsightStore) : null
        );
        this.debtService.loadDebt();
        
        // Score state initialized above in constructor

        // Create suggestion aggregate (replaces AgentSuggestionHandler)
        this.suggestionAggregate = new SuggestionAggregate(
            this.idGeneratorAdapter,
            this.loggerAdapter
        );
        
        // Create debt cleared callback
        const debtClearedCallback = (data) => {
            safe('onDebtCleared', () => this.onDebtCleared?.(data));
        };

        // Create suggestion service for lifecycle management (includes review tracking and keep-all detection)
        this.suggestionLifecycleService = new SuggestionLifecycleService({
            suggestionAggregate: this.suggestionAggregate,
            debtService: this.debtService,
            vscodeAdapter: this.vscodeAdapter,
            loggerAdapter: this.loggerAdapter,
            rangeOperationServiceD: this.rangeOperationServiceD,
            timerRegistry: this.timerRegistry,
            updateScore: () => this.updateScore(),
            updateFileColorsInExplorer: updateFileColorsInExplorer,
            onAISuggestion: this.onAISuggestion,
            onAISuggestionOutcome: this.onAISuggestionOutcome,
            onKeepAll: this.onKeepAll,
            isActive: () => this.isActive,
            getInstanceId: this.getInstanceId // Pass getter for generation-based cancellation
        });

        this.sessionTracker = new SessionService(
            this.debtService,
            this.suggestionLifecycleService, // Pass suggestionService
            debtClearedCallback,
            () => this.updateScore(),
            updateFileColorsInExplorer
        );
        
        // FileWatcherService removed - VS Code events handle file detection
        
        this.changeLedger = new ChangeLedgerService(
            2000,
            1000,
            this.persistenceAdapter, // Adapter implements IAwarenessPersistencePort
            this.hashGeneratorAdapter, // Adapter implements IHashGeneratorPort
            this.loggerAdapter // Adapter implements ILoggerPort
        );

        // Create score service (calculates awareness metrics from suggestions and debt)
        this.scoreService = new ScoreService(this.loggerAdapter);

        // Create classification service (self-contained with direct dependencies)
        // Note: Classification determines AI/user/formatter, scoring calculates awareness metrics
        this.classificationService = new ClassificationService({
            idGeneratorPort: this.idGeneratorAdapter,
            mode: mode,
            debounceMs: 200,
            loggerPort: this.loggerAdapter,
            vscodeAdapter: this.vscodeAdapter,
            changeLedgerService: this.changeLedger,
            suggestionLifecycleService: this.suggestionLifecycleService,
            llmInsightService: this.llmInsightService,
            // LLM insights are eventual enrichment; when they arrive, recompute score + refresh UI.
            onInsightUpdate: () => this.updateScore()
        });

        // Create event listener in input layer (passes self as engine)
        this.eventHandlers = new AwarenessEventListener(
            this // Pass engine instance (input layer delegates to engine)
        );
        
        // Register event listeners using app layer utilities (technical operations)
        // Subscribe to VS Code events directly (VSCodeUtilities removed)
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
        
        // File detection handled by VS Code events (onDidCreateFiles, onDidSaveTextDocument)
        
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
        
        if (this.loggerAdapter) {
            this.loggerAdapter.log('AwarenessService: Monitoring started successfully');
        }
    }
    
    /**
     * Stop monitoring (called when switching away from DEV mode)
     * Safe to call multiple times (idempotent)
     */
    async stop() {
        if (this.state === 'stopped' || this.state === 'stopping') {
            return; // Already stopped or stopping
        }
        
        this.state = 'stopping';
        
        if (this.loggerAdapter) {
            this.loggerAdapter.log('AwarenessService: Stopping monitoring');
        }
        
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
        
        // Dispose suggestion service (cleans up review tracking and keep-all detection)
        if (this.suggestionLifecycleService) {
            this.suggestionLifecycleService.dispose();
        }
        
        // Clean up file system watcher
        // FileWatcherService removed - no cleanup needed
        
        // Clear all timers through registry (includes updateTimer, status checks, and all other timers)
        this.timerRegistry.clear();
        this.updateTimer = null;
        
        // Invalidate instance ID to prevent any remaining timers from executing
        this.instanceId = null;
        
        // Clear session tracker (session-specific data only)
        if (this.sessionTracker) {
            safe('clearSessionTracker', () => {
                this.sessionTracker.clear();
            });
        }
        
        // Note: We recreate services on start() for clean state
        // This ensures no zombie timers or stale references
        // State is preserved through persistence (debtService.saveDebt/loadDebt)
        
        this.state = 'stopped';
        
        if (this.loggerAdapter) {
            this.loggerAdapter.log('AwarenessService: Monitoring stopped');
        }
    }
    
    /**
     * Update awareness score and trigger callbacks/events
     * Delegates to ScoreService for calculation logic
     */
    updateScore() {
        if (!this.isActive || !this.scoreService) {
            return;
        }
        
        const suggestions = this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
        
        // Calculate score using ScoreService (uses default 10-second window)
        // ScoreService now stores state internally (single source of truth)
        const scoreResult = this.scoreService.calculateScore({
            suggestions,
            debtService: this.debtService
        });
        
        // Trigger callbacks (get state from ScoreService)
        this._triggerScoreCallbacks(suggestions);
    }
    
    /**
     * Trigger score update callbacks and events (helper method)
     * @private
     */
    _triggerScoreCallbacks(suggestions) {
        // Get current score state from ScoreService (single source of truth)
        const scoreState = this.scoreService ? this.scoreService.getScoreState() : { currentScore: 0, scores: { review: 0, critical: 0, adaptation: 0, debt: 0 } };
        
        // Trigger score update callback with safe error handling and payload
        safe('onScoreUpdate', () => this.onScoreUpdate?.({
            currentScore: scoreState.currentScore,
            scores: scoreState.scores,
            suggestionsCount: suggestions.length
        }));
        safe('updateFileColors', () => this.updateFileColorsInExplorer?.());
    }
    
    /**
     * Get current awareness score
     * Delegates to ScoreService for data formatting
     * @returns {Object} Score data with total, components, suggestions, debt, and debug info
     */
    getScore() {
        if (!this.scoreService) {
            return {
                total: 0,
                components: { review: 0, critical: 0, adaptation: 0, debt: 0 },
                suggestions: { total: 0, pending: 0, accepted: 0, rejected: 0, adapted: 0, recentTotal: 0, pendingFiles: [] },
                debt: { unreviewedFiles: 0, files: [] },
                debug: { lastActivity: 'None', monitoringActive: false, totalDebtEntries: 0, recentWindowCount: 0, totalTrackedCount: 0 }
            };
        }
        
        const suggestions = this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
        
        // Get current score state from ScoreService (single source of truth)
        const scoreState = this.scoreService.getScoreState();
        
        const result = this.scoreService.getScoreData({
            suggestions,
            debtService: this.debtService,
            currentScore: scoreState.currentScore,
            scores: scoreState.scores,
            vscodeAdapter: this.vscodeAdapter,
            updateTimer: this.updateTimer
        });
        return result;
    }
    
    /**
     * Handle externally created file
     * @param {string} filePath - Path to the externally created file
     */
    handleExternallyCreatedFile(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('handleExternallyCreatedFile() called with invalid filePath');
        }
        
        // FileWatcherService removed - handle via VS Code events
        // If needed, can call suggestionLifecycleService.processFileAsSuggestion directly
        if (this.suggestionLifecycleService) {
            const Uri = this.vscodeAdapter.Uri;
            const fileUri = Uri.file(filePath);
            this.suggestionLifecycleService.processFileAsSuggestion(fileUri, {
                isFileCreation: true,
                isExternalCreation: true,
                filePath: filePath
            }).catch(err => {
                if (this.loggerAdapter) {
                    this.loggerAdapter.error('AwarenessEngine: Error processing externally created file', err);
                }
            });
        }
    }

    // ============================================
    // Public API: Delegation Methods
    // ============================================
    // These methods are part of the public API contract.
    // They delegate to internal services but provide a stable interface for:
    // - AwarenessEventListener (input layer)
    // - External callers that need to interact with suggestions
    // 
    // Rationale: The engine acts as a facade, hiding internal service structure
    // while providing a clean, stable API for event handlers and external code.

    /**
     * Record a detected AI suggestion
     * @public
     * @param {vscode.TextDocument} document - The document
     * @param {vscode.TextDocumentContentChangeEvent} change - The change event
     */
    recordAISuggestion(document, change) {
        if (this.suggestionLifecycleService) {
            this.suggestionLifecycleService.recordAISuggestion(document, change);
        }
    }

    /**
     * Record a batch of AI changes as a single suggestion
     * @public
     * @param {vscode.TextDocument} document - The document
     * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Batch of changes
     * @param {Object} meta - Optional metadata
     */
    recordAISuggestionBatch(document, aggregatedChanges, meta = {}) {
        if (this.suggestionLifecycleService) {
            this.suggestionLifecycleService.recordAISuggestionBatch(document, aggregatedChanges, meta);
        }
    }

    /**
     * Process a file as an AI-generated suggestion
     * @public
     * @param {vscode.Uri} fileUri - URI of the file
     * @param {Object} options - Processing options
     * @returns {Promise<Object|null>} Suggestion entity or null
     */
    async processFileAsSuggestion(fileUri, options = {}) {
        if (this.suggestionLifecycleService) {
            return await this.suggestionLifecycleService.processFileAsSuggestion(fileUri, options);
        }
        return null;
    }

    /**
     * Record a batch of user edits (might be adapting AI suggestions)
     * @public
     * @param {vscode.TextDocument} document - The document
     * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Batch of changes
     */
    recordUserEditBatch(document, aggregatedChanges) {
        if (this.suggestionLifecycleService) {
            this.suggestionLifecycleService.recordUserEditBatch(document, aggregatedChanges);
        }
    }

    /**
     * Record user edits (might be adapting AI suggestions)
     * @public
     * @deprecated Use recordUserEditBatch for batch processing
     * @param {vscode.TextDocument} document - The document
     * @param {vscode.TextDocumentContentChangeEvent} change - The change event
     */
    recordUserEdit(document, change) {
        if (this.suggestionLifecycleService) {
            this.suggestionLifecycleService.recordUserEdit(document, change);
        }
    }

    /**
     * Check if suggestion was accepted, rejected, or adapted
     * @public
     * @param {string} suggestionId - ID of the suggestion to check
     */
    async checkSuggestionStatus(suggestionId) {
        if (this.suggestionLifecycleService) {
            await this.suggestionLifecycleService.checkSuggestionStatus(suggestionId);
        }
    }

    /**
     * Get all suggestions
     * @public
     * @returns {Array} Array of suggestions
     */
    getSuggestions() {
        return this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
    }

    /**
     * Get suggestions by status
     * @public
     * @param {string} status - Status to filter by
     * @returns {Array} Filtered suggestions
     */
    getSuggestionsByStatus(status) {
        return this.suggestionAggregate ? this.suggestionAggregate.getSuggestionsByStatus(status) : [];
    }

    /**
     * Check if file has pending suggestions
     * @public
     * @param {string} documentUri - Document URI string
     * @returns {boolean} True if file has pending suggestions
     */
    hasPendingSuggestions(documentUri) {
        return this.suggestionAggregate ? this.suggestionAggregate.hasPendingSuggestions(documentUri) : false;
    }

    /**
     * Get pending suggestions for a file
     * @public
     * @param {string} documentUri - Document URI string
     * @returns {Array} Array of pending suggestions
     */
    getPendingSuggestionsForFile(documentUri) {
        return this.suggestionAggregate ? this.suggestionAggregate.getPendingSuggestionsForFile(documentUri) : [];
    }

    /**
     * Create a suggestion and add it to tracking
     * @public
     * @param {Object} options - Suggestion properties
     * @param {number} contentLength - Length of content
     * @returns {Suggestion} Created suggestion entity
     */
    createSuggestionAndTrack(options, contentLength) {
        if (this.suggestionLifecycleService) {
            return this.suggestionLifecycleService.createSuggestionAndTrack(options, contentLength);
        }
        return null;
    }
    
    /**
     * Get monitoring status
     * @returns {Object} Status information
     */
    getStatus() {
        const suggestions = this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
        
        // Get current score state from ScoreService (single source of truth)
        const scoreState = this.scoreService ? this.scoreService.getScoreState() : { currentScore: 0, scores: { review: 0, critical: 0, adaptation: 0, debt: 0 } };
        
        return {
            isActive: this.isActive,
            hasContext: !!this.context,
            hasCallback: !!this.onScoreUpdate,
            hasCallbacks: !!(this.onAISuggestion || this.onAISuggestionOutcome || this.onKeepAll || this.onDebtCleared),
            aiSuggestionsCount: suggestions.length,
            reviewDebtCount: this.debtService ? this.debtService.getDebtSize() : 0,
            currentScore: scoreState.currentScore,
            scores: { ...scoreState.scores },
            hasFileSystemWatcher: false, // FileWatcherService removed - using VS Code events only
            hasUpdateTimer: !!this.updateTimer,
            watchedDirectories: [], // FileWatcherService removed
            workspaceFolders: (this.vscodeAdapter.workspaceFolders || []).map(f => f.uri.fsPath),
            recentAcceptances: this.suggestionLifecycleService ? this.suggestionLifecycleService.getRecentAcceptanceCount() : 0
        };
    }
    
    // ============================================
    // Event Handling Methods - Called by Controller
    // ============================================
    
    /**
     * Classify text document change event
     * Delegates directly to classification service (no wrapper needed)
     * @param {vscode.TextDocumentChangeEvent} event - VS Code text document change event
     * @param {Function} onClassified - Optional callback (document, classification, changes[])
     */
    classifyTextChange(event, onClassified) {
        if (!this.classificationService) {
            return;
        }
        // ClassificationService now handles everything automatically (records batch, routes to handlers)
        this.classificationService.classifyEvent(event, onClassified);
    }
    
    // Note: handleAISuggestionBatch and handleUserEditBatch removed
    // ClassificationService now calls suggestionLifecycleService directly
    
    /**
     * Handle file created event
     * @param {vscode.Uri} fileUri - The file URI
     * @param {Object} options - Options
     * @returns {Promise} Promise resolving to suggestion or null
     */
    
    async handleFileCreated(fileUri, options = {}) {
        if (this.suggestionLifecycleService) {
            return await this.suggestionLifecycleService.processFileAsSuggestion(fileUri, options);
        }
        return null;
    }
    
    /**
     * Handle file saved event
     * Delegates to SuggestionLifecycleService (business logic moved to service)
     * @param {vscode.TextDocument} document - The saved document
     * @param {Object} options - Optional metadata for save processing
     * @returns {boolean} True if file was processed, false otherwise
     */
    handleFileSaved(document, options = {}) {
        if (this.suggestionLifecycleService) {
            return this.suggestionLifecycleService.handleFileSaved(document, options);
        }
        return false;
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
        const hasPendingSuggestions = this.suggestionLifecycleService ? 
            this.suggestionLifecycleService.hasPendingSuggestions(uri) : false;
        
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
        if (this.suggestionLifecycleService) {
            this.suggestionLifecycleService.onCursorMoved(uri, position);
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
        if (this.suggestionLifecycleService) {
            this.suggestionLifecycleService.onScroll(uri);
        }
        
        // Update session tracking for debt (engagement metrics)
        if (this.sessionTracker) {
            this.sessionTracker.updateScrollActivity(uri);
        }
    }
    
    /**
     * Handle active editor change
     * Flushes classifier for previous document before switching
     * @param {vscode.TextEditor} editor - The active editor (can be null/undefined)
     * @param {string|null} previousActiveDocumentUri - Previous document URI string
     */
    handleEditorChange(editor, previousActiveDocumentUri) {
        // Flush previous document if it exists
        if (previousActiveDocumentUri && this.vscodeAdapter) {
            // Get document from URI (use consistent adapter API)
            const documents = this.getTextDocuments();
            const previousDocument = documents.find(doc => doc.uri.toString() === previousActiveDocumentUri);
            
            if (previousDocument) {
                // Flush with source='switch' to indicate editor switch
                this.flushChanges(previousDocument, { source: 'switch' });
            }
        }
        
        // Track as file opened if new editor has debt
        if (editor && editor.document) {
            this.handleFileOpened(editor.document.uri.toString());
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
     * @deprecated Use suggestionLifecycleService.markSuggestionAsReviewed() directly
     */
    markSuggestionAsReviewed(suggestionId) {
        // Delegate to SuggestionService - it is the single authority for suggestion state
        if (this.suggestionLifecycleService) {
            this.suggestionLifecycleService.markSuggestionAsReviewed(suggestionId, 0);
        }
    }
    
    /**
     * Flush pending changes for a document
     * Delegates directly to classification service
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
     * Delegates directly to classification service (handles classified changes automatically)
     * @param {Function} onClassified - Optional callback for each classified batch
     *   (document, classification, changes[])
     */
    flushAllChanges(onClassified) {
        if (this.classificationService) {
            // ClassificationService.flushAll() now automatically handles classified changes
            this.classificationService.flushAll(onClassified);
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
    
    // ============================================
    // Public API: Utility Wrapper Methods
    // ============================================
    // These methods provide convenient access to adapter functionality.
    // They are part of the public API and used by:
    // - ClassificationService (asRelativePath)
    // - Internal engine methods (getRange, getTextDocuments)
    // - Domain services (isValidCodeDocument, isValidUri)
    //
    // Rationale: These wrappers provide a stable interface that hides
    // adapter implementation details and provides convenient access patterns.

    /**
     * Get relative path from URI
     * @public
     * @param {vscode.Uri} uri - URI to convert
     * @returns {string} Relative path
     */
    asRelativePath(uri) {
        return this.vscodeAdapter.asRelativePath(uri);
    }
    
    /**
     * Get Range constructor
     * @public
     * @returns {Function} Range constructor
     */
    getRange() {
        return this.vscodeAdapter.Range;
    }
    
    /**
     * Get text documents from workspace
     * @public
     * @returns {Array<vscode.TextDocument>} Array of text documents
     */
    getTextDocuments() {
        return this.vscodeAdapter.textDocuments || [];
    }
    
    /**
     * Validate if document is a code document
     * @public
     * @param {vscode.TextDocument} document - Document to validate
     * @returns {boolean} True if document should be processed
     */
    isValidCodeDocument(document) {
        // Domain service expects the document only (older signature mistakenly passed vscodeAdapter)
        return this.uriPathOperationServiceD.isCodeDocument(document);
    }
    
    /**
     * Validate if URI should be processed
     * @public
     * @param {vscode.Uri|string} uriOrScheme - URI or scheme string
     * @returns {boolean} True if URI should be processed
     */
    isValidUri(uriOrScheme) {
        // For string schemes, check directly
        if (typeof uriOrScheme === 'string' && !uriOrScheme.includes('://')) {
            // Domain service expects URI (object) or URI string; for raw scheme strings, pass through.
            return !this.uriPathOperationServiceD.isSkippableUri(uriOrScheme);
        }
        // For URI objects or URI strings, use domain service
        return !this.uriPathOperationServiceD.isSkippableUri(uriOrScheme);
    }
}

module.exports = AwarenessEngine;


