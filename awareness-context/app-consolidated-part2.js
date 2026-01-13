/**
 * APP LAYER - CONSOLIDATED (PART 2/3)
 * 
 * This file contains part 2 of 3 of the app layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 7/12
 * Generated: 2026-01-13T17:41:29.118Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 5/12: app/debtService.js
// ============================================================================

(function() { // IIFE scope for app/debtService.js
/**
 * DebtService - Application service for managing review debt
 * 
 * Orchestrates debt management: persistence, callbacks, and aggregate calculations.
 * This is an application service that coordinates Debt domain entities.
 */

// const FileDebt = require('../domain/entities/fileDebt'); // Commented for consolidation
// const { normalizeToUri } = require('../domain/utils/utils'); // Commented for consolidation

class DebtService {
    /**
     * @param {Function} onScoreUpdate - Callback for score updates
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors
     * @param {IAwarenessPersistencePort} persistencePort - Persistence port (interface)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(onScoreUpdate, updateFileColorsInExplorer = null, persistencePort, loggerPort = null) {
        if (!persistencePort) {
            throw new Error('DebtService requires persistencePort');
        }
        
        this.onScoreUpdate = onScoreUpdate;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.persistencePort = persistencePort;
        this.loggerPort = loggerPort;
        this.fileDebts = new Map(); // URI string -> FileDebt entity (file-level debt only)
        // Note: Suggestion-level debt is tracked via Suggestion entities (status === 'pending')
    }

    /**
     * Load debt from workspace storage
     */
    loadDebt() {
        if (!this.persistencePort) return;
        
        try {
            const stored = this.persistencePort.loadSync('debt');
            // Convert object to Map of Debt entities
            let debtData;
            if (stored instanceof Map) {
                debtData = stored;
            } else if (stored && typeof stored === 'object') {
                debtData = new Map(Object.entries(stored));
            } else {
                debtData = new Map();
            }
            
            // Convert plain objects to FileDebt entities
            this.fileDebts = new Map();
            for (const [uri, data] of debtData.entries()) {
                if (data instanceof FileDebt) {
                    this.fileDebts.set(uri, data);
                } else {
                    // Convert plain object to FileDebt entity
                    // Handle legacy "Debt" format for backward compatibility
                    this.fileDebts.set(uri, FileDebt.fromJSON(uri, data));
                }
            }
            
            if (this.loggerPort) {
                this.loggerPort.log(`AwarenessMonitor: Loaded ${this.fileDebts.size} files with file-level debt`);
            }
            
            // Clean up old file debt (older than 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            for (const [uri, fileDebt] of this.fileDebts.entries()) {
                if (fileDebt.modifiedAt < sevenDaysAgo) {
                    this.fileDebts.delete(uri);
                    if (this.loggerPort) {
                        this.loggerPort.log(`AwarenessMonitor: Removed stale file debt for ${uri}`);
                    }
                }
            }
            
            // Save cleaned up data (fire-and-forget in sync context)
            this.saveDebt().catch(err => {
                if (this.loggerPort) {
                    this.loggerPort.error('AwarenessMonitor: Error saving debt after cleanup', err);
                }
            });
        } catch (error) {
            if (this.loggerPort) {
                this.loggerPort.error('AwarenessMonitor: Error loading debt', error);
            }
            this.debts = new Map();
        }
    }

    /**
     * Save debt to workspace storage (async)
     * @returns {Promise<void>}
     */
    async saveDebt() {
        if (!this.persistencePort) return;
        
        // Convert Map of FileDebt entities to plain objects for storage
        const debtObject = {};
        for (const [uri, fileDebt] of this.fileDebts.entries()) {
            debtObject[uri] = fileDebt.toJSON();
        }
        await this.persistencePort.save('debt', debtObject);
    }

    /**
     * Add file-level debt (for file changes, not suggestions)
     * Note: Suggestion-level debt is tracked separately via Suggestion entities.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} changeSize - Size of the change
     * @param {Function} updateScore - Callback to trigger score update
     */
    addToDebt(filePathOrUri, changeSize, updateScore) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        
        let fileDebt = this.fileDebts.get(uri);
        if (!fileDebt) {
            // Create new FileDebt entity (file-level debt only)
            fileDebt = new FileDebt(uri);
            this.fileDebts.set(uri, fileDebt);
        }
        
        // Use domain entity method
        fileDebt.addChange(changeSize);
        
        // Save debt (fire-and-forget in sync context)
        this.saveDebt().catch(err => {
            if (this.loggerPort) {
                this.loggerPort.error('AwarenessMonitor: Error saving debt after add', err);
            }
        });
        
        // Update file colors immediately when debt changes
        if (this.updateFileColorsInExplorer) {
            this.updateFileColorsInExplorer();
        }
        
        // Trigger immediate score update
        if (updateScore) {
            updateScore();
        }
    }

    /**
     * Get file-level debt entry for a file
     * Note: This returns file-level debt only. Suggestion debt is tracked separately.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {FileDebt|null} FileDebt entity or null
     */
    getDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        return this.fileDebts.get(uri) || null;
    }

    /**
     * Mark file-level debt as reviewed
     * Note: This only marks FILE-LEVEL debt. Pending suggestions are tracked separately.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} reviewTime - Time spent reviewing
     */
    markAsReviewed(filePathOrUri, reviewTime) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const fileDebt = this.fileDebts.get(uri);
        if (fileDebt) {
            // Use domain entity method (file-level debt only)
            fileDebt.markAsReviewed(reviewTime);
            // Save debt (fire-and-forget in sync context)
            this.saveDebt().catch(err => {
                if (this.loggerPort) {
                    this.loggerPort.error('AwarenessMonitor: Error saving debt after markAsReviewed', err);
                }
            });
            
            // Update file colors immediately when debt is cleared
            if (this.updateFileColorsInExplorer) {
                this.updateFileColorsInExplorer();
            }
        }
    }

    /**
     * Update file-level debt with session info
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {Object} sessionData - Session data
     */
    updateSession(filePathOrUri, sessionData) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const fileDebt = this.fileDebts.get(uri);
        if (fileDebt) {
            // Use domain entity method
            fileDebt.updateSession(sessionData);
            // Save debt (fire-and-forget in sync context)
            this.saveDebt().catch(err => {
                if (this.loggerPort) {
                    this.loggerPort.error('AwarenessMonitor: Error saving debt after updateSession', err);
                }
            });
        }
    }

    /**
     * Calculate debt score (0-30) - combines file-level and suggestion-level debt
     * High score = lots of unreviewed files + pending suggestions (BAD in DEV mode)
     * 
     * This properly separates:
     * - FileDebt: Unreviewed changes in files (file-level)
     * - SuggestionDebt: Pending AI suggestions (suggestion-level, tracked via Suggestion entities)
     * 
     * @param {Array} aiSuggestions - Array of AI suggestions (for suggestion-level debt)
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(aiSuggestions) {
        // File-level debt: unreviewed file changes
        const unreviewedFiles = Array.from(this.fileDebts.values())
            .filter(d => !d.isReviewed());
        
        // Suggestion-level debt: pending AI suggestions (tracked separately)
        const pendingSuggestions = aiSuggestions ? aiSuggestions.filter(s => s && s.status === 'pending') : [];
        
        // If no debt at all, return 0
        if (unreviewedFiles.length === 0 && pendingSuggestions.length === 0) {
            return 0;
        }
        
        const now = Date.now();
        
        // Calculate debt severity (combines both types)
        let debtScore = 0;
        
        // 1. Number of unreviewed files (file-level debt) (0-10 points)
        debtScore += Math.min(unreviewedFiles.length * 2, 10);
        
        // 2. Number of pending suggestions (suggestion-level debt) (0-10 points)
        // Each pending suggestion is unreviewed AI-generated code that needs attention
        debtScore += Math.min(pendingSuggestions.length * 2, 10);
        
        // 3. Age of oldest unreviewed file OR pending suggestion (0-10 points)
        const fileDebtTimestamps = unreviewedFiles.map(d => d.modifiedAt || now);
        const suggestionDebtTimestamps = pendingSuggestions.map(s => s.timestamp || now);
        const allDebtTimestamps = [...fileDebtTimestamps, ...suggestionDebtTimestamps];
        
        if (allDebtTimestamps.length > 0) {
            const oldestDebt = Math.min(...allDebtTimestamps);
            const ageHours = (now - oldestDebt) / (1000 * 60 * 60);
            debtScore += Math.min(ageHours * 1.5, 10);
        }
        
        return Math.round(Math.min(debtScore, 30));
    }
    
    /**
     * Calculate debt score using domain service (delegates to DebtCalculationServiceD)
     * This properly separates file-level and suggestion-level debt.
     * @param {Array} aiSuggestions - Array of AI suggestions (for suggestion-level debt)
     * @param {DebtCalculationServiceD} debtCalculationServiceD - Domain service for debt calculations
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScoreWithDomainService(aiSuggestions, debtCalculationServiceD) {
        if (!debtCalculationServiceD) {
            // Fallback to app-level calculation if domain service not provided
            return this.calculateDebtScore(aiSuggestions);
        }
        
        // Delegate to domain service with proper separation
        return debtCalculationServiceD.calculateDebtScore(this.fileDebts, aiSuggestions);
    }

    /**
     * Get file-level debt summary for UI
     * Note: This returns file-level debt only. Suggestion debt is tracked separately.
     * @returns {Object} Summary with total count and top 10 oldest files
     */
    getDebtSummary() {
        const unreviewedFiles = Array.from(this.fileDebts.entries())
            .filter(([_, fileDebt]) => !fileDebt.isReviewed())
            .map(([path, fileDebt]) => ({
                path: path,
                modifiedAt: fileDebt.modifiedAt,
                age: Date.now() - fileDebt.modifiedAt,
                modificationCount: fileDebt.modificationCount,
                totalChanges: fileDebt.totalChanges
            }))
            .sort((a, b) => b.age - a.age); // Oldest first
        
        return {
            total: unreviewedFiles.length,
            files: unreviewedFiles.slice(0, 10) // Top 10 oldest
        };
    }

    /**
     * Get the file-level debt Map (for direct access when needed)
     * Note: This returns file-level debt only. Suggestion debt is tracked separately.
     * @returns {Map<string, FileDebt>} FileDebt Map
     */
    getDebtMap() {
        return this.fileDebts;
    }

    /**
     * Get size of file-level debt
     * Note: This returns file-level debt count only. Suggestion debt is tracked separately.
     * @returns {number} Number of files with file-level debt
     */
    getDebtSize() {
        return this.fileDebts.size;
    }

    /**
     * Check if file has unreviewed file-level debt
     * Note: This checks file-level debt only. Pending suggestions are tracked separately.
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {boolean} True if file has unreviewed file-level debt
     */
    hasUnreviewedDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return false;
        const fileDebt = this.fileDebts.get(uri);
        return fileDebt && !fileDebt.isReviewed();
    }
}

