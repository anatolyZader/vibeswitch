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

// Import app layer utilities (technical/infrastructure operations)
const RangeUtilities = require('./utilities/rangeUtilities');
const UriPathUtilities = require('./utilities/uriPathUtilities');

// Import input layer
const AwarenessEventListener = require('../input/awarenessEventListener');

// Import pure calculation functions (moved from domain services)
const { calculateReviewScore, calculateCriticalScore, calculateAdaptationScore, calculateDebtScore, calculateRiskBasedDebtScore } = require('./scoring/scoreCalculations');

// Import domain aggregates
const SuggestionAggregate = require('../domain/aggregates/suggestionAggregate');

// Import domain utilities
const { rangesOverlap, isPositionInRange: checkPositionInRange } = require('./utilities/vscodeDocUtilities');
const { buildDiffBullets } = require('./utilities/diffBulletService');

// Domain events removed - using callbacks instead for engine-based design

// Import utilities
const { getLogger } = require('../../../../logger');
const safe = require('../../../../safe');

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
        
        // Optional callbacks for external tracking (e.g., UsageStats)
        this.onAISuggestion = null;
        this.onAISuggestionOutcome = null;
        this.onKeepAll = null;
        this.onDebtCleared = null;
        this.onScoreUpdate = null;
        
        // Internal components (initialized in start())
        this.debtService = null;
        this.suggestionAggregate = null; // Replaces agentSuggestionHandler
        this.suggestionLifecycleService = null; // Suggestion lifecycle management (includes review tracking and keep-all detection)
        this.sessionTracker = null;
        // FileWatcherService removed - using VS Code events only
        this.changeLedger = null;
        this.classificationService = null; // Classification service
        this.eventHandlers = null;
        
        // Score state (merged from ScoreService)
        this.currentScore = 0;
        this.scores = {
            review: 0,      // 0-40 points
            critical: 0,    // 0-30 points
            adaptation: 0,  // 0-30 points
            debt: 0         // 0-30 points
        };
        
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
            throw new Error('AwarenessEngine.start() called with null/undefined context');
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
        
        // Score state initialized above in constructor

        // Create suggestion aggregate (replaces AgentSuggestionHandler)
        this.suggestionAggregate = new SuggestionAggregate(
            this.idGeneratorAdapter,
            this.loggerAdapter
        );
        
        // Create debt cleared callback
        const debtClearedCallback = (data) => {
            if (this.onDebtCleared) {
                this.onDebtCleared(data);
            }
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
            instanceId: this.instanceId // Pass instance ID for generation-based cancellation
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

        // Create classification service (self-contained with direct dependencies)
        this.classificationService = new ClassificationService({
            idGeneratorPort: this.idGeneratorAdapter,
            mode: mode,
            debounceMs: 200,
            loggerPort: this.loggerAdapter,
            vscodeAdapter: this.vscodeAdapter,
            changeLedgerService: this.changeLedger,
            suggestionLifecycleService: this.suggestionLifecycleService
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
        
        // Keep: suggestionAggregate, debtService, score state
        // (preserve state for when monitoring restarts)
        // Note: keepAllDetectorService merged into suggestionService
        
        getLogger().log('AwarenessService: Monitoring stopped');
    }
    
    /**
     * Update awareness score and trigger callbacks/events
     * Merged from ScoreService - handles score orchestration inline
     */
    updateScore() {
        if (!this.isActive) {
            return;
        }
        
        const suggestions = this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
        const pendingSuggestions = suggestions.filter(s => s && s.status === 'pending');
        const getDebtScore = () => {
            if (!this.debtService) return 0;
            // Use pure function for debt calculation (moved from domain service)
            const fileDebts = this.debtService.getDebtMap();
            // Use risk-based debt calculation (research-aligned, default)
            // Can fall back to count-based by passing useRiskBased: false
            return this.debtService.calculateDebtScore(pendingSuggestions, { useRiskBased: true });
        };
        const getReviewDebtSummary = () => {
            if (!this.debtService) {
                return { total: 0, files: [] };
            }
            return this.debtService.getDebtSummary();
        };
        
        // Score calculation logic (merged from ScoreService)
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for "recent activity" calculation
        const recentSuggestions = suggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // BUT: If we have older suggestions but no recent ones, and we have review debt,
        // preserve the score based on debt rather than resetting to zero
        const hasOlderSuggestions = suggestions.length > 0 && recentSuggestions.length === 0;
        const debtScore = getDebtScore();
        const hasDebt = debtScore > 0;
        
        // Rate-limited debug logging via logger port
        if (this.loggerAdapter) {
            this.loggerAdapter.debug(`Updating score: ${recentSuggestions.length} recent, ${suggestions.length} total, debt: ${debtScore}`, 'awarenessService:updateScore');
        }
        
        // Only calculate if we have suggestions in the last 10 seconds
        if (recentSuggestions.length === 0) {
            // Even with no recent suggestions, calculate debt score if there's review debt
            if (debtScore > 0) {
                // If there's review debt but no pending, show debt score
                this.currentScore = Math.min(debtScore, 100); // Cap at 100
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
            } else if (hasOlderSuggestions && hasDebt) {
                // We have older suggestions and debt - preserve a minimum score based on debt
                // This prevents the meter from dropping to zero when monitor restarts
                this.currentScore = Math.max(debtScore, 20); // Minimum 20 to show activity
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
            } else {
                // No recent activity and no debt
                // Use explicit state: score of 0 represents "no activity" (not magic value -1)
                this.currentScore = 0;
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            }
            // Trigger callbacks
            this._triggerScoreCallbacks(suggestions, getReviewDebtSummary);
            return;
        }
        
        // Include pending suggestions in score calculation (they count as activity)
        // This ensures meter shows activity even when suggestions are still pending
        const allRecent = recentSuggestions;
        
        // Filter to completed suggestions only for detailed scoring
        const completed = recentSuggestions.filter(s => s.status !== 'pending');
        const pending = recentSuggestions.filter(s => s.status === 'pending');
        
        if (completed.length === 0 && allRecent.length > 0) {
            // Still pending, but we have activity - show partial score based on pending count
            // This ensures meter shows activity instead of "No Activity"
            this.currentScore = 50; // Neutral - pending activity detected
            this.scores = { 
                review: 0, 
                critical: 0, 
                adaptation: 0, 
                debt: debtScore // Still calculate debt
            };
            
            // Trigger callbacks
            this._triggerScoreCallbacks(suggestions, getReviewDebtSummary);
            return;
        }
        
        if (completed.length === 0) {
            // No suggestions at all
            // Use explicit state: score of 0 represents "no activity" (not magic value -1)
            this.currentScore = 0;
            this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            this._triggerScoreCallbacks(suggestions, getReviewDebtSummary);
            return;
        }
        
        // Use pure functions for scoring calculations (moved from domain services)
        // 1. Code Review Rate (40 points)
        this.scores.review = calculateReviewScore(completed);
        
        // 2. Critical Evaluation (30 points)
        this.scores.critical = calculateCriticalScore(completed);
        
        // 3. Code Adaptation (30 points)
        this.scores.adaptation = calculateAdaptationScore(completed);
        
        // 4. Review Debt (30 points)
        this.scores.debt = debtScore;
        
        // Total score (max 130, normalized to 100)
        const rawScore = this.scores.review + 
                        this.scores.critical + 
                        this.scores.adaptation + 
                        this.scores.debt;
        
        this.currentScore = Math.round(Math.min(rawScore, 100));
        
        // Trigger callbacks
        this._triggerScoreCallbacks(suggestions, getReviewDebtSummary);
    }
    
    /**
     * Trigger score update callbacks and events (helper method)
     * @private
     */
    _triggerScoreCallbacks(suggestions, getReviewDebtSummary) {
        // Trigger score update callback
        if (this.onScoreUpdate) {
            this.onScoreUpdate();
        }
        if (this.updateFileColorsInExplorer) {
            this.updateFileColorsInExplorer();
        }
    }
    
    /**
     * Get current awareness score
     * Merged from ScoreService - returns score data with breakdown
     * @returns {Object} Score data with total, components, suggestions, debt, and debug info
     */
    getScore() {
        const suggestions = this.suggestionAggregate ? this.suggestionAggregate.getSuggestions() : [];
        const getReviewDebtSummary = () => {
            if (!this.debtService) {
                return { total: 0, files: [] };
            }
            return this.debtService.getDebtSummary();
        };
        
        const debtSummary = getReviewDebtSummary();
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for score calculation
        const recentSuggestions = suggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // For display: show ALL suggestions (not just last 10 seconds) so meter shows activity
        // But use recentSuggestions for actual score calculation
        const allSuggestions = suggestions;
        
        // Get pending suggestions with file paths
        // const { getRelativePath } = require('./vscodeDocUtilities'); // Commented for consolidation
        const pendingSuggestions = allSuggestions
            .filter(s => s.status === 'pending')
            .map(s => {
                // Extract file path from document URI
                let filePath = null;
                if (s.document) {
                    try {
                        // Use VS Code adapter for URI creation
                        const Uri = this.vscodeAdapter ? this.vscodeAdapter.Uri : null;
                        if (!Uri) {
                            return null; // Skip if no adapter available
                        }
                        const uri = Uri.parse(s.document);
                        if (uri.scheme === 'file') {
                            filePath = uri.fsPath;
                        }
                    } catch (err) {
                        if (this.loggerAdapter) {
                            this.loggerAdapter.error('AwarenessEngine: Error parsing document URI', err);
                        }
                    }
                }
                return {
                    path: filePath ? getRelativePath(filePath) : 'Unknown',
                    fullPath: filePath || '',
                    ageMinutes: Math.round((now - s.timestamp) / (1000 * 60)),
                    type: s.isFileCreation ? 'file creation' : 
                          s.isExternalCreation ? 'external file' :
                          s.isFileWrite ? 'file write' : 'text change'
                };
            })
            .filter(Boolean); // Remove null entries
        
        return {
            total: this.currentScore,
            components: { ...this.scores },
            suggestions: {
                // Show all suggestions for meter display (so it doesn't disappear after 10s)
                total: allSuggestions.length,
                pending: allSuggestions.filter(s => s.status === 'pending').length,
                accepted: allSuggestions.filter(s => s.status === 'accepted').length,
                rejected: allSuggestions.filter(s => s.status === 'rejected').length,
                adapted: allSuggestions.filter(s => s.status === 'adapted').length,
                // Also include recent count for debugging
                recentTotal: recentSuggestions.length,
                // Include pending suggestions with file info
                pendingFiles: pendingSuggestions
            },
            // Review debt information
            debt: {
                unreviewedFiles: debtSummary.total,
                files: debtSummary.files.map(f => ({
                    path: getRelativePath(f.path), // Relative path instead of just filename
                    fullPath: f.path,
                    ageMinutes: Math.round(f.age / (1000 * 60)),
                    modifications: f.modificationCount
                }))
            },
            // Add debug info for troubleshooting
            debug: {
                lastActivity: recentSuggestions.length > 0 ? 
                    new Date(recentSuggestions[recentSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                    (suggestions.length > 0 ? 
                    new Date(suggestions[suggestions.length - 1].timestamp).toLocaleTimeString() : 
                        'None'),
                monitoringActive: this.updateTimer !== null,
                totalDebtEntries: debtSummary.total,
                recentWindowCount: recentSuggestions.length,
                totalTrackedCount: suggestions.length
            }
        };
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
    // Delegation Methods - Delegate to SuggestionService
    // ============================================

    /**
     * Record a detected AI suggestion
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
     * @param {string} suggestionId - ID of the suggestion to check
     */
    async checkSuggestionStatus(suggestionId) {
        if (this.suggestionLifecycleService) {
            await this.suggestionLifecycleService.checkSuggestionStatus(suggestionId);
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
        return {
            isActive: this.isActive,
            hasContext: !!this.context,
            hasCallback: !!this.onScoreUpdate,
            hasCallbacks: !!(this.onAISuggestion || this.onAISuggestionOutcome || this.onKeepAll || this.onDebtCleared),
            aiSuggestionsCount: suggestions.length,
            reviewDebtCount: this.debtService ? this.debtService.getDebtSize() : 0,
            currentScore: this.currentScore,
            scores: { ...this.scores },
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
     * @param {vscode.TextDocument} document - The saved document
     * @returns {boolean} True if file was processed, false otherwise
     */
    handleFileSaved(document) {
        if (!this.suggestionLifecycleService) {
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
        this.suggestionLifecycleService.createSuggestionAndTrack({
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
            // Get document from URI
            const documents = this.vscodeAdapter.getTextDocuments();
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
    
    /**
     * Get relative path from URI (delegates to domain service, passes adapter as port)
     * @param {vscode.Uri} uri - URI to convert
     * @returns {string} Relative path
     */
    asRelativePath(uri) {
        return this.vscodeAdapter.asRelativePath(uri);
    }
    
    /**
     * Get Range constructor (uses app layer utility)
     * @returns {Function} Range constructor
     */
    getRange() {
        return this.vscodeAdapter.Range;
    }
    
    /**
     * Get text documents from workspace (uses app layer utility)
     * @returns {Array<vscode.TextDocument>} Array of text documents
     */
    getTextDocuments() {
        return this.vscodeAdapter.textDocuments || [];
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

module.exports = AwarenessEngine;


