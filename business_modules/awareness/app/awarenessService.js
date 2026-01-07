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
const AgentSuggestionHandler = require('../domain/entities/agentSuggestionHandler');
const SessionTracker = require('../domain/entities/sessionTracker');
const FileWatcher = require('../domain/entities/fileWatcher');
const EventHandlers = require('../domain/entities/eventHandlers');
const KeepAllDetector = require('../domain/entities/keepAllDetector');

// Import utilities
const { getLogger } = require('../../../../logger');
const safe = require('../../../../helpers/safe');

class AwarenessService {
    /**
     * @param {Object} adapters - Adapter instances
     * @param {Object} adapters.vscodeAdapter - VS Code adapter implementing IVSCodePort
     * @param {Object} adapters.persistenceAdapter - Persistence adapter implementing IPersistencePort
     */
    constructor({ vscodeAdapter, persistenceAdapter }) {
        if (!vscodeAdapter) {
            throw new Error('AwarenessService requires vscodeAdapter');
        }
        if (!persistenceAdapter) {
            throw new Error('AwarenessService requires persistenceAdapter');
        }
        
        this.vscodeAdapter = vscodeAdapter;
        this.persistenceAdapter = persistenceAdapter;
        
        // Optional callbacks for external tracking (e.g., UsageStats)
        this.onAISuggestion = null;
        this.onAISuggestionOutcome = null;
        this.onKeepAll = null;
        this.onDebtCleared = null;
        this.onScoreUpdate = null;
        
        // Internal components (initialized in start())
        this.debtManager = null;
        this.agentSuggestionHandler = null;
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
        
        // Initialize domain entities with adapters
        this.debtManager = new DebtManager(
            context,
            this.onScoreUpdate,
            updateFileColorsInExplorer,
            this.persistenceAdapter
        );
        this.debtManager.loadDebt();
        
        this.keepAllDetector = new KeepAllDetector(this.onKeepAll);
        
        this.scoreCalculator = new ScoreCalculator(this.vscodeAdapter);
        
        this.agentSuggestionHandler = new AgentSuggestionHandler(
            this.debtManager,
            () => this.updateScore(),
            {
                onAISuggestion: this.onAISuggestion,
                onAISuggestionOutcome: this.onAISuggestionOutcome
            },
            (suggestion) => this.keepAllDetector ? this.keepAllDetector.trackAcceptance(suggestion) : null,
            updateFileColorsInExplorer,
            this.vscodeAdapter
        );
        
        this.sessionTracker = new SessionTracker(
            this.debtManager,
            this.agentSuggestionHandler,
            this.onDebtCleared,
            () => this.updateScore(),
            updateFileColorsInExplorer
        );
        
        this.fileWatcher = new FileWatcher(
            this.agentSuggestionHandler,
            this.debtManager,
            () => this.updateScore(),
            this.onScoreUpdate,
            this.vscodeAdapter
        );
        
        this.changeLedger = new ChangeLedger(
            context,
            2000,
            1000,
            this.persistenceAdapter
        );
        
        this.eventHandlers = new EventHandlers(
            this.agentSuggestionHandler,
            this.debtManager,
            this.sessionTracker,
            this.activeDocument,
            this.cursorPosition,
            mode,
            this.changeLedger,
            {},
            this.vscodeAdapter
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
            this.vscodeAdapter.onDidChangeTextEditorSelection((event) => {
                safe('onSelectionChange', () => this.eventHandlers.onSelectionChange(event));
            })
        );
        
        this.disposables.push(
            this.vscodeAdapter.onDidChangeActiveTextEditor((editor) => {
                safe('onActiveEditorChange', () => this.eventHandlers.onActiveEditorChange(editor));
            })
        );
        
        // Start file watcher
        if (this.fileWatcher) {
            this.fileWatcher.start();
        }
        
        // Initial score update
        this.updateScore();
        
        // Periodic score updates
        this.updateTimer = setInterval(() => {
            safe('updateScore', () => this.updateScore());
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
        
        // Dispose agent suggestion handler to clear timers
        if (this.agentSuggestionHandler) {
            safe('disposeAgentSuggestionHandler', () => {
                this.agentSuggestionHandler.dispose();
            });
        }
        
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
        
        // Keep: agentSuggestionHandler, scoreCalculator, debtManager, keepAllDetector
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
        
        const suggestions = this.agentSuggestionHandler ? this.agentSuggestionHandler.getSuggestions() : [];
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
                // Callback when score updates
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
        
        const suggestions = this.agentSuggestionHandler ? this.agentSuggestionHandler.getSuggestions() : [];
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
    
    /**
     * Get monitoring status
     * @returns {Object} Status information
     */
    getStatus() {
        const suggestions = this.agentSuggestionHandler ? this.agentSuggestionHandler.getSuggestions() : [];
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

