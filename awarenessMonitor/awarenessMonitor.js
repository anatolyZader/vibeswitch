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
 * 1. SuggestionTracker (suggestion-tracker.js)
 *    - Manages AI suggestion lifecycle (creation, tracking, status detection)
 *    - Handles suggestion objects and their status changes
 * 
 * 2. ReviewDebtManager (review-debt-manager.js)
 *    - Manages persistent tracking of unreviewed files
 *    - Handles debt persistence and calculation
 * 
 * 3. ReviewSessionTracker (review-session-tracker.js)
 *    - Tracks active review sessions for files
 *    - Monitors user review activity (cursor, scroll)
 * 
 * 4. ScoreCalculator (score-calculator.js)
 *    - Calculates awareness score from suggestions and debt
 *    - Handles all score component calculations
 * 
 * 5. EventHandlers (event-handlers.js)
 *    - Handles all VS Code events (text changes, file ops, cursor, etc.)
 *    - Routes events to appropriate modules
 * 
 * 6. FileWatcher (file-watcher.js)
 *    - Monitors file system for externally created files
 *    - Scans existing files on startup
 * 
 * 7. KeepAllDetector (keep-all-detector.js)
 *    - Detects rapid acceptance patterns ("Keep All")
 *    - Emits to usage statistics
 * 
 * 8. Utils (utils.js)
 *    - Shared utilities and constants
 *    - File filtering, path utilities, range utilities
 * 
 * 
 * MAIN ENTITIES:
 * --------------
 * 
 * 1. AwarenessMonitor (Class)
 *    The primary orchestrator class that coordinates all monitoring modules.
 *    
 *    Key Properties:
 *    - suggestionTracker: SuggestionTracker instance
 *    - reviewDebtManager: ReviewDebtManager instance
 *    - reviewSessionTracker: ReviewSessionTracker instance
 *    - scoreCalculator: ScoreCalculator instance
 *    - eventHandlers: EventHandlers instance
 *    - fileWatcher: FileWatcher instance
 *    - keepAllDetector: KeepAllDetector instance
 *    - usageStats: Reference to UsageStatsManager for event tracking
 *    - onScoreUpdate: Callback function for immediate UI updates
 *    - disposables: Array of VS Code event subscriptions for cleanup
 * 
 * 
 * 2. AI Suggestion Object
 *    See suggestion-tracker.js for detailed structure.
 *    Managed by SuggestionTracker module.
 * 
 * 3. Review Debt Object
 *    See review-debt-manager.js for detailed structure.
 *    Managed by ReviewDebtManager module.
 * 
 * 4. Review Session Data
 *    See review-session-tracker.js for detailed structure.
 *    Managed by ReviewSessionTracker module.
 * 
 * 
 * HOW IT WORKS:
 * -------------
 * 
 * 1. INITIALIZATION (start(context))
 *    - Initializes all module instances (debt manager, trackers, handlers, etc.)
 *    - Loads existing review debt from workspace storage
 *    - Registers VS Code event listeners via EventHandlers
 *    - Sets up file system watcher via FileWatcher
 *    - Scans existing workspace files for review debt
 *    - Starts periodic score updates (every 10 seconds)
 * 
 * 2. EVENT FLOW
 *    - VS Code events → EventHandlers → appropriate modules
 *    - Text changes → SuggestionTracker (AI detection)
 *    - File operations → SuggestionTracker + ReviewDebtManager
 *    - User interactions → ReviewSessionTracker
 *    - Score updates → ScoreCalculator
 * 
 * 3. MODULE COORDINATION
 *    - SuggestionTracker manages AI suggestions and status
 *    - ReviewDebtManager handles persistent debt tracking
 *    - ReviewSessionTracker monitors active review sessions
 *    - ScoreCalculator computes awareness scores
 *    - FileWatcher monitors external file creation
 *    - KeepAllDetector identifies rapid acceptance patterns
 *    - EventHandlers routes all VS Code events
 * 
 * 4. SCORE CALCULATION
 *    See score-calculator.js for detailed calculation logic.
 *    Delegated to ScoreCalculator module.
 * 
 * 
 * INTEGRATION POINTS:
 * -------------------
 * 
 * 1. UsageStatsManager (usageStats):
 *    - Receives AI suggestion outcomes via SuggestionTracker
 *    - Receives "Keep All" detections via KeepAllDetector
 *    - Tracks acceptance/rejection rates
 *    - Provides long-term statistics
 * 
 * 2. Extension State (onScoreUpdate callback):
 *    - Called whenever score changes
 *    - Updates awareness meter in status bar
 *    - Provides real-time feedback to user
 * 
 * 3. VS Code Workspace Storage:
 *    - Persists review debt across sessions (via ReviewDebtManager)
 *    - Stores file paths and review metadata
 *    - Loaded on extension activation
 * 
 * 
 * EVENT FLOW EXAMPLE:
 * -------------------
 * 
 * 1. AI generates code → EventHandlers.onTextChange() → SuggestionTracker
 * 2. Suggestion created → SuggestionTracker.addSuggestionAndTrack()
 * 3. File added to review debt → ReviewDebtManager.addToReviewDebt()
 * 4. User opens file → EventHandlers.onFileOpened() → ReviewSessionTracker
 * 5. User moves cursor → EventHandlers.onCursorMove() → ReviewSessionTracker
 * 6. User scrolls → EventHandlers.onScroll() → ReviewSessionTracker
 * 7. User edits code → EventHandlers.onTextChange() → SuggestionTracker.recordUserEdit()
 * 8. After 5 seconds → SuggestionTracker.checkSuggestionStatus()
 * 9. Score recalculated → ScoreCalculator.updateScore()
 * 10. UI updated → onScoreUpdate() callback triggered
 * 11. Review debt updated → ReviewDebtManager.markAsReviewed()
 * 
 * 
 * CLEANUP:
 * --------
 * 
 * stop():
 * - Disposes all VS Code event listeners
 * - Closes file system watcher (FileWatcher.close())
 * - Clears update timer
 * - Saves review debt to storage (ReviewDebtManager.saveReviewDebt())
 * - Preserves state (suggestions, scores) for next session
 * 
 * 
 * CONFIGURATION:
 * --------------
 * 
 * - DISABLE_LOGGING: Controlled centrally from extension.js (see logger.js)
 * - maxSuggestions: Maximum suggestions to track (default: 10, in SuggestionTracker)
 * - keepAllDetectionWindow: Time window for "keep all" detection (2 seconds, in KeepAllDetector)
 * - keepAllThreshold: Minimum acceptances to trigger "keep all" (3, in KeepAllDetector)
 * - Update interval: 10 seconds
 * - Review debt cleanup: 7 days (in ReviewDebtManager)
 * 
 * 
 * ============================================================================
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { getLogger } = require('../logger');
const { NON_CODE_SCHEMES, CODE_EXTENSIONS, isNonCodeDocument, getRelativePath, isPositionInRange, rangesOverlap } = require('./utils');
const ScoreCalculator = require('./score-calculator');
const ReviewDebtManager = require('./review-debt-manager');
const SuggestionTracker = require('./suggestion-tracker');
const ReviewSessionTracker = require('./review-session-tracker');
const FileWatcher = require('./file-watcher');
const EventHandlers = require('./event-handlers');
const KeepAllDetector = require('./keep-all-detector');

