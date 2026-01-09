/**
 * File Watcher
 * Monitors file system for externally created files and scans existing files
 * 
 * Domain entity - uses ports for all infrastructure operations
 */

const path = require('path'); // Pure utility library, no I/O - acceptable in domain
const { CODE_EXTENSIONS, isNonCodeDocument } = require('../utils/utils');

class FileWatcher {
    /**
     * @param {Object} agentSuggestionHandler - Agent suggestion handler (domain entity)
     * @param {Object} debtManager - Debt manager (domain entity)
     * @param {Function} updateScore - Score update callback
     * @param {Function} onScoreUpdate - Score update callback
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port (interface)
     * @param {IFileSystemPort} fileSystemPort - File system port (interface)
     * @param {ILoggerPort} loggerPort - Logger port (interface)
     */
    constructor(agentSuggestionHandler, debtManager, updateScore, onScoreUpdate, vscodePort, fileSystemPort, loggerPort) {
        if (!vscodePort) {
            throw new Error('FileWatcher requires vscodePort');
        }
        if (!fileSystemPort) {
            throw new Error('FileWatcher requires fileSystemPort');
        }
        if (!loggerPort) {
            throw new Error('FileWatcher requires loggerPort');
        }
        
        this.agentSuggestionHandler = agentSuggestionHandler;
        this.debtManager = debtManager;
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
        if (this.agentSuggestionHandler) {
            this.agentSuggestionHandler.processFileAsSuggestion(fileUri, {
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
                    
                    // Check if already in debt
                    const normalizedPath = path.resolve(fullPath).replace(/\\/g, '/');
                    if (this.debtManager && this.debtManager.getDebtMap().has(normalizedPath)) {
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

module.exports = FileWatcher;
