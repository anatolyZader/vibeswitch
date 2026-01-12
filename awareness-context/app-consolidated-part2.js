/**
 * APP LAYER - CONSOLIDATED (PART 2/3)
 * 
 * This file contains part 2 of 3 of the app layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 6/13
 * Generated: 2026-01-12T18:19:21.019Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 5/13: app/debtService.js
// ============================================================================

(function() { // IIFE scope for app/debtService.js
/**
 * DebtService - Application service for managing review debt
 * 
 * Orchestrates debt management: persistence, callbacks, and aggregate calculations.
 * This is an application service that coordinates Debt domain entities.
 */

// const Debt = require('../domain/entities/debt'); // Commented for consolidation
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
        this.debts = new Map(); // URI string -> Debt entity
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
            
            // Convert plain objects to Debt entities
            this.debts = new Map();
            for (const [uri, data] of debtData.entries()) {
                if (data instanceof Debt) {
                    this.debts.set(uri, data);
                } else {
                    // Convert plain object to Debt entity
                    this.debts.set(uri, Debt.fromJSON(uri, data));
                }
            }
            
            if (this.loggerPort) {
                this.loggerPort.log(`AwarenessMonitor: Loaded ${this.debts.size} files with debt`);
            }
            
            // Clean up old debt (older than 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            for (const [uri, debt] of this.debts.entries()) {
                if (debt.modifiedAt < sevenDaysAgo) {
                    this.debts.delete(uri);
                    if (this.loggerPort) {
                        this.loggerPort.log(`AwarenessMonitor: Removed stale debt for ${uri}`);
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
        
        // Convert Map of Debt entities to plain objects for storage
        const debtObject = {};
        for (const [uri, debt] of this.debts.entries()) {
            debtObject[uri] = debt.toJSON();
        }
        await this.persistencePort.save('debt', debtObject);
    }

    /**
     * Add file to debt
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} changeSize - Size of the change
     * @param {Function} updateScore - Callback to trigger score update
     */
    addToDebt(filePathOrUri, changeSize, updateScore) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        
        let debt = this.debts.get(uri);
        if (!debt) {
            // Create new Debt entity
            debt = new Debt(uri);
            this.debts.set(uri, debt);
        }
        
        // Use domain entity method
        debt.addChange(changeSize);
        
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
     * Get debt entry for a file
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {Debt|null} Debt entity or null
     */
    getDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return null;
        return this.debts.get(uri) || null;
    }

    /**
     * Mark debt as reviewed
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {number} reviewTime - Time spent reviewing
     */
    markAsReviewed(filePathOrUri, reviewTime) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const debt = this.debts.get(uri);
        if (debt) {
            // Use domain entity method
            debt.markAsReviewed(reviewTime);
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
     * Update debt with session info
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @param {Object} sessionData - Session data
     */
    updateSession(filePathOrUri, sessionData) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return;
        const debt = this.debts.get(uri);
        if (debt) {
            // Use domain entity method
            debt.updateSession(sessionData);
            // Save debt (fire-and-forget in sync context)
            this.saveDebt().catch(err => {
                if (this.loggerPort) {
                    this.loggerPort.error('AwarenessMonitor: Error saving debt after updateSession', err);
                }
            });
        }
    }

    /**
     * Calculate debt score (0-30)
     * High score = lots of unreviewed files (BAD in DEV mode)
     * @param {Array} aiSuggestions - Array of AI suggestions (for pending count)
     * @returns {number} Debt score (0-30)
     */
    calculateDebtScore(aiSuggestions) {
        const unreviewedFiles = Array.from(this.debts.values())
            .filter(d => !d.isReviewed());
        
        // Pending suggestions are also debt - they represent unreviewed AI-generated code
        const pendingSuggestions = aiSuggestions ? aiSuggestions.filter(s => s.status === 'pending') : [];
        
        // If no debt at all, return 0
        if (unreviewedFiles.length === 0 && pendingSuggestions.length === 0) {
            return 0;
        }
        
        const now = Date.now();
        
        // Calculate debt severity
        let debtScore = 0;
        
        // 1. Number of unreviewed files (0-10 points)
        debtScore += Math.min(unreviewedFiles.length * 2, 10);
        
        // 2. Number of pending suggestions (0-10 points)
        // Each pending suggestion is unreviewed code that needs attention
        debtScore += Math.min(pendingSuggestions.length * 2, 10);
        
        // 3. Age of oldest unreviewed file or pending suggestion (0-10 points)
        const allDebtTimestamps = [
            ...unreviewedFiles.map(d => d.modifiedAt),
            ...pendingSuggestions.map(s => s.timestamp)
        ];
        
        if (allDebtTimestamps.length > 0) {
            const oldestDebt = Math.min(...allDebtTimestamps);
            const ageHours = (now - oldestDebt) / (1000 * 60 * 60);
            debtScore += Math.min(ageHours * 1.5, 10);
        }
        
        return Math.round(Math.min(debtScore, 30));
    }

    /**
     * Get debt summary for UI
     * @returns {Object} Summary with total count and top 10 oldest files
     */
    getDebtSummary() {
        const unreviewedFiles = Array.from(this.debts.entries())
            .filter(([_, debt]) => !debt.isReviewed())
            .map(([path, debt]) => ({
                path: path,
                modifiedAt: debt.modifiedAt,
                age: Date.now() - debt.modifiedAt,
                modificationCount: debt.modificationCount,
                totalChanges: debt.totalChanges
            }))
            .sort((a, b) => b.age - a.age); // Oldest first
        
        return {
            total: unreviewedFiles.length,
            files: unreviewedFiles.slice(0, 10) // Top 10 oldest
        };
    }

    /**
     * Get the debt Map (for direct access when needed)
     * @returns {Map<string, Debt>} Debt Map
     */
    getDebtMap() {
        return this.debts;
    }

    /**
     * Get size of debt
     * @returns {number} Number of files in debt
     */
    getDebtSize() {
        return this.debts.size;
    }

    /**
     * Check if file has unreviewed debt
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {boolean} True if file has unreviewed debt
     */
    hasUnreviewedDebt(filePathOrUri) {
        const uri = normalizeToUri(filePathOrUri);
        if (!uri) return false;
        const debt = this.debts.get(uri);
        return debt && !debt.isReviewed();
    }
}