class AwarenessMonitor {
    constructor(usageStats = null, onScoreUpdate = null) {
        // Usage statistics integration for AI-aware event tracking
        this.usageStats = usageStats;
        
        // Callback for immediate meter updates
        this.onScoreUpdate = onScoreUpdate;
        
        // Suggestion tracker - will be initialized in start()
        this.suggestionTracker = null;
        
        // REVIEW DEBT SYSTEM - persistent tracking of unreviewed files
        this.reviewDebtManager = null; // Will be initialized in start()
        this.reviewSessionTracker = null; // Will be initialized in start()
        
        // Score calculator
        this.scoreCalculator = new ScoreCalculator();
        
        // Update timer
        this.updateTimer = null;
        
        // Active document tracking (using object wrappers for reference passing)
        this.activeDocument = { value: null };
        this.cursorPosition = { value: null };
        
        // Event handlers - will be initialized in start()
        this.eventHandlers = null;
        
        // Extension context for storage
        this.context = null;
        
        // Store disposables for cleanup
        this.disposables = [];
        
        // "Keep All" detection - will be initialized in start()
        this.keepAllDetector = null;
        
        // File system watcher - will be initialized in start()
        this.fileWatcher = null;
    }

    // ==================== HELPER METHODS ====================
    // Suggestion management is now handled by SuggestionTracker

