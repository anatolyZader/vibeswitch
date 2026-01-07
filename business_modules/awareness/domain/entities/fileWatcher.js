/**
 * File Watcher
 * Monitors file system for externally created files and scans existing files
 */

// Keep minimal vscode import for types only
// All API calls should go through vscodeAdapter
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { getLogger } = require('../../../../logger');
const { CODE_EXTENSIONS, isNonCodeDocument } = require('../utils/utils');

class FileWatcher {
    constructor(agentSuggestionHandler, debtManager, updateScore, onScoreUpdate, vscodeAdapter = null) {
        this.agentSuggestionHandler = agentSuggestionHandler;
        this.debtManager = debtManager;
        this.updateScore = updateScore;
        this.onScoreUpdate = onScoreUpdate;
        // VS Code adapter (Ports and Adapters pattern) - optional for backward compatibility
        this.vscodeAdapter = vscodeAdapter;
        
        // File system watcher for externally created files
        this.fileSystemWatcher = null;
        this.watchedDirectories = new Set();
        this.recentlyCreatedFiles = new Map(); // path -> timestamp (to avoid duplicate events)
    }

    /**
     * Set up file system watcher to detect externally created files (terminal, etc.)
     */
    setupFileSystemWatcher() {
        // Use vscodeAdapter if available (Ports and Adapters pattern), otherwise fallback to direct vscode
        const workspaceFolders = this.vscodeAdapter 
            ? this.vscodeAdapter.workspaceFolders 
            : vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            getLogger().log('AwarenessMonitor: No workspace folders, skipping file system watcher');
            return;
        }

        // Watch all workspace folders
        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath;
            if (this.watchedDirectories.has(folderPath)) {
                continue; // Already watching
            }

            try {
                getLogger().log(`AwarenessMonitor: Setting up file system watcher for ${folderPath}`);
                
                // Watch for file creation events
                const watcher = fs.watch(folderPath, { recursive: true }, (eventType, filename) => {
                    if (!filename) return;
                    
                    const filePath = path.join(folderPath, filename);
                    
                    // Only process 'rename' events (which includes file creation)
                    if (eventType === 'rename') {
                        // Check if file exists (it was created, not deleted)
                        fs.stat(filePath, (err, stats) => {
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
                                
                                getLogger().log(`AwarenessMonitor: Externally created file detected: ${filePath}`);
                                this.handleExternallyCreatedFile(filePath);
                            }
                        });
                    }
                });

                watcher.on('error', (err) => {
                    getLogger().log(`AwarenessMonitor: File system watcher error: ${err.message}`);
                    console.error('AwarenessMonitor: File system watcher error:', err);
                });

                this.fileSystemWatcher = watcher;
                this.watchedDirectories.add(folderPath);
                getLogger().log(`AwarenessMonitor: File system watcher active for ${folderPath}`);
            } catch (error) {
                getLogger().log(`AwarenessMonitor: Failed to set up file system watcher for ${folderPath}: ${error.message}`);
                console.error('AwarenessMonitor: Failed to set up file system watcher:', error);
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

        // Create a URI for the file
        // Use vscodeAdapter.Uri if available (Ports and Adapters pattern), otherwise fallback to vscode.Uri
        const Uri = this.vscodeAdapter ? this.vscodeAdapter.Uri : vscode.Uri;
        const fileUri = Uri.file(filePath);
        
        // Check scheme (skip virtual documents)
        if (isNonCodeDocument(fileUri.scheme)) {
            return;
        }

        getLogger().log(`AwarenessMonitor: Processing externally created file: ${filePath}`);
        
        // Process file as suggestion
        if (this.agentSuggestionHandler) {
            this.agentSuggestionHandler.processFileAsSuggestion(fileUri, {
                isFileCreation: true,
                isExternalCreation: true,
                filePath: filePath
            }).then(suggestion => {
                if (suggestion) {
                    getLogger().log(`AwarenessMonitor: Detected externally created file with content - ${suggestion.size} chars`);
                }
            }).catch(err => {
                getLogger().log(`AwarenessMonitor: Error reading externally created file: ${err.message}`, true);
            });
        }
    }

    /**
     * Scan existing files in workspace and add them to debt if needed
     * Called on startup to catch files that were created before the extension was active
     */
    scanExistingFiles() {
        // Use vscodeAdapter if available (Ports and Adapters pattern), otherwise fallback to direct vscode
        const workspaceFolders = this.vscodeAdapter 
            ? this.vscodeAdapter.workspaceFolders 
            : vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            getLogger().log('AwarenessMonitor: No workspace folders found, skipping file scan');
            return;
        }

        getLogger().log('AwarenessMonitor: Scanning existing files for debt...');
        
        const ignoreDirs = ['node_modules', '.git', '.vscode', 'dist', 'build', 'out', 'target', '.next', '.cache'];
        
        let scanned = 0;
        let added = 0;
        
        const scanDirectory = (dirPath) => {
            try {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                
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
                    
                    // Check file content
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        if (content.trim().length > 0) {
                            // File has content and isn't in debt yet - add it
                            getLogger().log(`AwarenessMonitor: Found existing file to add to debt: ${fullPath}`);
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
                getLogger().log(`AwarenessMonitor: Error scanning directory ${dirPath}: ${err.message}`);
            }
        };
        
        // Scan each workspace folder
        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath;
            getLogger().log(`AwarenessMonitor: Scanning workspace folder: ${folderPath}`);
            scanDirectory(folderPath);
        }
        
        getLogger().log(`AwarenessMonitor: File scan complete: ${scanned} files scanned, ${added} files added to debt`);
        
        // Trigger score update after scan (even if no files added, to refresh UI)
        setTimeout(() => {
            if (this.updateScore) {
                this.updateScore();
            }
            if (this.onScoreUpdate) {
                getLogger().log('AwarenessMonitor: Triggering score update callback after scan...');
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
            getLogger().log('AwarenessMonitor: File system watcher closed');
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

// @ai
// Arbitrary utility function for demonstration
function calculateFileHash(filePath) {
    // @ai
    const crypto = require('crypto');
    const fs = require('fs');
    // @ai
    try {
        const content = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(content).digest('hex');
    } catch (err) {
        return null;
    }
}

// @ai
// Some random configuration object
const watcherConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    enableDebugMode: false,
    customFilters: []
};

// @ai
// Export additional utility
module.exports.calculateFileHash = calculateFileHash;
module.exports.watcherConfig = watcherConfig;