// module.exports = DebtService; // Commented for consolidation

})(); // End IIFE for app/debtService.js


// ============================================================================
// FILE 6/12: app/keepAllDetectorService.js
// ============================================================================

(function() { // IIFE scope for app/keepAllDetectorService.js
/**
 * KeepAllDetectorService - Application service for detecting "Keep All" patterns
 * 
 * Handles stateful, time-based tracking of rapid suggestion acceptances.
 * This is an application service (not domain) because it manages state and time windows.
 */

class KeepAllDetectorService {
    /**
     * @param {Function} onKeepAll - Callback when "keep all" pattern detected
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(onKeepAll, loggerPort = null) {
        this.onKeepAll = onKeepAll;
        this.loggerPort = loggerPort;
        
        // "Keep All" detection - track rapid acceptances
        this.recentAcceptances = [];
        this.keepAllDetectionWindow = 2000; // 2 seconds
        this.keepAllThreshold = 3; // Minimum acceptances to trigger
    }

    /**
     * Track suggestion acceptance and detect "Keep All" pattern
     * 
     * "Keep All" is detected when multiple suggestions are accepted rapidly
     * (typically 3+ acceptances within 2 seconds)
     * 
     * @param {Object} suggestion - The accepted suggestion object
     */
    trackAcceptance(suggestion) {
        const now = Date.now();
        
        // Add this acceptance to the tracking array
        this.recentAcceptances.push({
            timestamp: now,
            suggestionId: suggestion.id,
            document: suggestion.document,
            size: suggestion.size
        });
        
        // Clean old entries (outside detection window)
        this.recentAcceptances = this.recentAcceptances.filter(
            entry => (now - entry.timestamp) < this.keepAllDetectionWindow
        );
        
        // Check for "Keep All" pattern
        if (this.recentAcceptances.length >= this.keepAllThreshold) {
            this.detectKeepAll();
        }
    }

    /**
     * Detect "Keep All" pattern and emit to usage statistics
     * 
     * Called when threshold is reached (multiple rapid acceptances)
     */
    detectKeepAll() {
        const now = Date.now();
        const recent = this.recentAcceptances.filter(
            entry => (now - entry.timestamp) < this.keepAllDetectionWindow
        );
        
        if (recent.length >= this.keepAllThreshold) {
            // Get unique files affected
            const uniqueFiles = new Set(recent.map(e => e.document));
            const totalSize = recent.reduce((sum, e) => sum + e.size, 0);
            
            if (this.loggerPort) {
                this.loggerPort.log(`AwarenessMonitor: "Keep All" detected - ${recent.length} suggestions accepted across ${uniqueFiles.size} files`);
            }
            
            // Call optional callback (e.g., for UsageStats)
            if (this.onKeepAll) {
                this.onKeepAll({
                    count: recent.length,
                    fileCount: uniqueFiles.size,
                    totalSize: totalSize,
                    timestamp: now,
                    window: this.keepAllDetectionWindow
                });
            }
            
            // Clear the tracking array to avoid duplicate detections
            // (but keep the most recent one to allow for overlapping detections)
            this.recentAcceptances = recent.slice(-1);
        }
    }

    /**
     * Get number of recent acceptances
     * @returns {number} Number of recent acceptances
     */
    getRecentAcceptanceCount() {
        return this.recentAcceptances.length;
    }

    /**
     * Clear all tracked acceptances
     */
    clear() {
        this.recentAcceptances = [];
    }
}

// module.exports = KeepAllDetectorService; // Commented for consolidation


})(); // End IIFE for app/keepAllDetectorService.js