    // Review session tracking is now handled by ReviewSessionTracker

    /**
     * Start monitoring (called when switching to DEV mode)
     */
    start(context) {
        getLogger().log('AwarenessMonitor: Starting real-time monitoring');
        getLogger().log(`AwarenessMonitor: Callback registered: ${this.onScoreUpdate ? 'YES' : 'NO'}`);
        
        // Store context for workspace storage
        this.context = context;
        
        // Initialize review debt manager
        this.reviewDebtManager = new ReviewDebtManager(context, this.onScoreUpdate);
        
        // Load existing review debt from storage
        this.reviewDebtManager.loadReviewDebt();
        
        // Initialize keep-all detector
        this.keepAllDetector = new KeepAllDetector(this.usageStats);
        
        // Initialize suggestion tracker
        this.suggestionTracker = new SuggestionTracker(
            this.reviewDebtManager,
            () => this.updateScore(),
            this.usageStats,
            (suggestion) => this.keepAllDetector ? this.keepAllDetector.trackAcceptance(suggestion) : null
        );
        
        // Initialize review session tracker
        this.reviewSessionTracker = new ReviewSessionTracker(
            this.reviewDebtManager,
            this.suggestionTracker,
            this.usageStats,
            () => this.updateScore()
        );
        
        // Initialize file watcher
        this.fileWatcher = new FileWatcher(
            this.suggestionTracker,
            this.reviewDebtManager,
            () => this.updateScore(),
            this.onScoreUpdate
        );
        
        // Initialize event handlers
        this.eventHandlers = new EventHandlers(
            this.suggestionTracker,
            this.reviewDebtManager,
            this.reviewSessionTracker,
            this.activeDocument,
            this.cursorPosition
        );
        
        // Clear any existing subscriptions
        this.stop();
        
        // Register all event handlers
        if (this.eventHandlers) {
            // Track text changes (potential AI edits)
            this.disposables.push(
                vscode.workspace.onDidChangeTextDocument((event) => this.eventHandlers.onTextChange(event))
            );
            getLogger().log('AwarenessMonitor: Text change listener registered');
            
            // Track file creation (AI creating new files)
            this.disposables.push(
                vscode.workspace.onDidCreateFiles((event) => this.eventHandlers.onFilesCreated(event))
            );
            
            // Track file saves (AI writing entire files)
            this.disposables.push(
                vscode.workspace.onDidSaveTextDocument((document) => this.eventHandlers.onFileSaved(document))
            );
            
            // Track file opens (user reviewing debt)
            this.disposables.push(
                vscode.workspace.onDidOpenTextDocument((document) => this.eventHandlers.onFileOpened(document))
            );
            
            // Track cursor position (user reviewing code)
            this.disposables.push(
                vscode.window.onDidChangeTextEditorSelection((event) => this.eventHandlers.onCursorMove(event))
            );
            
            // Track scroll events (user reviewing code by scrolling)
            this.disposables.push(
                vscode.window.onDidChangeTextEditorVisibleRanges((event) => this.eventHandlers.onScroll(event))
            );
            
            // Track active editor (user switching to review)
            this.disposables.push(
                vscode.window.onDidChangeActiveTextEditor((editor) => this.eventHandlers.onEditorChange(editor))
            );
        }
        
        // Set up file system watcher for externally created files
        if (this.fileWatcher) {
            this.fileWatcher.setupFileSystemWatcher();
        }
        
        // Scan for existing files that should be in review debt
        if (this.fileWatcher) {
            this.fileWatcher.scanExistingFiles();
        }
        
        // Start periodic score updates (every 10 seconds)
        this.updateTimer = setInterval(() => {
            this.updateScore();
            if (this.reviewSessionTracker) {
                this.reviewSessionTracker.checkReviewProgress();
            }
        }, 10000);
        
        getLogger().log(`AwarenessMonitor: Monitoring active with ${this.reviewDebtManager.getDebtSize()} files in debt`);
        getLogger().log(`AwarenessMonitor: All event listeners registered and active`);
        getLogger().log(`AwarenessMonitor: File system watcher active for ${this.fileWatcher.getWatchedDirectories().length} directories`);
        
        // Log initial state
        getLogger().log(`AwarenessMonitor: Initial score update...`);
        // If we have existing suggestions or debt, preserve the score calculation
        // Otherwise, calculate fresh
        const suggestionCount = this.suggestionTracker ? this.suggestionTracker.getSuggestions().length : 0;
        if (suggestionCount > 0 || this.reviewDebtManager.getDebtSize() > 0) {
            getLogger().log(`AwarenessMonitor: Preserving existing state (${suggestionCount} suggestions, ${this.reviewDebtManager.getDebtSize()} debt files)`);
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
    stop() {
        getLogger().log('AwarenessMonitor: Stopping monitoring');
        
        // Save review debt before stopping
        if (this.reviewDebtManager) {
            this.reviewDebtManager.saveReviewDebt();
        }
        
        // Dispose all event listeners
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        
        // Clean up file system watcher
        if (this.fileWatcher) {
            this.fileWatcher.close();
        }
        
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        // DON'T reset state - preserve suggestions and scores when stopping
        // This allows the meter to maintain its value when switching back to DEV mode
        // Only clear temporary tracking that's session-specific
        if (this.reviewSessionTracker) {
            this.reviewSessionTracker.clear();
        }
        // Keep: this.suggestionTracker, this.scoreCalculator, this.reviewDebtManager, this.keepAllDetector
    }

    // Event handlers are now in EventHandlers class

    /**
     * Get diagnostic status information
     */
    getStatus() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        return {
            isActive: this.disposables.length > 0,
            hasContext: !!this.context,
            hasCallback: !!this.onScoreUpdate,
            hasUsageStats: !!this.usageStats,
            aiSuggestionsCount: this.suggestionTracker ? this.suggestionTracker.getSuggestions().length : 0,
            reviewDebtCount: this.reviewDebtManager ? this.reviewDebtManager.getDebtSize() : 0,
            currentScore: this.scoreCalculator.getCurrentScore(),
            scores: this.scoreCalculator.getScoreComponents(),
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
    updateScore() {
        const suggestions = this.suggestionTracker ? this.suggestionTracker.getSuggestions() : [];
        this.scoreCalculator.updateScore(
            suggestions,
            () => this.reviewDebtManager ? this.reviewDebtManager.calculateDebtScore(suggestions) : 0,
            () => this.reviewDebtManager ? this.reviewDebtManager.getReviewDebtSummary() : { total: 0, files: [] },
            this.onScoreUpdate
        );
    }


    /**
     * Get current awareness score and breakdown
     * Delegates to ScoreCalculator
     */
    getScore() {
        const suggestions = this.suggestionTracker ? this.suggestionTracker.getSuggestions() : [];
        const score = this.scoreCalculator.getScore(
            suggestions,
            () => this.reviewDebtManager ? this.reviewDebtManager.getReviewDebtSummary() : { total: 0, files: [] }
        );
        
        // Add monitoringActive to debug info
        score.debug.monitoringActive = this.updateTimer !== null;
        
        return score;
    }


    // Keep-all detection is now handled by KeepAllDetector

    // ==================== REVIEW DEBT SYSTEM ====================
    // Review debt management is now handled by ReviewDebtManager

    // Event handlers are now in EventHandlers class

    /**
     * Handle externally created file (delegates to FileWatcher)
     * @param {string} filePath - Path to the externally created file
     */
    handleExternallyCreatedFile(filePath) {
        if (this.fileWatcher) {
            this.fileWatcher.handleExternallyCreatedFile(filePath);
        }
    }

}

module.exports = AwarenessMonitor;

