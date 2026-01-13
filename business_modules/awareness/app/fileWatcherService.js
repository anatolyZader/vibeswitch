/**
 * FileWatcherService - Application service for handling externally created files
 * 
 * Handles files created outside VS Code (terminal, etc.) that VS Code events might miss.
 * 
 * NOTE: This service NO LONGER uses fs.watch due to:
 * - Platform inconsistencies (Linux issues)
 * - Performance problems (recursive watching)
 * - Duplicate events with VS Code's onDidCreateFiles
 * 
 * Instead, it provides utility methods that can be called from VS Code events
 * or other sources. VS Code's onDidCreateFiles event is the primary mechanism.
 */

const path = require('path'); // Pure utility library, no I/O - acceptable
const { CODE_EXTENSIONS, isNonCodeDocument } = require('../domain/utils/utils');
const UriPathUtilities = require('./uriPathUtilities');

class FileWatcherService {
    /**
     * @param {Object} suggestionService - Suggestion service (application service)
     * @param {Object} debtService - Debt service (application service)
     * @param {Function} updateScore - Score update callback
     * @param {Function} onScoreUpdate - Score update callback
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {ILoggerPort} loggerPort - Logger port (interface)
     */
    constructor(suggestionService, debtService, updateScore, onScoreUpdate, vscodePort, loggerPort) {
        if (!vscodePort) {
            throw new Error('FileWatcherService requires vscodePort');
        }
        if (!loggerPort) {
            throw new Error('FileWatcherService requires loggerPort');
        }
        
        this.suggestionService = suggestionService;
        this.debtService = debtService;
        this.updateScore = updateScore;
        this.onScoreUpdate = onScoreUpdate;
        this.vscodePort = vscodePort;
        this.loggerPort = loggerPort;
        
        // Duplicate detection for externally created files (to avoid processing same file twice)
        this.recentlyCreatedFiles = new Map(); // path -> timestamp
    }

    /**
     * Setup file watcher (NO-OP - fs.watch removed)
     * 
     * VS Code's onDidCreateFiles event is now the primary mechanism for file creation detection.
     * This method is kept for backward compatibility but does nothing.
     * 
     * @deprecated File system watching removed - use VS Code events only
     */
    setupFileSystemWatcher() {
        // NO-OP: fs.watch removed due to platform issues and performance problems
        // VS Code's onDidCreateFiles event handles file creation detection
        this.loggerPort.log('AwarenessMonitor: File system watcher setup skipped (using VS Code events only)');
    }

    /**
     * Handle a file that was created externally (via terminal, etc.)
     * 
     * This method is called from VS Code events (onDidCreateFiles) or other sources.
     * It provides duplicate detection and processes the file as a suggestion.
     * 
     * @param {string} filePath - Path to the file
     */
    handleExternallyCreatedFile(filePath) {
        if (!filePath) return;
        
        // Duplicate detection (same file within 1 second)
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
     * Scan existing files (NO-OP - removed due to performance issues)
     * 
     * Full workspace scans cause huge performance hits on startup.
     * VS Code events (onDidCreateFiles, onDidSaveTextDocument) handle file detection.
     * 
     * Files created before extension activation will be detected when:
     * - User opens them (onDidOpenTextDocument)
     * - User saves them (onDidSaveTextDocument)
     * - VS Code detects them (onDidCreateFiles)
     * 
     * @deprecated Full workspace scan removed - use VS Code events only
     */
    scanExistingFiles() {
        // NO-OP: Full workspace scan removed due to performance issues
        // VS Code events handle file detection when files are opened/saved/created
        this.loggerPort.log('AwarenessMonitor: File scan skipped (using VS Code events only)');
    }

    /**
     * Close file watcher (cleanup)
     */
    close() {
        // Clean up duplicate detection cache
        this.recentlyCreatedFiles.clear();
        this.loggerPort.log('AwarenessMonitor: File watcher service closed');
    }

    /**
     * Get watched directories (NO-OP - fs.watch removed)
     * @returns {Array} Empty array (no directories watched)
     * @deprecated File system watching removed
     */
    getWatchedDirectories() {
        return []; // No directories watched (using VS Code events only)
    }

    /**
     * Check if file system watcher is active (always false - fs.watch removed)
     * @returns {boolean} Always false (no fs.watch)
     * @deprecated File system watching removed
     */
    isActive() {
        return false; // No fs.watch active (using VS Code events only)
    }
}

module.exports = FileWatcherService;