// module.exports = DebtService; // Commented for consolidation

})(); // End IIFE for app/debtService.js


// ============================================================================
// FILE 6/13: app/fileWatcherService.js
// ============================================================================

(function() { // IIFE scope for app/fileWatcherService.js
/**
 * FileWatcherService - Application service for file system monitoring
 * 
 * Orchestrates file system watching, coordinates with suggestion handler and debt service.
 * This is an application service that handles infrastructure orchestration.
 */

// const path = require('path'); // Commented for consolidation // Pure utility library, no I/O - acceptable
// const { CODE_EXTENSIONS, isNonCodeDocument } = require('../domain/utils/utils'); // Commented for consolidation
// const UriPathUtilities = require('./uriPathUtilities'); // Commented for consolidation

class FileWatcherService {
    /**
     * @param {Object} suggestionService - Suggestion service (application service)
     * @param {Object} debtService - Debt service (application service)
     * @param {Function} updateScore - Score update callback
     * @param {Function} onScoreUpdate - Score update callback
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {IFileSystemPort} fileSystemPort - File system port (interface)
     * @param {ILoggerPort} loggerPort - Logger port (interface)
     */
    constructor(suggestionService, debtService, updateScore, onScoreUpdate, vscodePort, fileSystemPort, loggerPort) {
        if (!vscodePort) {
            throw new Error('FileWatcherService requires vscodePort');
        }
        if (!fileSystemPort) {
            throw new Error('FileWatcherService requires fileSystemPort');
        }
        if (!loggerPort) {
            throw new Error('FileWatcherService requires loggerPort');
        }
        
        this.suggestionService = suggestionService;
        this.debtService = debtService;
        this.updateScore = updateScore;
        this.onScoreUpdate = onScoreUpdate;
        this.vscodePort = vscodePort;
        this.fileSystemPort = fileSystemPort;
        this.loggerPort = loggerPort;
        
        // File system watcher for externally created files
        this.fileSystemWatcher = null;
        this.watchedDirectories = new Set();
        this.recentlyCreatedFiles = new Map(); // path -> timestamp (to avoid duplicate events)
    }

    /**
     * Set up file system watcher to detect externally created files (terminal, etc.)
     */
    setupFileSystemWatcher() {
        const workspaceFolders = this.vscodePort.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this.loggerPort.log('AwarenessMonitor: No workspace folders, skipping file system watcher');
            return;
        }

        // Watch all workspace folders
        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath;
            if (this.watchedDirectories.has(folderPath)) {
                continue; // Already watching
            }

            try {
                this.loggerPort.log(`AwarenessMonitor: Setting up file system watcher for ${folderPath}`);
                
                // Watch for file creation events using file system adapter
                const watcher = this.fileSystemPort.watch(folderPath, { recursive: true }, (eventType, filename) => {
                    if (!filename) return;
                    
                    const filePath = path.join(folderPath, filename);
                    
                    // Only process 'rename' events (which includes file creation)
                    if (eventType === 'rename') {
                        // Check if file exists (it was created, not deleted) using file system adapter
                        this.fileSystemPort.stat(filePath, (err, stats) => {
                            if (err) {
                                // File doesn't exist (was deleted), ignore
                                return;
                            }
                            
                            if (stats.isFile()) {
                                // Avoid duplicate events (same file within 1 second)
                                const now = Date.now();
                                const lastSeen = this.recentlyCreatedFiles.get(filePath);
                                if (lastSeen && (now - lastSeen) < 1000) {
                                    return; // Already processed recently
                                }
                                this.recentlyCreatedFiles.set(filePath, now);
                                
                                // Clean up old entries (older than 5 seconds)
                                for (const [path, timestamp] of this.recentlyCreatedFiles.entries()) {
                                    if (now - timestamp > 5000) {
                                        this.recentlyCreatedFiles.delete(path);
                                    }
                                }
                                
                                this.loggerPort.log(`AwarenessMonitor: Externally created file detected: ${filePath}`);
                                this.handleExternallyCreatedFile(filePath);
                            }
                        });
                    }
                });

                watcher.on('error', (err) => {
                    this.loggerPort.error(`AwarenessMonitor: File system watcher error: ${err.message}`, err);
                });

                this.fileSystemWatcher = watcher;
                this.watchedDirectories.add(folderPath);
                this.loggerPort.log(`AwarenessMonitor: File system watcher active for ${folderPath}`);
            } catch (error) {
                this.loggerPort.error(`AwarenessMonitor: Failed to set up file system watcher for ${folderPath}`, error);
            }
        }
    }

    /**
     * Handle a file that was created externally (via terminal, etc.)
     * @param {string} filePath - Path to the file
     */
    handleExternallyCreatedFile(filePath) {
        // Skip non-code files
        const ext = path.extname(filePath).toLowerCase();
        if (!CODE_EXTENSIONS.includes(ext)) {
            return; // Not a code file
        }

        // Create a URI for the file using VS Code adapter
        const Uri = this.vscodePort.Uri;
        const fileUri = Uri.file(filePath);
        
        // Check scheme (skip virtual documents)
        if (isNonCodeDocument(fileUri.scheme)) {
            return;
        }

        this.loggerPort.log(`AwarenessMonitor: Processing externally created file: ${filePath}`);
        
        // Process file as suggestion
        if (this.suggestionService) {
            this.suggestionService.processFileAsSuggestion(fileUri, {
                isFileCreation: true,
                isExternalCreation: true,
                filePath: filePath
            }).then(suggestion => {
                if (suggestion) {
                    this.loggerPort.log(`AwarenessMonitor: Detected externally created file with content - ${suggestion.size} chars`);
                }
            }).catch(err => {
                this.loggerPort.error(`AwarenessMonitor: Error reading externally created file`, err);
            });
        }
    }

    /**
     * Scan existing files in workspace and add them to debt if needed
     * Called on startup to catch files that were created before the extension was active
     */
    scanExistingFiles() {
        const workspaceFolders = this.vscodePort.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this.loggerPort.log('AwarenessMonitor: No workspace folders found, skipping file scan');
            return;
        }

        this.loggerPort.log('AwarenessMonitor: Scanning existing files for debt...');
        
        const ignoreDirs = ['node_modules', '.git', '.vscode', 'dist', 'build', 'out', 'target', '.next', '.cache'];
        
        let scanned = 0;
        let added = 0;
        
        const scanDirectory = (dirPath) => {
            try {
                // Use file system adapter for directory reading
                const entries = this.fileSystemPort.readdirSync(dirPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    
                    // Skip ignored directories
                    if (entry.isDirectory()) {
                        if (ignoreDirs.includes(entry.name) || entry.name.startsWith('.')) {
                            continue;
                        }
                        scanDirectory(fullPath);
                        continue;
                    }
                    
                    // Check if it's a code file
                    const ext = path.extname(entry.name).toLowerCase();
                    if (!CODE_EXTENSIONS.includes(ext)) {
                        continue;
                    }
                    
                    scanned++;
                    
                    // Check if already in debt - use canonical URI string
                    const canonicalUri = UriPathUtilities.normalizeToUri(this.vscodePort, fullPath);
                    if (this.debtService && this.debtService.getDebtMap().has(canonicalUri)) {
                        continue; // Already tracked
                    }
                    
                    // Check file content using file system adapter
                    try {
                        const content = this.fileSystemPort.readFileSync(fullPath, 'utf8');
                        if (content.trim().length > 0) {
                            // File has content and isn't in debt yet - add it
                            this.loggerPort.log(`AwarenessMonitor: Found existing file to add to debt: ${fullPath}`);
                            this.handleExternallyCreatedFile(fullPath);
                            added++;
                        }
                    } catch (err) {
                        // Skip files we can't read
                        continue;
                    }
                }
            } catch (err) {
                // Skip directories we can't read
                this.loggerPort.error(`AwarenessMonitor: Error scanning directory ${dirPath}`, err);
            }
        };
        
        // Scan each workspace folder
        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath;
            this.loggerPort.log(`AwarenessMonitor: Scanning workspace folder: ${folderPath}`);
            scanDirectory(folderPath);
        }
        
        this.loggerPort.log(`AwarenessMonitor: File scan complete: ${scanned} files scanned, ${added} files added to debt`);
        
        // Trigger score update after scan (even if no files added, to refresh UI)
        setTimeout(() => {
            if (this.updateScore) {
                this.updateScore();
            }
            if (this.onScoreUpdate) {
                this.loggerPort.log('AwarenessMonitor: Triggering score update callback after scan...');
                this.onScoreUpdate();
            }
        }, added > 0 ? 2000 : 500); // Longer delay if files were added (to allow async file reading to complete)
    }

    /**
     * Close file system watcher
     */
    close() {
        if (this.fileSystemWatcher) {
            this.fileSystemWatcher.close();
            this.fileSystemWatcher = null;
            this.loggerPort.log('AwarenessMonitor: File system watcher closed');
        }
        this.watchedDirectories.clear();
        this.recentlyCreatedFiles.clear();
    }

    /**
     * Get watched directories
     * @returns {Array} Array of watched directory paths
     */
    getWatchedDirectories() {
        return Array.from(this.watchedDirectories);
    }

    /**
     * Check if file system watcher is active
     * @returns {boolean} True if watcher is active
     */
    isActive() {
        return this.fileSystemWatcher !== null;
    }
}

