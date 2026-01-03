/**
 * ============================================================================
 * VIBESWITCH REAL-TIME AWARENESS MONITOR - MAIN ORCHESTRATOR
 * ============================================================================
 * 
 * PURPOSE:
 * --------
 * This is the main orchestrator class for VibeSwitch's awareness tracking system.
 * It coordinates multiple specialized modules to monitor user interactions with
 * AI-generated code in DEV mode and calculates a real-time "awareness score"
 * (0-100) that reflects how carefully the user is reviewing and understanding
 * AI suggestions before accepting them.
 * 
 * The monitor tracks:
 * - AI-generated code changes (text edits, file creations, file saves)
 * - User review behavior (cursor movement, scrolling, file opens, edits)
 * - Review debt (unreviewed files that accumulate over time)
 * - User adaptation of AI code (customizations, modifications)
 * 
 * 
 * MODULAR ARCHITECTURE:
 * ---------------------
 * 
 * This orchestrator coordinates the following specialized modules:
 * 
 * 1. AgentSuggestionHandler (agentSuggestionHandler.js)
 *    - Manages AI suggestion lifecycle (creation, tracking, status detection)
 *    - Handles suggestion objects and their status changes
 * 
 * 2. DebtManager (debtManager.js)
 *    - Manages persistent tracking of unreviewed files
 *    - Handles debt persistence and calculation
 * 
 * 3. SessionTracker (sessionTracker.js)
 *    - Tracks active review sessions for files
 *    - Monitors user review activity (cursor, scroll)
 * 
 * 4. ScoreCalculator (scoreCalculator.js)
 *    - Calculates awareness score from suggestions and debt
 *    - Handles all score component calculations
 * 
 * 5. EventHandlers (eventHandlers.js)
 *    - Handles all VS Code events (text changes, file ops, cursor, etc.)
 *    - Routes events to appropriate modules
 * 
 * 6. FileWatcher (fileWatcher.js)
 *    - Monitors file system for externally created files
 *    - Scans existing files on startup
 * 
 * 7. KeepAllDetector (keepAllDetector.js)
 *    - Detects rapid acceptance patterns ("Keep All")
 *    - Emits to usage statistics
 * 
 * 8. Utils (utils.js)
 *    - Shared utilities and constants
 *    - File filtering, path utilities, range utilities
 * 
 * 
 * ERROR HANDLING ARCHITECTURE:
 * -----------------------------
 * 
 * This module follows boundary-based error handling patterns:
 * 
 * - Error handling occurs ONLY at system boundaries (VS Code event callbacks, timers)
 * - Uses centralized `safe()` wrapper utility for all event listeners
 * - Internal methods (updateScore, getScore, getStatus) let errors propagate to boundaries
 * - No nested try/catch blocks - each boundary has a single error handler
 * - Fail-fast validation at module boundaries (start, handleExternallyCreatedFile)
 * 
 * See helpers/safe.js for the centralized error handling wrapper.
 * 
 * 
 * MAIN ENTITIES:
 * --------------
 * 
 * 1. AwarenessMonitor (Class)
 *    The primary orchestrator class that coordinates all monitoring modules.
 *    
 *    Key Properties:
 *    - agentSuggestionHandler: AgentSuggestionHandler instance
 *    - debtManager: DebtManager instance
 *    - sessionTracker: SessionTracker instance
 *    - scoreCalculator: ScoreCalculator instance
 *    - eventHandlers: EventHandlers instance
 *    - fileWatcher: FileWatcher instance
 *    - keepAllDetector: KeepAllDetector instance
 *    - usageStats: Reference to UsageStatsManager for event tracking
 *    - onScoreUpdate: Callback function for immediate UI updates
 *    - updateFileColorsInExplorer: Callback to update file colors in Explorer
 *    - disposables: Array of VS Code event subscriptions for cleanup
 * 
 * 
 * 2. AI Suggestion Object
 *    See agentSuggestionHandler.js for detailed structure.
 *    Managed by AgentSuggestionHandler module.
 * 
 * 3. Debt Object
 *    See debtManager.js for detailed structure.
 *    Managed by DebtManager module.
 * 
 * 4. Session Data
 *    See sessionTracker.js for detailed structure.
 *    Managed by SessionTracker module.
 * 
 * 
 * HOW IT WORKS:
 * -------------
 * 
 * 1. INITIALIZATION (start(context, updateFileColorsInExplorer))
 *    - Validates context parameter (fail-fast at boundary)
 *    - Initializes all module instances (debt manager, trackers, handlers, etc.)
 *    - Loads existing review debt from workspace storage
 *    - Registers VS Code event listeners via EventHandlers (wrapped in safe())
 *    - Sets up file system watcher via FileWatcher (optional, uses safe())
 *    - Scans existing workspace files for review debt (optional, uses safe())
 *    - Starts periodic score updates (every 10 seconds, timer wrapped in safe())
 * 
 * 2. EVENT FLOW
 *    - VS Code events → safe() wrapper → EventHandlers → appropriate modules
 *    - Text changes → EventHandlers.onTextChange() → AgentSuggestionHandler (AI detection)
 *    - File operations → EventHandlers → AgentSuggestionHandler + DebtManager
 *    - User interactions → EventHandlers → SessionTracker
 *    - Score updates → ScoreCalculator (via timer or callback)
 * 
 * 3. MODULE COORDINATION
 *    - AgentSuggestionHandler manages AI suggestions and status
 *    - DebtManager handles persistent debt tracking
 *    - SessionTracker monitors active sessions
 *    - ScoreCalculator computes awareness scores
 *    - FileWatcher monitors external file creation
 *    - KeepAllDetector identifies rapid acceptance patterns
 *    - EventHandlers routes all VS Code events
 * 
 * 4. SCORE CALCULATION
 *    See scoreCalculator.js for detailed calculation logic.
 *    Delegated to ScoreCalculator module.
 *    Called via:
 *    - Immediate callback when suggestions/debt change
 *    - Periodic timer (every 10 seconds)
 *    - Manual trigger via updateScore() method
 * 
 * 
 * INTEGRATION POINTS:
 * -------------------
 * 
 * 1. UsageStatsManager (usageStats):
 *    - Receives AI suggestion outcomes via AgentSuggestionHandler
 *    - Receives "Keep All" detections via KeepAllDetector
 *    - Tracks acceptance/rejection rates
 *    - Provides long-term statistics
 * 
 * 2. Extension State (onScoreUpdate callback):
 *    - Called whenever score changes
 *    - Updates awareness meter in status bar
 *    - Provides real-time feedback to user
 * 
 * 3. Extension State (updateFileColorsInExplorer callback):
 *    - Called when debt or suggestions change
 *    - Updates file name colors in Explorer
 *    - Provides visual indicators for unreviewed files
 * 
 * 4. VS Code Workspace Storage:
 *    - Persists review debt across sessions (via DebtManager)
 *    - Stores file paths and review metadata
 *    - Loaded on extension activation
 * 
 * 
 * EVENT FLOW EXAMPLE (Agent Change to Existing File):
 * ----------------------------------------------------
 * 
 * 1. AI generates code → VS Code fires onDidChangeTextDocument event
 * 2. safe('onTextChange') → EventHandlers.onTextChange() → analyzes change
 * 3. AI-like change detected → AgentSuggestionHandler.recordAISuggestion()
 * 4. Suggestion created → AgentSuggestionHandler.addSuggestionAndTrack()
 * 5. File added to review debt → DebtManager.addToDebt()
 *    - Updates debt Map
 *    - Calls updateFileColorsInExplorer() → file colors updated
 *    - Calls updateScore() → score recalculated
 * 6. ScoreCalculator.updateScore() → calculates new score
 * 7. onScoreUpdate() callback → updateAwarenessMeter() → meter updated
 * 8. User opens file → EventHandlers.onFileOpened() → SessionTracker
 * 9. User moves cursor → EventHandlers.onCursorMove() → SessionTracker
 * 10. User scrolls → EventHandlers.onScroll() → SessionTracker
 * 11. User edits code → EventHandlers.onTextChange() → AgentSuggestionHandler.recordUserEdit()
 * 12. After 5 seconds → AgentSuggestionHandler.checkSuggestionStatus()
 * 13. Score recalculated → ScoreCalculator.updateScore()
 * 14. UI updated → onScoreUpdate() callback triggered
 * 15. Review debt updated → DebtManager.markAsReviewed()
 * 
 * See LIFECYCLE-AGENT-CHANGE.md for detailed lifecycle documentation.
 * 
 * 
 * CLEANUP:
 * --------
 * 
 * stop():
 * - Saves review debt to storage (via safe() wrapper)
 * - Disposes all VS Code event listeners (via safe() wrapper)
 * - Closes file system watcher (via safe() wrapper)
 * - Clears update timer
 * - Clears session tracker (via safe() wrapper)
 * - Preserves state (suggestions, scores) for next session
 * 
 * All cleanup operations use safe() wrapper to prevent errors from blocking cleanup.
 * 
 * 
 * CONFIGURATION:
 * --------------
 * 
 * - DISABLE_LOGGING: Controlled centrally from extension.js (see logger.js)
 * - maxSuggestions: Maximum suggestions to track (default: 10, in AgentSuggestionHandler)
 * - keepAllDetectionWindow: Time window for "keep all" detection (2 seconds, in KeepAllDetector)
 * - keepAllThreshold: Minimum acceptances to trigger "keep all" (3, in KeepAllDetector)
 * - Update interval: 10 seconds
 * - Review debt cleanup: 7 days (in DebtManager)
 * 
 * 
 * ============================================================================
 */

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
    constructor(usageStats = null, onScoreUpdate = null) {
        // Usage statistics integration for AI-aware event tracking
        this.usageStats = usageStats;
        
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
        
        this.keepAllDetector = new KeepAllDetector(this.usageStats);
        
        this.agentSuggestionHandler = new AgentSuggestionHandler(
            this.debtManager,
            () => this.updateScore(),
            this.usageStats,
            (suggestion) => this.keepAllDetector ? this.keepAllDetector.trackAcceptance(suggestion) : null,
            updateFileColorsInExplorer
        );
        
        this.sessionTracker = new SessionTracker(
            this.debtManager,
            this.agentSuggestionHandler,
            this.usageStats,
            () => this.updateScore(),
            updateFileColorsInExplorer
        );
        
        this.fileWatcher = new FileWatcher(
            this.agentSuggestionHandler,
            this.debtManager,
            () => this.updateScore(),
            this.onScoreUpdate
        );
        
        this.eventHandlers = new EventHandlers(
            this.agentSuggestionHandler,
            this.debtManager,
            this.sessionTracker,
            this.activeDocument,
            this.cursorPosition,
            mode
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
        if (this.eventHandlers) {
            safe('disposeEventHandlers', () => {
                this.eventHandlers.dispose();
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
            hasUsageStats: !!this.usageStats,
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

