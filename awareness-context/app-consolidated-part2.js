/**
 * APP LAYER - CONSOLIDATED (PART 2/3)
 * 
 * This file contains part 2 of 3 of the app layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: 7/15
 * Generated: 2026-01-13T15:56:48.097Z
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================


// ============================================================================
// FILE 5/15: app/debtService.js
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
// FILE 6/15: app/fileWatcherService.js
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
// FILE 7/15: app/keepAllDetectorService.js
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
// FILE 8/15: app/rangeUtilities.js
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
// FILE 9/15: app/reviewTrackingService.js
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
// FILE 10/15: app/scoreService.js
// ============================================================================

(function() { // IIFE scope for app/scoreService.js
/**
 * ScoreService - Application service for score orchestration
 * 
 * Handles orchestration logic for score calculation:
 * - Time-based filtering (recent activity window)
 * - State management (current score, components)
 * - Callback orchestration
 * - Display formatting
 * 
 * Pure scoring calculations are delegated to ScoreCalculationServiceD (domain layer).
 */

// const { getRelativePath } = require('../domain/utils/utils'); // Commented for consolidation

class ScoreService {
    /**
     * @param {ScoreCalculationServiceD} scoreCalculationServiceD - Domain service for score calculations
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface, optional)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(scoreCalculationServiceD, vscodePort = null, loggerPort = null) {
        if (!scoreCalculationServiceD) {
            throw new Error('ScoreService requires scoreCalculationServiceD');
        }
        this.scoreCalculationServiceD = scoreCalculationServiceD;
        this.vscodePort = vscodePort;
        this.loggerPort = loggerPort;
        this.currentScore = 0;
        this.scores = {
            review: 0,      // 0-40 points
            critical: 0,    // 0-30 points
            adaptation: 0,  // 0-30 points
            debt: 0         // 0-30 points
        };
    }

    /**
     * Update awareness score based on suggestions and review debt
     * @param {Array} aiSuggestions - Array of AI suggestions
     * @param {Function} getDebtScore - Function to get debt score
     * @param {Function} getReviewDebtSummary - Function to get debt summary
     * @param {Function} onScoreUpdate - Callback when score updates
     */
    updateScore(aiSuggestions, getDebtScore, getReviewDebtSummary, onScoreUpdate) {
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for "recent activity" calculation
        const recentSuggestions = aiSuggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // BUT: If we have older suggestions but no recent ones, and we have review debt,
        // preserve the score based on debt rather than resetting to zero
        const hasOlderSuggestions = aiSuggestions.length > 0 && recentSuggestions.length === 0;
        const debtScore = getDebtScore();
        const hasDebt = debtScore > 0;
        
        // Rate-limited debug logging via logger port
        if (this.loggerPort) {
            this.loggerPort.debug(`Updating score: ${recentSuggestions.length} recent, ${aiSuggestions.length} total, debt: ${debtScore}`, 'scoreService:updateScore');
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
                this.currentScore = -1; // Special value: no data yet
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            }
            // Trigger callback for meter update
            if (onScoreUpdate) {
                onScoreUpdate();
            }
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
            
            // Trigger callback for meter update
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        if (completed.length === 0) {
            // No suggestions at all
            this.currentScore = -1;
            this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            if (onScoreUpdate) {
                onScoreUpdate();
            }
            return;
        }
        
        // Delegate to domain service for pure scoring calculations
        // 1. Code Review Rate (40 points)
        this.scores.review = this.scoreCalculationServiceD.calculateReviewScore(completed);
        
        // 2. Critical Evaluation (30 points)
        this.scores.critical = this.scoreCalculationServiceD.calculateCriticalScore(completed);
        
        // 3. Code Adaptation (30 points)
        this.scores.adaptation = this.scoreCalculationServiceD.calculateAdaptationScore(completed);
        
        // 4. Review Debt (30 points)
        this.scores.debt = debtScore;
        
        // Total score (max 130, normalized to 100)
        const rawScore = this.scores.review + 
                        this.scores.critical + 
                        this.scores.adaptation + 
                        this.scores.debt;
        
        this.currentScore = Math.round(Math.min(rawScore, 100));
        
        // Trigger callback for immediate meter update
        if (onScoreUpdate) {
            onScoreUpdate();
        }
    }

    /**
     * Get current awareness score and breakdown
     * @param {Array} aiSuggestions - Array of AI suggestions
     * @param {Function} getReviewDebtSummary - Function to get debt summary
     * @returns {Object} Score data with total, components, suggestions, debt, and debug info
     */
    getScore(aiSuggestions, getReviewDebtSummary) {
        const debtSummary = getReviewDebtSummary();
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for score calculation
        const recentSuggestions = aiSuggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // For display: show ALL suggestions (not just last 10 seconds) so meter shows activity
        // But use recentSuggestions for actual score calculation
        const allSuggestions = aiSuggestions;
        
        // Get pending suggestions with file paths
        const pendingSuggestions = allSuggestions
            .filter(s => s.status === 'pending')
            .map(s => {
                // Extract file path from document URI
                let filePath = null;
                if (s.document) {
                    try {
                        // Use VS Code port for URI creation
                        const Uri = this.vscodePort ? this.vscodePort.Uri : null;
                        if (!Uri) {
                            return null; // Skip if no port available
                        }
                        const uri = Uri.parse(s.document);
                        if (uri.scheme === 'file') {
                            filePath = uri.fsPath;
                        }
                    } catch (err) {
                        if (this.loggerPort) {
                            this.loggerPort.error('ScoreService: Error parsing document URI', err);
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
                    (aiSuggestions.length > 0 ? 
                    new Date(aiSuggestions[aiSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                        'None'),
                monitoringActive: true, // Will be set by main class
                totalDebtEntries: debtSummary.total,
                recentWindowCount: recentSuggestions.length,
                totalTrackedCount: aiSuggestions.length
            }
        };
    }

    /**
     * Get current score value
     * @returns {number} Current score
     */
    getCurrentScore() {
        return this.currentScore;
    }

    /**
     * Get score components
     * @returns {Object} Score components
     */
    getScoreComponents() {
        return { ...this.scores };
    }
}

// module.exports = ScoreService; // Commented for consolidation

})(); // End IIFE for app/scoreService.js


// ============================================================================
// FILE 11/15: app/sessionService.js
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