// ============================================================================
// FILE 7/12: app/rangeUtilities.js
// ============================================================================

(function() { // IIFE scope for app/rangeUtilities.js
/**
 * RangeUtilities - Application layer utilities for range operations
 * 
 * Contains technical utilities for range calculations and manipulations.
 * These are technical/infrastructure operations - not domain business logic.
 */

class RangeUtilities {
    /**
     * Merge overlapping or touching ranges
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Array<Range>} ranges - Array of ranges to merge
     * @returns {Array<Range>} Merged ranges
     */
    static mergeRanges(vscodePort, ranges) {
        if (!ranges || ranges.length === 0) return [];
        if (ranges.length === 1) return [ranges[0]];

        const Range = vscodePort.Range;
        if (!Range) {
            throw new Error('RangeUtilities.mergeRanges requires Range constructor from vscodePort');
        }

        // Sort ranges by start position
        const sortedRanges = [...ranges].sort((a, b) => {
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
            const isOverlapping = range.intersection(lastMerged) !== undefined;

            if (isOverlapping || isTouching) {
                const start = range.start.isBefore(lastMerged.start)
                    ? range.start
                    : lastMerged.start;
                const end = range.end.isAfter(lastMerged.end)
                    ? range.end
                    : lastMerged.end;
                mergedRanges[mergedRanges.length - 1] = new Range(start, end);
            } else {
                mergedRanges.push(range);
            }
        }

        return mergedRanges;
    }

    /**
     * Calculate union of ranges
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Array<Range>} ranges - Array of ranges
     * @returns {Range} Union range
     */
    static calculateRangeUnion(vscodePort, ranges) {
        if (!ranges || ranges.length === 0) return null;
        if (ranges.length === 1) return ranges[0];

        const Range = vscodePort.Range;
        if (!Range) {
            throw new Error('RangeUtilities.calculateRangeUnion requires Range constructor from vscodePort');
        }

        // Find minimum start and maximum end
        const start = ranges.reduce((min, r) => 
            r.start.isBefore(min) ? r.start : min,
            ranges[0].start
        );
        const end = ranges.reduce((max, r) => 
            r.end.isAfter(max) ? r.end : max,
            ranges[0].end
        );

        return new Range(start, end);
    }

    /**
     * Calculate intersection of two ranges
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Range} range1 - First range
     * @param {Range} range2 - Second range
     * @returns {Range|null} Intersection range or null
     */
    static calculateRangeIntersection(vscodePort, range1, range2) {
        if (!range1 || !range2) return null;
        return range1.intersection(range2) || null;
    }

    /**
     * Validate range against document
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {Range} range - Range to validate
     * @param {TextDocument} document - Document to validate against
     * @returns {Range} Validated range (may be adjusted)
     */
    static validateRange(vscodePort, range, document) {
        if (!range || !document) return range;
        
        // Use document's validateRange method if available
        if (document.validateRange && typeof document.validateRange === 'function') {
            return document.validateRange(range);
        }
        
        // Fallback: manual validation
        const Range = vscodePort.Range;
        if (!Range) return range;

        const lineCount = document.lineCount || 0;
        const startLine = Math.max(0, Math.min(range.start.line, lineCount - 1));
        const endLine = Math.max(0, Math.min(range.end.line, lineCount - 1));
        
        const startLineText = document.lineAt ? document.lineAt(startLine).text : '';
        const endLineText = document.lineAt ? document.lineAt(endLine).text : '';
        
        const startChar = Math.max(0, Math.min(range.start.character, startLineText.length));
        const endChar = Math.max(0, Math.min(range.end.character, endLineText.length));
        
        const Position = vscodePort.Position;
        if (!Position) return range;

        return new Range(
            new Position(startLine, startChar),
            new Position(endLine, endChar)
        );
    }
}

// module.exports = RangeUtilities; // Commented for consolidation

})(); // End IIFE for app/rangeUtilities.js


// ============================================================================
// FILE 8/12: app/reviewTrackingService.js
// ============================================================================

(function() { // IIFE scope for app/reviewTrackingService.js
/**
 * ReviewTrackingService - Application service for tracking suggestion review sessions
 * 
 * Handles cursor movement, scroll, and dwell time tracking for suggestion reviews.
 * This service manages review state and coordinates with suggestion lifecycle.
 * 
 * This service replaces the review tracking logic that was previously in the input layer.
 */

class ReviewTrackingService {
    /**
     * @param {Object} suggestionService - Suggestion service
     * @param {Object} rangeOperationServiceD - Range operation domain service
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {ILoggerPort} loggerPort - Logger port (optional)
     * @param {Function} onSuggestionReviewed - Callback when suggestion is reviewed (suggestionId, reviewTime)
     * @param {Function} onStatusCheck - Callback to trigger status check
     * @param {Object} timerRegistry - Timer registry for managing timers (optional, falls back to setTimeout)
     */
    constructor(suggestionService, rangeOperationServiceD, vscodePort, loggerPort = null, onSuggestionReviewed = null, onStatusCheck = null, timerRegistry = null) {
        this.suggestionService = suggestionService;
        this.rangeOperationServiceD = rangeOperationServiceD;
        this.vscodePort = vscodePort;
        this.loggerPort = loggerPort;
        this.onSuggestionReviewed = onSuggestionReviewed;
        this.onStatusCheck = onStatusCheck;
        this.timerRegistry = timerRegistry; // Use timer registry if provided
        
        // Active review tracking: URI -> { suggestionId, reviewStarted, reviewTime, dwellTimer }
        this.activeReviews = new Map();
        
        // Dwell time threshold (1000ms)
        this.DWELL_TIME_MS = 1000;
    }

    /**
     * Handle cursor move event
     * @param {string} uri - Document URI string
     * @param {Object} position - Cursor position { line, character }
     * @param {number} now - Current timestamp (optional, defaults to Date.now())
     */
    onCursorMoved(uri, position, now = Date.now()) {
        if (!uri || !position) return;
        
        // Get pending suggestions for this document
        const pendingSuggestions = this.suggestionService.getSuggestionsByStatus('pending')
            .filter(s => s.document === uri);
        
        const activeReview = this.activeReviews.get(uri);
        
        // Check if cursor left the active suggestion
        if (activeReview) {
            const activeSuggestion = pendingSuggestions.find(s => s.id === activeReview.suggestionId);
            if (activeSuggestion) {
                const isInRange = this.rangeOperationServiceD.isPositionInRange(
                    this.vscodePort,
                    position,
                    activeSuggestion.range
                );
                
                if (!isInRange) {
                    // Cursor left the suggestion - close review
                    this._closeReview(uri, now);
                } else {
                    // Still in active suggestion - continue tracking
                    return;
                }
            } else {
                // Active suggestion no longer exists
                this._closeReview(uri, now);
            }
        }
        
        // Check if cursor entered a new suggestion
        for (const suggestion of pendingSuggestions) {
            const isInRange = this.rangeOperationServiceD.isPositionInRange(
                this.vscodePort,
                position,
                suggestion.range
            );
            
            if (isInRange) {
                // Start tracking this suggestion
                this._startReview(uri, suggestion.id, now);
                return;
            }
        }
    }

    /**
     * Handle scroll event
     * @param {string} uri - Document URI string
     * @param {number} now - Current timestamp (optional)
     */
    onScroll(uri, now = Date.now()) {
        // Scroll events can be used for engagement tracking
        // Currently just ensure active review is maintained
        if (this.activeReviews.has(uri)) {
            // Review is still active
            return;
        }
    }

    /**
     * Handle document close or editor change
     * @param {string} uri - Document URI string
     * @param {number} now - Current timestamp (optional)
     */
    onDocumentClose(uri, now = Date.now()) {
        if (uri) {
            this._closeReview(uri, now);
        }
    }

    /**
     * Start tracking a review session
     * @private
     */
    _startReview(uri, suggestionId, now) {
        // Clear any existing review for this URI
        this._closeReview(uri, now, false);
        
        // Create dwell timer (use timer registry if available)
        const createTimer = this.timerRegistry 
            ? (callback, delay) => this.timerRegistry.setTimeout(callback, delay)
            : setTimeout;
        
        const dwellTimer = createTimer(() => {
            const currentReview = this.activeReviews.get(uri);
            if (currentReview && currentReview.suggestionId === suggestionId) {
                // Calculate review time (dwell time threshold)
                const reviewTime = this.DWELL_TIME_MS;
                
                // Signal: suggestion was reviewed (dwell time reached)
                // Pass review time to callback - SuggestionService will handle state mutation
                if (this.onSuggestionReviewed) {
                    this.onSuggestionReviewed(suggestionId, reviewTime);
                }
                
                // Signal: trigger status check (after review state updated)
                // SuggestionService owns status determination
                if (this.onStatusCheck) {
                    this.onStatusCheck(suggestionId);
                }
            }
        }, this.DWELL_TIME_MS);
        
        // Store review state
        this.activeReviews.set(uri, {
            suggestionId,
            reviewStarted: now,
            reviewTime: 0,
            dwellTimer
        });
    }

    /**
     * Close an active review session
     * @private
     */
    _closeReview(uri, now, updateReviewTime = true) {
        const activeReview = this.activeReviews.get(uri);
        if (!activeReview) return;
        
        // Clear dwell timer (use timer registry if available)
        if (activeReview.dwellTimer) {
            if (this.timerRegistry) {
                this.timerRegistry.clearTimeout(activeReview.dwellTimer);
            } else {
                clearTimeout(activeReview.dwellTimer);
            }
        }
        
        // Update review time if requested
        // SuggestionService owns all state mutations - delegate to it
        if (updateReviewTime && activeReview.reviewStarted) {
            const reviewDuration = now - activeReview.reviewStarted;
            if (reviewDuration > 0 && this.suggestionService) {
                // Delegate to SuggestionService - it handles accumulation internally
                this.suggestionService.updateSuggestionReviewTime(
                    activeReview.suggestionId,
                    reviewDuration
                );
            }
        }
        
        // Remove from active reviews
        this.activeReviews.delete(uri);
    }

    /**
     * Get pending suggestions for a document
     * @param {string} uri - Document URI string
     * @returns {Array} Array of pending suggestions
     */
    getPendingSuggestions(uri) {
        return this.suggestionService.getSuggestionsByStatus('pending')
            .filter(s => s.document === uri);
    }

    /**
     * Check if position is in range (helper for input layer if needed)
     * @param {Object} position - Position { line, character }
     * @param {Object} range - Range { start, end }
     * @returns {boolean} True if position is in range
     */
    isPositionInRange(position, range) {
        return this.rangeOperationServiceD.isPositionInRange(
            this.vscodePort,
            position,
            range
        );
    }

    /**
     * Dispose - clean up all timers
     */
    dispose() {
        for (const [uri, review] of this.activeReviews.entries()) {
            if (review.dwellTimer) {
                if (this.timerRegistry) {
                    this.timerRegistry.clearTimeout(review.dwellTimer);
                } else {
                    clearTimeout(review.dwellTimer);
                }
            }
        }
        this.activeReviews.clear();
    }
}

// module.exports = ReviewTrackingService; // Commented for consolidation

})(); // End IIFE for app/reviewTrackingService.js


// ============================================================================
// FILE 9/12: app/sessionService.js
// ============================================================================

(function() { // IIFE scope for app/sessionService.js
/**
 * SessionService - Application service for managing review sessions
 * 
 * Orchestrates review session tracking, coordinates with debt service,
 * and publishes domain events. This is an application service.
 */

// const { normalizeToUri } = require('../domain/utils/utils'); // Commented for consolidation
// const ReviewSession = require('../domain/entities/reviewSession'); // Commented for consolidation

class SessionService {
    /**
     * @param {Object} debtService - Debt service (application service)
     * @param {Object} suggestionService - Suggestion service (application service)
     * @param {Function} onDebtCleared - Callback when debt is cleared
     * @param {Function} updateScore - Score update callback
     * @param {Function} updateFileColorsInExplorer - Callback to update file colors (optional)
     * @param {Object} messagingAdapter - Messaging adapter for domain events (optional)
     */
    constructor(debtService, suggestionService, onDebtCleared, updateScore, updateFileColorsInExplorer = null, messagingAdapter = null) {
        this.debtService = debtService;
        this.suggestionService = suggestionService;
        this.onDebtCleared = onDebtCleared;
        this.updateScore = updateScore;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.messagingAdapter = messagingAdapter; // Optional - for publishing domain events
        
        // Active sessions: URI string -> ReviewSession entity
        this.sessions = new Map();
    }

    /**
     * Initialize session tracking for a file
     * Creates a new ReviewSession entity
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {ReviewSession|null} Created session or null
     */
    initializeSession(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        
        if (this.sessions.has(uri)) {
            return this.sessions.get(uri); // Return existing session
        }

        const session = new ReviewSession(uri);
        this.sessions.set(uri, session);
        
        // Update debt if file has debt
        if (this.debtService) {
            this.debtService.updateSession(uri, {
                sessionStart: session.sessionStart
            });
        }

        // Publish domain event if messaging adapter is available
        if (this.messagingAdapter) {
            // const ReviewSessionStartedEvent = require('../events/reviewSessionStartedEvent'); // Commented for consolidation
            const event = new ReviewSessionStartedEvent({
                filePath: uri,
                sessionStart: session.sessionStart
            });
            this.messagingAdapter.publishReviewSessionStartedEvent(event).catch(err => {
                // Log but don't throw - event publishing is non-critical
                // Note: loggerPort not available in SessionService, but this is non-critical
                // Consider injecting loggerPort if needed for consistency
            });
        }

        return session;
    }

    /**
     * Update cursor activity for a file being reviewed
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     */
    updateCursorActivity(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const session = this.sessions.get(uri);
        if (session) {
            session.recordCursorMovement();
        }
    }

    /**
     * Update scroll activity for a file being reviewed
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     */
    updateScrollActivity(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const session = this.sessions.get(uri);
        if (session) {
            session.recordScrollEvent();
        }
    }

    /**
     * Check session progress periodically
     * Uses ReviewSession entity methods for business logic
     */
    checkProgress() {
        const MINIMUM_REVIEW_TIME = 30000; // 30 seconds
        const ACTIVITY_TIMEOUT = 60000; // 1 minute
        
        if (this.sessions.size === 0) {
            return;
        }
        
        for (const [uri, session] of this.sessions.entries()) {
            const hasUnreviewedDebt = this.debtService && this.debtService.hasUnreviewedDebt(uri);
            const hasPendingSuggestions = this.suggestionService ? 
                this.suggestionService.getPendingSuggestionsForFile(uri).length > 0 : false;
            
            // If no debt and no pending suggestions, remove session
            if (!hasUnreviewedDebt && !hasPendingSuggestions) {
                this.sessions.delete(uri);
                continue;
            }
            
            // Check if session timed out
            if (session.hasTimedOut(ACTIVITY_TIMEOUT)) {
                if (this.debtService && hasUnreviewedDebt) {
                    const debt = this.debtService.getDebt(uri);
                    if (debt) {
                        session.complete();
                        this.debtService.markAsReviewed(uri, session.reviewTime);
                    }
                }
                this.sessions.delete(uri);
                continue;
            }
            
            // Check if user has reviewed enough
            if (session.hasSufficientEngagement(MINIMUM_REVIEW_TIME, 5, 3)) {
                let needsScoreUpdate = false;
                
                // Mark debt as paid
                if (this.debtService && hasUnreviewedDebt) {
                    const debt = this.debtService.getDebt(uri);
                    if (debt) {
                        session.complete();
                        this.debtService.markAsReviewed(uri, session.reviewTime);
                        
                        // Publish domain event if messaging adapter is available
                        if (this.messagingAdapter) {
                            // const ReviewSessionCompletedEvent = require('../events/reviewSessionCompletedEvent'); // Commented for consolidation
                            const event = new ReviewSessionCompletedEvent({
                                filePath: uri,
                                sessionStart: session.sessionStart,
                                completedAt: session.completedAt,
                                reviewTime: session.reviewTime,
                                engagementScore: session.getEngagementScore()
                            });
                            this.messagingAdapter.publishReviewSessionCompletedEvent(event).catch(err => {
                                // Log but don't throw - event publishing is non-critical
                                // Note: loggerPort not available in SessionService, but this is non-critical
                                // Consider injecting loggerPort if needed for consistency
                            });
                        }
                        
                        // Call optional callback with engagement score
                        if (this.onDebtCleared) {
                            this.onDebtCleared({
                                filePath: uri,
                                totalChanges: debt.totalChanges,
                                totalReviewTime: debt.totalReviewTime + session.reviewTime,
                                modificationCount: debt.modificationCount,
                                engagementScore: session.getEngagementScore()
                            });
                        }
                        
                        needsScoreUpdate = true;
                    }
                }
                
                // Mark all pending suggestions in this file as reviewed
                // Use aggregate methods (single authority) instead of direct entity calls
                if (hasPendingSuggestions && this.suggestionService) {
                    const pendingSuggestions = this.suggestionService.getPendingSuggestionsForFile(uri);
                    for (const suggestion of pendingSuggestions) {
                        // Delegate to SuggestionService which uses aggregate methods
                        this.suggestionService.markSuggestionAsReviewed(suggestion.id, session.reviewTime);
                        needsScoreUpdate = true;
                    }
                }
                
                this.sessions.delete(uri);
                
                // Update file colors and score
                if (needsScoreUpdate && this.updateFileColorsInExplorer) {
                    this.updateFileColorsInExplorer();
                }
                
                if (needsScoreUpdate && this.updateScore) {
                    this.updateScore();
                }
            }
        }
    }

    /**
     * Get session for a file
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {ReviewSession|null} Session or null
     */
    getSession(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        return this.sessions.get(uri) || null;
    }

    /**
     * Get tracking data for a file (backward compatibility)
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {Object|null} Tracking data or null
     */
    getTracking(filePathOrUri) {
        const session = this.getSession(filePathOrUri);
        if (!session) return null;
        
        // Return legacy format for backward compatibility
        return {
            sessionStart: session.sessionStart,
            lastActivity: session.lastActivity,
            cursorMovements: session.cursorMovements,
            scrollEvents: session.scrollEvents
        };
    }

    /**
     * Check if a file is being tracked
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {boolean} True if file is being tracked
     */
    isTracking(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return false;
        return this.sessions.has(uri);
    }

    /**
     * Clear all tracking sessions
     */
    clear() {
        this.sessions.clear();
    }

    /**
     * Get number of active sessions
     * @returns {number} Number of active sessions
     */
    getActiveSessionCount() {
        return this.sessions.size;
    }

    /**
     * Get all active sessions
     * @returns {Array<ReviewSession>} Array of active sessions
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
}

// module.exports = SessionService; // Commented for consolidation


})(); // End IIFE for app/sessionService.js


// ============================================================================
// FILE 10/12: app/suggestionService.js
// ============================================================================

(function() { // IIFE scope for app/suggestionService.js
/**
 * SuggestionService - Application service for AI suggestion lifecycle management
 * 
 * Handles the complete lifecycle of AI-generated code suggestions:
 * - Detection and recording of AI suggestions
 * - User interaction tracking (edits, adaptations)
 * - Status determination (accepted/rejected/adapted)
 * - Pattern detection (keep all)
 */

// Import domain aggregates
// const SuggestionAggregate = require('../domain/aggregates/suggestionAggregate'); // Commented for consolidation

// Import domain entities
// const Change = require('../domain/entities/change'); // Commented for consolidation

// Import app layer services
// const KeepAllDetectorService = require('./keepAllDetectorService'); // Commented for consolidation

// Import domain utilities
// const { rangesOverlap } = require('../domain/utils/utils'); // Commented for consolidation

// Import domain events
// const AISuggestionOutcomeEvent = require('../domain/events/aiSuggestionOutcomeEvent'); // Commented for consolidation
// const KeepAllEvent = require('../domain/events/keepAllEvent'); // Commented for consolidation

// Import utilities
// const safe = require('../../../../helpers/safe'); // Commented for consolidation

class SuggestionService {
    /**
     * @param {SuggestionAggregate} suggestionAggregate - Suggestion aggregate (required)
     * @param {DebtService} debtService - Debt service (required)
     * @param {KeepAllDetectorService} keepAllDetectorService - Keep all detector service (optional)
     * @param {IAwarenessVSCodePort} vscodeAdapter - VS Code adapter (required)
     * @param {ILoggerPort} loggerAdapter - Logger adapter (optional)
     * @param {IAwarenessMessagingPort} messagingAdapter - Messaging adapter (optional)
     * @param {Function} updateScore - Score update callback (optional)
     * @param {Function} updateFileColorsInExplorer - File colors update callback (optional)
     * @param {Function} onAISuggestion - AI suggestion callback (optional)
     * @param {Function} onAISuggestionOutcome - AI suggestion outcome callback (optional)
     * @param {Function} onKeepAll - Keep all callback (optional)
     * @param {Set} activeStatusCheckTimers - Set to track status check timers (required)
     * @param {Function} isActive - Function to check if service is active (required)
     * @param {string} instanceId - Instance ID for generation-based timer cancellation (required)
     */
    constructor({
        suggestionAggregate,
        debtService,
        keepAllDetectorService = null,
        vscodeAdapter,
        loggerAdapter = null,
        messagingAdapter = null,
        updateScore = null,
        updateFileColorsInExplorer = null,
        onAISuggestion = null,
        onAISuggestionOutcome = null,
        onKeepAll = null,
        activeStatusCheckTimers,
        isActive,
        instanceId
    }) {
        if (!suggestionAggregate) {
            throw new Error('SuggestionService requires suggestionAggregate');
        }
        if (!debtService) {
            throw new Error('SuggestionService requires debtService');
        }
        if (!vscodeAdapter) {
            throw new Error('SuggestionService requires vscodeAdapter');
        }
        if (!activeStatusCheckTimers) {
            throw new Error('SuggestionService requires activeStatusCheckTimers');
        }
        if (!isActive || typeof isActive !== 'function') {
            throw new Error('SuggestionService requires isActive function');
        }
        if (!instanceId) {
            throw new Error('SuggestionService requires instanceId for timer cancellation');
        }

        this.suggestionAggregate = suggestionAggregate;
        this.debtService = debtService;
        this.keepAllDetectorService = keepAllDetectorService;
        this.vscodeAdapter = vscodeAdapter;
        this.loggerAdapter = loggerAdapter;
        this.messagingAdapter = messagingAdapter;
        this.updateScore = updateScore;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        this.onAISuggestion = onAISuggestion;
        this.onAISuggestionOutcome = onAISuggestionOutcome;
        this.onKeepAll = onKeepAll;
        this.activeStatusCheckTimers = activeStatusCheckTimers;
        this.isActive = isActive;
        this.instanceId = instanceId; // Store instance ID for generation-based cancellation
    }

    /**
     * Record a detected AI suggestion
     * @param {vscode.TextDocument} document - The document
     * @param {Change|vscode.TextDocumentContentChangeEvent} change - The change (Change entity or raw change)
     */
    recordAISuggestion(document, change) {
        if (!this.suggestionAggregate) return;

        const uri = document.uri.toString();
        // Support both Change entities and raw changes for backward compatibility
        const changeSize = change instanceof Change ? change.size : change.text.length;
        const changeRange = change instanceof Change ? change.range : change.range;
        const changeText = change instanceof Change ? change.text : change.text;

        // Derive fileName from URI for display purposes only
        const fileName = uri.split('/').pop().split('?')[0];
        if (this.loggerAdapter) {
            this.loggerAdapter.debug(`[DEBUG] 📝 AI suggestion: ${changeSize} chars in ${fileName}`);
        }

        // Extract classification metadata if available
        const classificationMeta = change instanceof Change && change.classification ? {
            classificationLabel: change.classification.label,
            classificationConfidence: change.classification.confidence,
            classificationReasons: change.classification.reasons
        } : {};

        // Create suggestion entity
        const suggestion = this.suggestionAggregate.createSuggestion({
            document: uri,
            range: changeRange,
            text: changeText,
            size: changeSize,
            ...classificationMeta
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
     * @param {Array<Change>} changes - Batch of Change domain entities
     * @param {Object} meta - Optional metadata
     */
    recordAISuggestionBatch(document, changes, meta = {}) {
        if (!this.suggestionAggregate || !changes || changes.length === 0) {
            return;
        }

        const uri = document.uri.toString();

        // Calculate merged range (union of all change ranges)
        const start = changes.reduce((min, c) =>
            c.range.start.isBefore(min) ? c.range.start : min,
            changes[0].range.start
        );
        const end = changes.reduce((max, c) =>
            c.range.end.isAfter(max) ? c.range.end : max,
            changes[0].range.end
        );
        const Range = this.vscodeAdapter.Range;
        const mergedRange = new Range(start, end);

        // Cap merged range span for debt sizing if huge but inserted tiny
        const lineSpan = end.line - start.line;
        const totalInserted = changes.reduce((sum, c) => sum + (c.size || 0), 0);
        const avgInsertedPerLine = lineSpan > 0 ? totalInserted / lineSpan : totalInserted;

        let effectiveRange = mergedRange;
        if (lineSpan > 100 && avgInsertedPerLine < 5) {
            const firstChange = changes[0];
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
            this.loggerAdapter.debug(`[DEBUG] 📝 AI suggestion batch: ${changes.length} changes, ${mergedSize} chars in ${fileName}`);
        }

        // Extract classification metadata from first change (all changes in batch have same classification)
        const classificationMeta = changes[0]?.classification ? {
            classificationLabel: changes[0].classification.label,
            classificationConfidence: changes[0].classification.confidence,
            classificationReasons: changes[0].classification.reasons
        } : {};

        // Create suggestion entity with classification metadata
        const suggestion = this.suggestionAggregate.createSuggestion({
            document: uri,
            range: mergedRange,
            text: mergedText,
            size: mergedSize,
            ...classificationMeta,
            ...meta
        });

        // Add suggestion to batch (aggregate sets batchId on entity)
        const batchId = this.suggestionAggregate.addSuggestionToBatch(uri, suggestion.id, mergedSize);

        // Check if this is a new batch (first suggestion) for event publishing
        const batch = this.suggestionAggregate.getBatch(batchId);
        const isNewBatch = batch && batch.suggestionIds.length === 1;

        // Add to aggregate and track
        this._addSuggestionAndTrack(suggestion, mergedSize);

        // Publish batch created event if this is a new batch
        if (isNewBatch && this.messagingAdapter) {
            // const SuggestionBatchCreatedEvent = require('../domain/events/suggestionBatchCreatedEvent'); // Commented for consolidation
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
                this.loggerAdapter.error(`SuggestionService: Error processing file ${fileUri.fsPath || fileUri}`, err);
            }
        }

        return null;
    }

    /**
     * Record a batch of user edits (might be adapting AI suggestions)
     * @param {vscode.TextDocument} document - The document
     * @param {Array<Change>} changes - Batch of Change domain entities
     */
    recordUserEditBatch(document, changes) {
        if (!this.suggestionAggregate || !changes || changes.length === 0) {
            return;
        }

        const uri = document.uri.toString();
        const fileName = uri.split('/').pop().split('?')[0];

        // Get pending suggestions for this document
        const pendingSuggestions = this.suggestionAggregate.getPendingSuggestionsForFile(uri);
        if (pendingSuggestions.length === 0) {
            return; // No pending suggestions for this document
        }

        // Merge ranges (Change entities have range property)
        const sortedRanges = [...changes]
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
                    // Delegate to aggregate - single authority for all suggestion mutations
                    this.suggestionAggregate.recordUserEditOnSuggestion(suggestion.id);

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
     * @param {Change|vscode.TextDocumentContentChangeEvent} change - The change (Change entity or raw change)
     */
    recordUserEdit(document, change) {
        // Convert single change to batch format
        // Support both Change entities and raw changes for backward compatibility
        const changes = change instanceof Change ? [change] : [{
            range: change.range,
            text: change.text,
            rangeLength: change.rangeLength
        }];
        this.recordUserEditBatch(document, changes);
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
                    // Use aggregate's batch mapping (single source of truth)
                    const batchId = this.suggestionAggregate.getBatchIdForSuggestion(suggestion.id);
                    const batch = batchId ? this.suggestionAggregate.getBatch(batchId) : null;
                    if (batch && batch.isFullyResolved() && batch.isKeepAllPattern()) {
                        // Track each accepted suggestion individually (not batch-level)
                        // KeepAllDetector expects per-suggestion data: { id, document, size }
                        if (this.keepAllDetectorService && suggestion) {
                            this.keepAllDetectorService.trackAcceptance({
                                id: suggestion.id,
                                document: suggestion.document,
                                size: suggestion.size || 0
                            });
                        }
                        
                        // Batch-level result for events/callbacks (separate from KeepAll detection)
                        const result = {
                            batchId: batch.batchId,
                            suggestionIds: batch.getSuggestionIdStrings(),
                            filePath: batch.filePath.toString(),
                            acceptanceCount: batch.acceptedCount
                        };

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
                    const instanceId = this.instanceId; // Capture instance ID at timer creation
                    const timer = setTimeout(() => {
                        this.activeStatusCheckTimers.delete(timer);
                        // Generation-based cancellation: only execute if instance ID matches
                        if (this.instanceId !== instanceId) {
                            return; // Instance was restarted, ignore this timer
                        }
                        if (this.isActive()) {
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
            if (this.updateScore) {
                this.updateScore();
            }
        } catch (err) {
            if (this.loggerAdapter) {
                this.loggerAdapter.error('SuggestionService: Error checking suggestion status', err);
            }
        }
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
     * Add suggestion to aggregate and track it
     * Internal method that handles suggestion tracking workflow
     * @param {Suggestion} suggestion - Suggestion entity
     * @param {number} contentLength - Length of content
     */
    _addSuggestionAndTrack(suggestion, contentLength) {
        if (!this.suggestionAggregate) return;

        // Add to aggregate
        this.suggestionAggregate.addSuggestion(suggestion);

        // Add to debt
        if (this.debtService) {
            const uri = suggestion.document;
            this.debtService.addToDebt(uri, contentLength, () => {
                if (this.updateScore) {
                    this.updateScore();
                }
            });
        }

        // Update file colors immediately when new suggestion is added
        if (this.updateFileColorsInExplorer) {
            this.updateFileColorsInExplorer();
        }

        // Schedule status check after 5 seconds
        const instanceId = this.instanceId; // Capture instance ID at timer creation
        const timer = setTimeout(() => {
            this.activeStatusCheckTimers.delete(timer);
            // Generation-based cancellation: only execute if instance ID matches
            if (this.instanceId !== instanceId) {
                return; // Instance was restarted, ignore this timer
            }
            if (this.isActive()) {
                this.checkSuggestionStatus(suggestion.id);
            }
        }, 5000);
        this.activeStatusCheckTimers.add(timer);

        // Immediately update score to reflect new activity
        if (this.updateScore) {
            this.updateScore();
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
     * Mark suggestion as reviewed (delegates to aggregate - single authority)
     * @param {string} suggestionId - Suggestion ID
     * @param {number} reviewTime - Review time in milliseconds (accumulated)
     */
    markSuggestionAsReviewed(suggestionId, reviewTime = 0) {
        if (!this.suggestionAggregate) return;
        
        // Delegate to aggregate - single authority for all suggestion mutations
        this.suggestionAggregate.markSuggestionReviewed(suggestionId, {
            reviewTimeDeltaMs: reviewTime,
            reviewStartedAt: null // Let aggregate handle default
        });
        
        if (this.loggerAdapter) {
            this.loggerAdapter.debug(`Suggestion ${suggestionId} marked as reviewed (time: ${reviewTime}ms)`);
        }
    }
    
    /**
     * Update suggestion review time (delegates to aggregate - accumulates)
     * @param {string} suggestionId - Suggestion ID
     * @param {number} reviewTime - Additional review time in milliseconds
     */
    updateSuggestionReviewTime(suggestionId, reviewTime) {
        if (!this.suggestionAggregate) return;
        
        // Delegate to aggregate - single authority for all suggestion mutations
        this.suggestionAggregate.addSuggestionReviewTime(suggestionId, reviewTime);
    }
    
    /**
     * Get suggestion by ID
     * @param {string} suggestionId - Suggestion ID
     * @returns {Object|null} Suggestion or null
     */
    getSuggestionById(suggestionId) {
        return this.suggestionAggregate ? this.suggestionAggregate.findSuggestion(suggestionId) : null;
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
}

// module.exports = SuggestionService; // Commented for consolidation

})(); // End IIFE for app/suggestionService.js


// ============================================================================
// FILE 11/12: app/timerRegistry.js
// ============================================================================

(function() { // IIFE scope for app/timerRegistry.js
/**
 * TimerRegistry - Centralized timer management for awareness module
 * 
 * Provides a single point of control for all timers, ensuring they can be
 * properly cleaned up on service stop/dispose. This prevents "stuck state"
 * bugs where timers fire after the service has been stopped.
 */

class TimerRegistry {
    constructor() {
        // Track all active timers
        this.timeouts = new Set();
        this.intervals = new Set();
    }

    /**
     * Create a timeout that will be tracked and can be cleared
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {Object} Timer ID (Node.js Timeout object)
     */
    setTimeout(callback, delay) {
        const timer = setTimeout(() => {
            this.timeouts.delete(timer);
            callback();
        }, delay);
        this.timeouts.add(timer);
        return timer;
    }

    /**
     * Create an interval that will be tracked and can be cleared
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {Object} Timer ID (Node.js Timeout object)
     */
    setInterval(callback, delay) {
        const timer = setInterval(callback, delay);
        this.intervals.add(timer);
        return timer;
    }

    /**
     * Clear a specific timeout
     * @param {Object} timer - Timer ID to clear
     */
    clearTimeout(timer) {
        if (timer) {
            clearTimeout(timer);
            this.timeouts.delete(timer);
        }
    }

    /**
     * Clear a specific interval
     * @param {Object} timer - Timer ID to clear
     */
    clearInterval(timer) {
        if (timer) {
            clearInterval(timer);
            this.intervals.delete(timer);
        }
    }

    /**
     * Clear all timers (timeouts and intervals)
     * Should be called on service stop/dispose
     */
    clear() {
        // Clear all timeouts
        for (const timer of this.timeouts) {
            clearTimeout(timer);
        }
        this.timeouts.clear();

        // Clear all intervals
        for (const timer of this.intervals) {
            clearInterval(timer);
        }
        this.intervals.clear();
    }

    /**
     * Get count of active timers
     * @returns {Object} { timeouts: number, intervals: number }
     */
    getCount() {
        return {
            timeouts: this.timeouts.size,
            intervals: this.intervals.size
        };
    }
}

// module.exports = TimerRegistry; // Commented for consolidation

})(); // End IIFE for app/timerRegistry.js

