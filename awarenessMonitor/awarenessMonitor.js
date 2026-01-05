/**
 * ============================================================================
 * VIBESWITCH REAL-TIME AWARENESS MONITOR - MAIN ORCHESTRATOR
 * ============================================================================
 * 
**/

const vscode = require('vscode');
const { getLogger } = require('../logger');
const safe = require('../helpers/safe');
const ScoreCalculator = require('./scoreCalculator');
const DebtManager = require('./debtManager');
const AgentSuggestionHandler = require('./agentSuggestionHandler');
const SessionTracker = require('./sessionTracker');
const FileWatcher = require('./fileWatcher');
const EventHandlers = require('./eventHandlers');
const KeepAllDetector = require('./keepAllDetector');
class AwarenessMonitor {
    constructor(onScoreUpdate = null, callbacks = {}) {
        // Optional callbacks for external tracking (e.g., UsageStats)
        // These are optional - AwarenessMonitor works fine without them
        this.onAISuggestion = callbacks.onAISuggestion || null;
        this.onAISuggestionOutcome = callbacks.onAISuggestionOutcome || null;
        this.onKeepAll = callbacks.onKeepAll || null;
        this.onDebtCleared = callbacks.onDebtCleared || null;
        
        // callback function used to update the awareness meter UI when the score changes.
        this.onScoreUpdate = onScoreUpdate;
        
        // Agent suggestion handler - will be initialized in start()
        this.agentSuggestionHandler = null;
        
        // DEBT SYSTEM - persistent tracking of unreviewed files
        this.debtManager = null; // Will be initialized in start()
        this.sessionTracker = null; // Will be initialized in start()
        
        // Score calculator
        this.scoreCalculator = new ScoreCalculator();
        
        // Update timer
        this.updateTimer = null;
        
        // Active document tracking (using object wrappers for reference passing)
        this.activeDocument = { value: null };
        this.cursorPosition = { value: null };
        
        // Event handlers - will be initialized in start()
        this.eventHandlers = null;
        
        // Storage persists review debt across VS Code sessions using VS Code's workspace storage API (context.workspaceState). This context provides access to workspaceState, which persists data per workspace
        this.context = null;
        
        // Store disposables for cleanup
        this.disposables = [];
        
        // "Keep All" detection - will be initialized in start()
        this.keepAllDetector = null;
        
        // File system watcher - will be initialized in start()
        this.fileWatcher = null;
    }

    // ==================== HELPER METHODS ====================
    // Suggestion management is now handled by AgentSuggestionHandler

    // Session tracking is now handled by SessionTracker

    /**
     * Start monitoring (called when switching to DEV mode)
     * @param {vscode.ExtensionContext} context - VS Code extension context
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors in Explorer
     * @param {string} mode - Current mode ('vibe', 'dev') for classifier config
     */
    // Boundary: Called from mode switching (command handler boundary)
    start(context, updateFileColorsInExplorer = null, mode = 'dev') {
        // Validate context parameter at boundary
        if (!context) {
            throw new Error('AwarenessMonitor.start() called with null/undefined context');
        }
        
        getLogger().log('AwarenessMonitor: Starting real-time monitoring');
        getLogger().log(`AwarenessMonitor: onScoreUpdate Callback registered: ${this.onScoreUpdate ? 'YES' : 'NO'}`);
        
        // CRITICAL FIX: Stop any existing monitoring BEFORE creating new modules
        // This prevents disposing the modules we just created
        this.stop();
        
        // Store context for workspace storage
        this.context = context;
        
        // Store file color update callback
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        
        // Initialize required modules - fail fast if any fail
        this.debtManager = new DebtManager(context, this.onScoreUpdate, updateFileColorsInExplorer);
        this.debtManager.loadDebt();
        
        this.keepAllDetector = new KeepAllDetector(this.onKeepAll);
        
        this.agentSuggestionHandler = new AgentSuggestionHandler(
            this.debtManager,
            () => this.updateScore(),
            {
                onAISuggestion: this.onAISuggestion,
                onAISuggestionOutcome: this.onAISuggestionOutcome
            },
            (suggestion) => this.keepAllDetector ? this.keepAllDetector.trackAcceptance(suggestion) : null,
            updateFileColorsInExplorer
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
            this.onScoreUpdate
        );
        
        // Initialize change ledger for DIFF bullet tracking
        const ChangeLedger = require('./changeLedger');
        this.changeLedger = new ChangeLedger(context);
        
        this.eventHandlers = new EventHandlers(
            this.agentSuggestionHandler,
            this.debtManager,
            this.sessionTracker,
            this.activeDocument,
            this.cursorPosition,
            mode,
            this.changeLedger // Pass ledger to event handlers
        );
        
        // Register all event handlers - use safe() wrapper for boundaries
        if (this.eventHandlers) {
            // Track text changes (potential AI edits)
            this.disposables.push(
                vscode.workspace.onDidChangeTextDocument((event) => {
                    safe('onTextChange', () => this.eventHandlers.onTextChange(event));
                })
            );
            getLogger().log('AwarenessMonitor: Text change listener registered');
            
            // Track file creation (AI creating new files)
            this.disposables.push(
                vscode.workspace.onDidCreateFiles((event) => {
                    safe('onFilesCreated', () => this.eventHandlers.onFilesCreated(event));
                })
            );
            
            // Track file saves (AI writing entire files)
            this.disposables.push(
                vscode.workspace.onDidSaveTextDocument((document) => {
                    safe('onFileSaved', () => this.eventHandlers.onFileSaved(document));
                })
            );
            
            // Track file opens (user reviewing files)
            this.disposables.push(
                vscode.workspace.onDidOpenTextDocument((document) => {
                    safe('onFileOpened', () => this.eventHandlers.onFileOpened(document));
                })
            );
            
            // Track document close (flush classifier, close reviews)
            this.disposables.push(
                vscode.workspace.onDidCloseTextDocument((document) => {
                    safe('onDocumentClose', () => this.eventHandlers.onDocumentClose(document));
                })
            );
            
            // Track cursor position (user reviewing code)
            this.disposables.push(
                vscode.window.onDidChangeTextEditorSelection((event) => {
                    safe('onCursorMove', () => this.eventHandlers.onCursorMove(event));
                })
            );
            
            // Track scroll events (user reviewing code by scrolling)
            this.disposables.push(
                vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
                    safe('onScroll', () => this.eventHandlers.onScroll(event));
                })
            );
            