// module.exports = FileWatcherService; // Commented for consolidation

})(); // End IIFE for app/fileWatcherService.js


// ============================================================================
// FILE 7/13: app/rangeUtilities.js
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
// FILE 8/13: app/reviewTrackingService.js
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
     * @param {Function} onSuggestionReviewed - Callback when suggestion is reviewed
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
                // Mark suggestion as reviewed after dwell time
                if (this.onSuggestionReviewed) {
                    this.onSuggestionReviewed(suggestionId);
                }
                
                // Trigger status check
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
        if (updateReviewTime && activeReview.reviewStarted) {
            const reviewDuration = now - activeReview.reviewStarted;
            if (reviewDuration > 0 && this.suggestionService) {
                const suggestion = this.suggestionService.getSuggestionById(activeReview.suggestionId);
                if (suggestion) {
                    const currentReviewTime = suggestion.reviewTime || 0;
                    this.suggestionService.updateSuggestionReviewTime(
                        activeReview.suggestionId,
                        currentReviewTime + reviewDuration
                    );
                }
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
// FILE 9/13: app/sessionService.js
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
                if (hasPendingSuggestions && this.suggestionService) {
                    const pendingSuggestions = this.suggestionService.getPendingSuggestionsForFile(uri);
                    for (const suggestion of pendingSuggestions) {
                        suggestion.markAsReviewed(session.reviewTime, session.sessionStart);
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
// FILE 10/13: app/suggestionService.js
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

// Import domain services
// const KeepAllDetector = require('../domain/services/keepAllDetector'); // Commented for consolidation

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
     * @param {KeepAllDetector} keepAllDetector - Keep all detector (optional)
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
     */
    constructor({
        suggestionAggregate,
        debtService,
        keepAllDetector = null,
        vscodeAdapter,
        loggerAdapter = null,
        messagingAdapter = null,
        updateScore = null,
        updateFileColorsInExplorer = null,
        onAISuggestion = null,
        onAISuggestionOutcome = null,
        onKeepAll = null,
        activeStatusCheckTimers,
        isActive
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

        this.suggestionAggregate = suggestionAggregate;
        this.debtService = debtService;
        this.keepAllDetector = keepAllDetector;
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

        // Create/update batch for this suggestion
        const batchId = this.suggestionAggregate.createOrUpdateBatch(uri, suggestion.id, mergedSize);
        suggestion.batchId = batchId;

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
                    suggestion.recordUserEdit();

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
                    const batch = suggestion.batchId ? this.suggestionAggregate.getBatch(suggestion.batchId) : null;
                    if (batch && batch.isFullyResolved() && batch.isKeepAllPattern()) {
                        const result = {
                            batchId: batch.batchId,
                            suggestionIds: batch.getSuggestionIdStrings(),
                            filePath: batch.filePath.toString(),
                            acceptanceCount: batch.acceptedCount
                        };

                        if (this.keepAllDetector) {
                            this.keepAllDetector.trackAcceptance(result);
                        }

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
                    const timer = setTimeout(() => {
                        this.activeStatusCheckTimers.delete(timer);
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
        const timer = setTimeout(() => {
            this.activeStatusCheckTimers.delete(timer);
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