            // Track active editor (user switching to review)
            this.disposables.push(
                vscode.window.onDidChangeActiveTextEditor((editor) => {
                    safe('onEditorChange', () => this.eventHandlers.onEditorChange(editor));
                })
            );
        }
        
        // Set up file system watcher for externally created files (optional - don't throw)
        if (this.fileWatcher) {
            safe('setupFileSystemWatcher', () => {
                this.fileWatcher.setupFileSystemWatcher();
            });
        }
        
        // Scan for existing files that should be in debt (optional - don't throw)
        if (this.fileWatcher) {
            safe('scanExistingFiles', () => {
                this.fileWatcher.scanExistingFiles();
            });
        }
        
        // Start periodic score updates (every 10 seconds) - timer is a boundary
        this.updateTimer = setInterval(() => {
            safe('updateTimer', () => {
                this.updateScore();
                if (this.sessionTracker) {
                    this.sessionTracker.checkProgress();
                }
            });
        }, 10000);
        
        const debtSize = this.debtManager ? this.debtManager.getDebtSize() : 0;
        const watchedDirs = this.fileWatcher ? this.fileWatcher.getWatchedDirectories().length : 0;
        
        getLogger().log(`AwarenessMonitor: Monitoring active with ${debtSize} files in debt`);
        getLogger().log(`AwarenessMonitor: All event listeners registered and active`);
        getLogger().log(`AwarenessMonitor: File system watcher active for ${watchedDirs} directories`);
        
        // Log initial state
        getLogger().log(`AwarenessMonitor: Initial score update...`);
        // If we have existing suggestions or debt, preserve the score calculation
        // Otherwise, calculate fresh
        const suggestionCount = this.agentSuggestionHandler ? this.agentSuggestionHandler.getSuggestions().length : 0;
        if (suggestionCount > 0 || debtSize > 0) {
            getLogger().log(`AwarenessMonitor: Preserving existing state (${suggestionCount} suggestions, ${debtSize} debt files)`);
            // Recalculate score from existing data
            this.updateScore();
        } else {
            // Fresh start - no existing data
            this.updateScore();
        }
    }

    /**
     * Stop monitoring (called when switching away from DEV mode)
     */
    // Boundary: Called from mode switching (command handler boundary)
    stop() {
        getLogger().log('AwarenessMonitor: Stopping monitoring');
        
        // Save debt before stopping
        if (this.debtManager) {
            safe('saveDebt', () => {
                this.debtManager.saveDebt();
            });
        }
        
        // Dispose all event listeners
        this.disposables.forEach(d => {
            safe('disposeListener', () => {
                d.dispose();
            });
        });
        this.disposables = [];
        
        // Clean up event handlers (clears rate limiter, change classifier, caches)
        // Fix: Dispose event handlers first (flushes classifier), then flush ledger
        // This ensures classifier flush completes before ledger flush, preserving all data
        if (this.eventHandlers) {
            safe('disposeEventHandlers', async () => {
                await this.eventHandlers.dispose();
            });
        }
        
        // Fix: Flush ledger after classifier flush to ensure all writes are persisted
        // Await to ensure flush completes before extension stops
        if (this.changeLedger) {
            safe('flushChangeLedger', async () => {
                await this.changeLedger.flush();
            });
        }
        
        // FIXED: Dispose agent suggestion handler to clear timers
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
        
        // DON'T reset state - preserve suggestions and scores when stopping
        // This allows the meter to maintain its value when switching back to DEV mode
        // Only clear temporary tracking that's session-specific
        if (this.sessionTracker) {
            safe('clearSessionTracker', () => {
                this.sessionTracker.clear();
            });
        }
        // Keep: this.agentSuggestionHandler, this.scoreCalculator, this.debtManager, this.keepAllDetector
    }

    // Event handlers are now in EventHandlers class

    /**
     * Get diagnostic status information
     */
    // Internal method - errors propagate to caller (boundary)
    getStatus() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        return {
            isActive: this.disposables.length > 0,
            hasContext: !!this.context,
            hasCallback: !!this.onScoreUpdate,
            hasCallbacks: !!(this.onAISuggestion || this.onAISuggestionOutcome || this.onKeepAll || this.onDebtCleared),
            aiSuggestionsCount: this.agentSuggestionHandler ? this.agentSuggestionHandler.getSuggestions().length : 0,
            reviewDebtCount: this.debtManager ? this.debtManager.getDebtSize() : 0,
            currentScore: this.scoreCalculator ? this.scoreCalculator.getCurrentScore() : 0,
            scores: this.scoreCalculator ? this.scoreCalculator.getScoreComponents() : {},
            watchedDirectories: this.fileWatcher ? this.fileWatcher.getWatchedDirectories() : [],
            hasFileSystemWatcher: this.fileWatcher ? this.fileWatcher.isActive() : false,
            workspaceFolders: workspaceFolders ? workspaceFolders.map(f => f.uri.fsPath) : [],
            hasUpdateTimer: !!this.updateTimer,
            recentAcceptances: this.keepAllDetector ? this.keepAllDetector.getRecentAcceptanceCount() : 0
        };
    }

    /**
     * Calculate awareness score based on last 10 seconds of suggestions
     * Delegates to ScoreCalculator
     */
    // Internal method - errors propagate to caller (boundary: timer)
    updateScore() {
        const suggestions = this.agentSuggestionHandler ? this.agentSuggestionHandler.getSuggestions() : [];
        if (this.scoreCalculator) {
            this.scoreCalculator.updateScore(
                suggestions,
                () => this.debtManager ? this.debtManager.calculateDebtScore(suggestions) : 0,
                () => this.debtManager ? this.debtManager.getDebtSummary() : { total: 0, files: [] },
                this.onScoreUpdate
            );
        }
    }


    /**
     * Get current awareness score and breakdown
     * Delegates to ScoreCalculator
     */
    // Internal method - errors propagate to caller (boundary)
    getScore() {
        const suggestions = this.agentSuggestionHandler ? this.agentSuggestionHandler.getSuggestions() : [];
        if (!this.scoreCalculator) {
            // Return default score if calculator not initialized
            return {
                score: 0,
                components: {},
                debug: { monitoringActive: false, error: 'ScoreCalculator not initialized' }
            };
        }
        
        const score = this.scoreCalculator.getScore(
            suggestions,
            () => this.debtManager ? this.debtManager.getDebtSummary() : { total: 0, files: [] }
        );
        
        // Add monitoringActive to debug info
        if (score.debug) {
            score.debug.monitoringActive = this.updateTimer !== null;
        }
        
        return score;
    }


    // Keep-all detection is now handled by KeepAllDetector

    // ==================== DEBT SYSTEM ====================
    // Debt management is now handled by DebtManager

    // Event handlers are now in EventHandlers class

    /**
     * Handle externally created file (delegates to FileWatcher)
     * @param {string} filePath - Path to the externally created file
     */
    // Boundary: Called from external file system events
    handleExternallyCreatedFile(filePath) {
        // Validate parameter at boundary
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('handleExternallyCreatedFile() called with invalid filePath');
        }
        
        if (this.fileWatcher) {
            this.fileWatcher.handleExternallyCreatedFile(filePath);
        }
    }


}

module.exports = AwarenessMonitor;

