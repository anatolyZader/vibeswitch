/**
 * VibeSwitch Real-Time Awareness Monitor
 * Tracks user interaction with AI-generated code in DEV mode
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { getLogger } = require('./logger');

// Global logger instance
let logger = null;

function setLogOutput(channel) {
    logger = getLogger();
    if (channel && logger.outputChannel !== channel) {
        logger.outputChannel = channel;
    }
}

function log(message, force = false) {
    if (!logger) {
        logger = getLogger();
    }
    // Skip verbose debug logs by default (they're throttled anyway)
    if (message.includes('[DEBUG]') && !force) {
        logger.debug(message);
    } else {
        logger.log(message, force);
    }
}

class AwarenessMonitor {
    constructor(usageStats = null, onScoreUpdate = null) {
        // Usage statistics integration for AI-aware event tracking
        this.usageStats = usageStats;
        
        // Callback for immediate meter updates
        this.onScoreUpdate = onScoreUpdate;
        
        // Rolling window of last 10 AI suggestions (for immediate feedback)
        this.aiSuggestions = [];
        this.maxSuggestions = 10;
        
        // REVIEW DEBT SYSTEM - persistent tracking of unreviewed files
        this.reviewDebt = new Map(); // filepath -> debt object
        this.fileReviewTracking = new Map(); // filepath -> review session data
        
        // Current score (0-100)
        this.currentScore = 0;
        
        // Score components
        this.scores = {
            review: 0,      // 0-40 points
            critical: 0,    // 0-30 points
            adaptation: 0,  // 0-30 points
            debt: 0         // 0-30 points (NEW: unreviewed file debt)
        };
        
        // Update timer
        this.updateTimer = null;
        
        // Active document tracking
        this.activeDocument = null;
        this.cursorPosition = null;
        
        // Extension context for storage
        this.context = null;
        
        // Store disposables for cleanup
        this.disposables = [];
        
        // "Keep All" detection - track rapid acceptances
        this.recentAcceptances = [];
        this.keepAllDetectionWindow = 2000; // 2 seconds
        this.keepAllThreshold = 3; // Minimum acceptances to trigger
        
        // File system watcher for externally created files
        this.fileSystemWatcher = null;
        this.watchedDirectories = new Set();
        this.recentlyCreatedFiles = new Map(); // path -> timestamp (to avoid duplicate events)
    }

    /**
     * Start monitoring (called when switching to DEV mode)
     */
    start(context) {
        log('AwarenessMonitor: Starting real-time monitoring');
        log(`AwarenessMonitor: Callback registered: ${this.onScoreUpdate ? 'YES' : 'NO'}`);
        
        // Store context for workspace storage
        this.context = context;
        
        // Load existing review debt from storage
        this.loadReviewDebt();
        
        // Clear any existing subscriptions
        this.stop();
        
        // Track text changes (potential AI edits)
        const textChangeHandler = this.onTextChange.bind(this);
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(textChangeHandler)
        );
        log('AwarenessMonitor: Text change listener registered');
        
        // Track file creation (AI creating new files)
        this.disposables.push(
            vscode.workspace.onDidCreateFiles(this.onFilesCreated.bind(this))
        );
        
        // Track file saves (AI writing entire files)
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(this.onFileSaved.bind(this))
        );
        
        // Track file opens (user reviewing debt)
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument(this.onFileOpened.bind(this))
        );
        
        // Track cursor position (user reviewing code)
        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection(this.onCursorMove.bind(this))
        );
        
        // Track active editor (user switching to review)
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(this.onEditorChange.bind(this))
        );
        
        // Set up file system watcher for externally created files
        this.setupFileSystemWatcher();
        
        // Scan for existing files that should be in review debt
        this.scanExistingFiles();
        
        // Start periodic score updates (every 10 seconds)
        this.updateTimer = setInterval(() => {
            this.updateScore();
            this.checkReviewProgress();
        }, 10000);
        
        log(`AwarenessMonitor: Monitoring active with ${this.reviewDebt.size} files in debt`);
        log(`AwarenessMonitor: All event listeners registered and active`);
        log(`AwarenessMonitor: File system watcher active for ${this.watchedDirectories.size} directories`);
        
        // Log initial state
        log(`AwarenessMonitor: Initial score update...`);
        // If we have existing suggestions or debt, preserve the score calculation
        // Otherwise, calculate fresh
        if (this.aiSuggestions.length > 0 || this.reviewDebt.size > 0) {
            log(`AwarenessMonitor: Preserving existing state (${this.aiSuggestions.length} suggestions, ${this.reviewDebt.size} debt files)`);
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
        console.log('AwarenessMonitor: Stopping monitoring');
        log('AwarenessMonitor: Stopping monitoring');
        
        // Save review debt before stopping
        this.saveReviewDebt();
        
        // Dispose all event listeners
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        
        // Clean up file system watcher
        if (this.fileSystemWatcher) {
            this.fileSystemWatcher.close();
            this.fileSystemWatcher = null;
            log('AwarenessMonitor: File system watcher closed');
        }
        this.watchedDirectories.clear();
        this.recentlyCreatedFiles.clear();
        
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        // DON'T reset state - preserve suggestions and scores when stopping
        // This allows the meter to maintain its value when switching back to DEV mode
        // Only clear temporary tracking that's session-specific
        this.fileReviewTracking.clear();
        // Keep: this.aiSuggestions, this.currentScore, this.scores, this.reviewDebt, this.recentAcceptances
    }

    /**
     * Detect potential AI-generated code changes
     */
    onTextChange(event) {
        if (event.contentChanges.length === 0) return;
        
        const scheme = event.document.uri.scheme;
        const fileName = event.document.fileName || 'unknown';

        // Skip *only* non-code documents (output, debug, etc.)
        // Silent skip - no logging to avoid feedback loop with output channels
        if (['output', 'vscode', 'vscode-notebook', 'debug'].includes(scheme)) {
            return;
        }

        // For everything else (file, vscode-remote, cursor-remote, etc.) → track
        // Throttled: only log occasionally to avoid spam
        if (Math.random() < 0.1) { // 10% chance
            log(`AwarenessMonitor: ✅ Text change detected - scheme: ${scheme}, file: ${fileName}, changes: ${event.contentChanges.length}`);
        }
        
        // Analyze each change
        for (const change of event.contentChanges) {
            const changeSize = change.text.length;
            const isMultiLine = change.text.includes('\n');
            const isInsertion = change.rangeLength === 0;
            // Removed preview logging - too verbose

            // Ignore pure deletions (no inserted text)
            if (changeSize === 0) {
                this.recordUserEdit(event.document, change);
                continue;
            }

            // MUCH MORE PERMISSIVE: Cursor applies AI edits as many small single-line edits
            // - Any multi-line insert (regardless of size)
            // - Any insertion of length >= 5 chars
            // This catches Cursor's typical 5-12 char single-line AI edits
            const isLikelyAI = 
                isMultiLine ||
                (isInsertion && changeSize >= 5);
            
            if (isLikelyAI) {
                // Only log AI detections occasionally (throttled)
                log(
                    `AwarenessMonitor: ✅ AI-like change detected: size=${changeSize}, multiLine=${isMultiLine}, file=${event.document.fileName}`
                );
                this.recordAISuggestion(event.document, change);
            } else {
                // User edits - only log occasionally (throttled)
                // Removed verbose logging
                this.recordUserEdit(event.document, change);
            }
        }
    }

    /**
     * Handle file creation (AI creating new files)
     */
    onFilesCreated(event) {
        log(`AwarenessMonitor: onFilesCreated called with ${event.files.length} files`);
        for (const file of event.files) {
            const scheme = file.scheme;
            log(`AwarenessMonitor: File created event - scheme: ${scheme}, path: ${file.fsPath}`);
            // Silent skip for non-code documents
            if (['output', 'vscode', 'vscode-notebook', 'debug'].includes(scheme)) {
                continue;
            }
            
            log(`AwarenessMonitor: Processing file creation - ${file.fsPath}`);
            
            // Read the file to see its size
            vscode.workspace.openTextDocument(file).then(doc => {
                const content = doc.getText();
                
                // Treat any non-empty file as potentially AI-generated (removed 50-char threshold)
                if (content.trim().length > 0) {
                    log(`AwarenessMonitor: Detected AI file creation - ${content.length} chars`);
                    
                    // Create a "suggestion" for the entire file
                    const suggestion = {
                        id: Date.now() + Math.random(),
                        timestamp: Date.now(),
                        document: doc.uri.toString(),
                        range: new vscode.Range(0, 0, doc.lineCount, 0),
                        text: content,
                        size: content.length,
                        
                        reviewed: false,
                        reviewTime: 0,
                        reviewStarted: null,
                        
                        status: 'pending',
                        statusTimestamp: null,
                        
                        userEdited: false,
                        editCount: 0,
                        
                        isFileCreation: true // Mark as file creation
                    };
                    
                    this.aiSuggestions.push(suggestion);
                    
                    if (this.aiSuggestions.length > this.maxSuggestions) {
                        this.aiSuggestions.shift();
                    }
                    
                    // ADD TO REVIEW DEBT
                    this.addToReviewDebt(file.fsPath, content.length);
                    
                    // Check status after 5 seconds
                    setTimeout(() => this.checkSuggestionStatus(suggestion.id), 5000);
                    
                    // Immediately update score to reflect new activity
                    this.updateScore();
                }
            }).catch(err => {
                console.error('AwarenessMonitor: Error reading created file', err);
                log(`AwarenessMonitor: Error reading created file: ${err.message}`);
            });
        }
    }

    /**
     * Set up file system watcher to detect externally created files (terminal, etc.)
     */
    setupFileSystemWatcher() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            log('AwarenessMonitor: No workspace folders, skipping file system watcher');
            return;
        }

        // Watch all workspace folders
        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath;
            if (this.watchedDirectories.has(folderPath)) {
                continue; // Already watching
            }

            try {
                log(`AwarenessMonitor: Setting up file system watcher for ${folderPath}`);
                
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
                                
                                log(`AwarenessMonitor: Externally created file detected: ${filePath}`);
                                this.handleExternallyCreatedFile(filePath);
                            }
                        });
                    }
                });

                watcher.on('error', (err) => {
                    log(`AwarenessMonitor: File system watcher error: ${err.message}`);
                    console.error('AwarenessMonitor: File system watcher error:', err);
                });

                this.fileSystemWatcher = watcher;
                this.watchedDirectories.add(folderPath);
                log(`AwarenessMonitor: File system watcher active for ${folderPath}`);
            } catch (error) {
                log(`AwarenessMonitor: Failed to set up file system watcher for ${folderPath}: ${error.message}`);
                console.error('AwarenessMonitor: Failed to set up file system watcher:', error);
            }
        }
    }

    /**
     * Handle a file that was created externally (via terminal, etc.)
     */
    handleExternallyCreatedFile(filePath) {
        // Skip non-code files
        const ext = path.extname(filePath).toLowerCase();
        const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj', '.sh', '.bash', '.zsh', '.fish'];
        if (!codeExtensions.includes(ext)) {
            return; // Not a code file
        }

        // Create a URI for the file
        const fileUri = vscode.Uri.file(filePath);
        
        // Check scheme (skip virtual documents)
        if (['output', 'vscode', 'vscode-notebook', 'debug'].includes(fileUri.scheme)) {
            return;
        }

        log(`AwarenessMonitor: Processing externally created file: ${filePath}`);
        
        // Read the file to see its size
        vscode.workspace.openTextDocument(fileUri).then(doc => {
            const content = doc.getText();
            
            // Treat any non-empty file as potentially AI-generated (removed 50-char threshold)
            // Skip only completely empty files (whitespace-only files are still considered)
            if (content.trim().length > 0) {
                log(`AwarenessMonitor: Detected externally created file with content - ${content.length} chars`);
                
                // Create a "suggestion" for the entire file
                const suggestion = {
                    id: Date.now() + Math.random(),
                    timestamp: Date.now(),
                    document: doc.uri.toString(),
                    range: new vscode.Range(0, 0, doc.lineCount, 0),
                    text: content,
                    size: content.length,
                    
                    reviewed: false,
                    reviewTime: 0,
                    reviewStarted: null,
                    
                    status: 'pending',
                    statusTimestamp: null,
                    
                    userEdited: false,
                    editCount: 0,
                    
                    isFileCreation: true,
                    isExternalCreation: true // Mark as externally created
                };
                
                this.aiSuggestions.push(suggestion);
                
                if (this.aiSuggestions.length > this.maxSuggestions) {
                    this.aiSuggestions.shift();
                }
                
                // ADD TO REVIEW DEBT
                this.addToReviewDebt(filePath, content.length);
                
                // Check status after 5 seconds
                setTimeout(() => this.checkSuggestionStatus(suggestion.id), 5000);
                
                // Immediately update score to reflect new activity
                this.updateScore();
            }
        }).catch(err => {
            log(`AwarenessMonitor: Error reading externally created file: ${err.message}`);
            console.error('AwarenessMonitor: Error reading externally created file', err);
        });
    }

    /**
     * Scan existing files in workspace and add them to review debt if needed
     * Called on startup to catch files that were created before the extension was active
     */
    scanExistingFiles() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            log('AwarenessMonitor: No workspace folders found, skipping file scan');
            return;
        }

        log('AwarenessMonitor: Scanning existing files for review debt...');
        
        const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj', '.sh', '.bash', '.zsh', '.fish'];
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
                    if (!codeExtensions.includes(ext)) {
                        continue;
                    }
                    
                    scanned++;
                    
                    // Check if already in review debt
                    const normalizedPath = path.resolve(fullPath).replace(/\\/g, '/');
                    if (this.reviewDebt.has(normalizedPath)) {
                        continue; // Already tracked
                    }
                    
                    // Check file content
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        if (content.trim().length > 0) {
                            // File has content and isn't in debt yet - add it
                            log(`AwarenessMonitor: Found existing file to add to debt: ${fullPath}`);
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
                log(`AwarenessMonitor: Error scanning directory ${dirPath}: ${err.message}`);
            }
        };
        
        // Scan each workspace folder
        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath;
            log(`AwarenessMonitor: Scanning workspace folder: ${folderPath}`);
            scanDirectory(folderPath);
        }
        
        log(`AwarenessMonitor: File scan complete: ${scanned} files scanned, ${added} files added to review debt`);
        
        // Trigger score update after scan (even if no files added, to refresh UI)
        setTimeout(() => {
            this.updateScore();
            if (this.onScoreUpdate) {
                log('AwarenessMonitor: Triggering score update callback after scan...');
                this.onScoreUpdate();
            }
        }, added > 0 ? 2000 : 500); // Longer delay if files were added (to allow async file reading to complete)
    }

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
            aiSuggestionsCount: this.aiSuggestions.length,
            reviewDebtCount: this.reviewDebt.size,
            currentScore: this.currentScore,
            scores: { ...this.scores },
            watchedDirectories: Array.from(this.watchedDirectories),
            hasFileSystemWatcher: !!this.fileSystemWatcher,
            workspaceFolders: workspaceFolders ? workspaceFolders.map(f => f.uri.fsPath) : [],
            hasUpdateTimer: !!this.updateTimer,
            recentAcceptances: this.recentAcceptances.length
        };
    }

    /**
     * Handle file saves (entire file writes by AI)
     */
    onFileSaved(document) {
        const scheme = document.uri.scheme;
        if (['output', 'vscode', 'vscode-notebook', 'debug'].includes(scheme)) {
            return;
        }
        
        const content = document.getText();
        
        // Lowered threshold to catch more AI file operations
        if (content.length > 200) {  // was 500
            console.log(`AwarenessMonitor: Large file saved - ${content.length} chars in ${document.fileName}`);
            
            // Check if we already tracked this file recently (avoid duplicates)
            const recentSuggestion = this.aiSuggestions.find(s => 
                s.document === document.uri.toString() && 
                (Date.now() - s.timestamp) < 3000 // Within last 3 seconds
            );
            
            if (!recentSuggestion) {
                console.log('AwarenessMonitor: Detected AI file write');
                
                const suggestion = {
                    id: Date.now() + Math.random(),
                    timestamp: Date.now(),
                    document: document.uri.toString(),
                    range: new vscode.Range(0, 0, document.lineCount, 0),
                    text: content,
                    size: content.length,
                    
                    reviewed: false,
                    reviewTime: 0,
                    reviewStarted: null,
                    
                    status: 'pending',
                    statusTimestamp: null,
                    
                    userEdited: false,
                    editCount: 0,
                    
                    isFileWrite: true // Mark as file write
                };
                
                this.aiSuggestions.push(suggestion);
                
                if (this.aiSuggestions.length > this.maxSuggestions) {
                    this.aiSuggestions.shift();
                }
                
                // ADD TO REVIEW DEBT
                this.addToReviewDebt(document.uri.fsPath, content.length);
                
                setTimeout(() => this.checkSuggestionStatus(suggestion.id), 5000);
                
                // Immediately update score
                this.updateScore();
            }
        }
    }

    /**
     * Record a detected AI suggestion
     */
    recordAISuggestion(document, change) {
        const filePath = document.uri.fsPath;
        const timestamp = Date.now();
        const changeSize = change.text.length;
        
        // Reduced verbose debug logging - only log summary
        log(`[DEBUG] 📝 AI suggestion: ${changeSize} chars in ${path.basename(filePath)}`);
        
        const suggestion = {
            id: timestamp + Math.random(), // Unique ID
            timestamp: timestamp,
            document: document.uri.toString(),
            range: change.range,
            text: change.text,
            size: changeSize,
            
            // Tracking metrics
            reviewed: false,           // Did user position cursor on this?
            reviewTime: 0,            // Time spent reviewing (ms)
            reviewStarted: null,      // When review started
            
            status: 'pending',        // 'pending', 'accepted', 'rejected', 'adapted'
            statusTimestamp: null,    // When status determined
            
            userEdited: false,        // Did user modify this code?
            editCount: 0              // Number of edits to this suggestion
        };
        
        // Add to rolling window
        this.aiSuggestions.push(suggestion);
        
        // Keep only last 10
        if (this.aiSuggestions.length > this.maxSuggestions) {
            this.aiSuggestions.shift();
        }
        
        // ADD TO REVIEW DEBT
        this.addToReviewDebt(filePath, changeSize);
        
        // EMIT AI EVENT TO USAGE STATISTICS
        if (this.usageStats) {
            this.usageStats.trackAISuggestion({
                filePath,
                size: suggestion.size,
                timestamp: suggestion.timestamp,
                isFileCreation: false
            });
        }
        
        // Recompute immediately
        this.updateScore();
        
        // Schedule status check (after 5 seconds, classify as accept/reject)
        setTimeout(() => {
            this.checkSuggestionStatus(suggestion.id);
        }, 5000);
    }

    /**
     * Record user edits (might be adapting AI suggestions)
     */
    recordUserEdit(document, change) {
        const filePath = document.uri.fsPath;
        const fileName = filePath.split('/').pop();
        const changeSize = change.text.length;
        
        // Check if edit overlaps with any AI suggestion
        let foundOverlap = false;
        for (const suggestion of this.aiSuggestions) {
            if (suggestion.document !== document.uri.toString()) continue;
            if (suggestion.status !== 'pending') continue;
            
            // Check if edit overlaps with suggestion
            if (this.rangesOverlap(change.range, suggestion.range)) {
                foundOverlap = true;
                suggestion.userEdited = true;
                suggestion.editCount++;
                
                // Reduced logging - only log occasionally
                if (Math.random() < 0.2) { // 20% chance
                    log(`[DEBUG] ✏️  User edit overlaps AI suggestion in ${fileName}`);
                }
            }
        }
        
        // Removed verbose logging for non-overlapping edits
    }

    /**
     * Check if suggestion was accepted, rejected, or adapted
     */
    async checkSuggestionStatus(suggestionId) {
        const suggestion = this.aiSuggestions.find(s => s.id === suggestionId);
        if (!suggestion) {
            return;
        }
        
        if (suggestion.status !== 'pending') {
            return;
        }
        
        // Try to open the document to check if code still exists
        try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(suggestion.document));
            const currentText = doc.getText(suggestion.range);
            const currentSize = currentText.length;
            const sizeRatio = currentSize / suggestion.size;
            
            // Check if AI code was deleted/rejected
            if (currentSize < suggestion.size * 0.5) {
                suggestion.status = 'rejected';
                suggestion.statusTimestamp = Date.now();
                log(`[DEBUG] Suggestion rejected: ${(sizeRatio * 100).toFixed(1)}% of original`);
            }
            // Check if AI code was modified/adapted
            else if (suggestion.userEdited) {
                suggestion.status = 'adapted';
                suggestion.statusTimestamp = Date.now();
                log(`[DEBUG] Suggestion adapted by user`);
            }
            // DEV MODE STRICTNESS: Require user review for ALL AI suggestions
            // This ensures no code is marked as "accepted" without actual user review
            else {
                // Determine source type for logging
                let sourceType = 'AI suggestion';
                if (suggestion.isFileCreation || suggestion.isExternalCreation) {
                    sourceType = suggestion.isExternalCreation ? 'externally created file' : 'file creation';
                } else if (suggestion.isFileWrite) {
                    sourceType = 'agent file write';
                } else {
                    sourceType = 'text change';
                }
                
                if (suggestion.reviewed) {
                    // User has reviewed it, can mark as accepted
                    suggestion.status = 'accepted';
                    suggestion.statusTimestamp = Date.now();
                    log(`[DEBUG] Suggestion accepted (${sourceType})`);
                    this.trackAcceptance(suggestion);
                } else {
                    // No user interaction yet - keep pending
                    // DEV MODE: All suggestions require review, even if code exists unchanged
                    // Schedule another check in 10 seconds
                    setTimeout(() => this.checkSuggestionStatus(suggestion.id), 10000);
                    return; // Exit early, don't emit outcome yet
                }
            }
            
            // EMIT OUTCOME TO USAGE STATISTICS
            if (this.usageStats) {
                this.usageStats.trackAISuggestionOutcome({
                    document: suggestion.document,
                    status: suggestion.status,
                    reviewTime: suggestion.reviewTime,
                    editCount: suggestion.editCount,
                    size: suggestion.size
                });
            }
            
            this.updateScore();
            
        } catch (error) {
            // Document might be closed/deleted
            suggestion.status = 'rejected';
            suggestion.statusTimestamp = Date.now();
            log(`[DEBUG] Suggestion rejected (document error): ${error.message}`, true);
            
            // EMIT OUTCOME TO USAGE STATISTICS
            if (this.usageStats) {
                this.usageStats.trackAISuggestionOutcome({
                    document: suggestion.document,
                    status: 'rejected',
                    reviewTime: suggestion.reviewTime,
                    editCount: suggestion.editCount,
                    size: suggestion.size
                });
            }
            
            this.updateScore();
        }
    }

    /**
     * Calculate awareness score based on last 10 seconds of suggestions
     */
    updateScore() {
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for "recent activity" calculation
        const recentSuggestions = this.aiSuggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // BUT: If we have older suggestions but no recent ones, and we have review debt,
        // preserve the score based on debt rather than resetting to zero
        const hasOlderSuggestions = this.aiSuggestions.length > 0 && recentSuggestions.length === 0;
        const hasDebt = this.reviewDebt.size > 0;
        
        // Only log score updates occasionally (throttled)
        if (Math.random() < 0.1) { // 10% chance
            log(`[DEBUG] Updating score: ${recentSuggestions.length} recent, ${this.aiSuggestions.length} total, ${this.reviewDebt.size} debt`);
        }
        
        // Only calculate if we have suggestions in the last 10 seconds
        if (recentSuggestions.length === 0) {
            // Even with no recent suggestions, calculate debt score if there's review debt
            const debtScore = this.calculateDebtScore();
            
            if (debtScore > 0) {
                // If there's review debt but no pending, show debt score
                this.currentScore = Math.min(debtScore, 100); // Cap at 100
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
            } else if (hasOlderSuggestions && hasDebt) {
                // We have older suggestions and debt - preserve a minimum score based on debt
                // This prevents the meter from dropping to zero when monitor restarts
                const preservedDebtScore = this.calculateDebtScore();
                this.currentScore = Math.max(preservedDebtScore, 20); // Minimum 20 to show activity
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: preservedDebtScore };
            } else {
                // No recent activity and no debt
                this.currentScore = -1; // Special value: no data yet
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            }
            // Trigger callback for meter update
            if (this.onScoreUpdate) {
                this.onScoreUpdate();
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
            const debtScore = this.calculateDebtScore();
            
            this.currentScore = 50; // Neutral - pending activity detected
            this.scores = { 
                review: 0, 
                critical: 0, 
                adaptation: 0, 
                debt: debtScore // Still calculate debt
            };
            
            // Trigger callback for meter update
            if (this.onScoreUpdate) {
                this.onScoreUpdate();
            }
            return;
        }
        
        if (completed.length === 0) {
            // No suggestions at all
            this.currentScore = -1;
            this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            if (this.onScoreUpdate) {
                this.onScoreUpdate();
            }
            return;
        }
        
        // 1. Code Review Rate (40 points)
        this.scores.review = this.calculateReviewScore(completed);
        
        // 2. Critical Evaluation (30 points)
        this.scores.critical = this.calculateCriticalScore(completed);
        
        // 3. Code Adaptation (30 points)
        this.scores.adaptation = this.calculateAdaptationScore(completed);
        
        // 4. Review Debt (30 points) - NEW!
        this.scores.debt = this.calculateDebtScore();
        
        // Total score (max 130, normalized to 100)
        const rawScore = this.scores.review + 
                        this.scores.critical + 
                        this.scores.adaptation + 
                        this.scores.debt;
        
        this.currentScore = Math.round(Math.min(rawScore, 100));
        
        // Trigger callback for immediate meter update
        if (this.onScoreUpdate) {
            this.onScoreUpdate();
        }
    }

    /**
     * Calculate review score (0-40)
     * High score = user carefully reviewed code
     */
    calculateReviewScore(suggestions) {
        const reviewedCount = suggestions.filter(s => s.reviewed).length;
        const totalReviewTime = suggestions.reduce((sum, s) => sum + s.reviewTime, 0);
        const avgReviewTime = totalReviewTime / suggestions.length;
        
        // Review rate (0-20): % of suggestions reviewed
        const reviewRate = (reviewedCount / suggestions.length) * 20;
        
        // Review depth (0-20): Average time spent reviewing
        // Good: 10+ seconds per suggestion = 20 points
        // Fair: 5-10 seconds = 10-20 points
        // Poor: <5 seconds = 0-10 points
        const reviewDepth = Math.min((avgReviewTime / 10000) * 20, 20);
        
        return Math.round(reviewRate + reviewDepth);
    }

    /**
     * Calculate critical evaluation score (0-30)
     * High score = user is selective (accepts some, rejects some)
     * LOW SCORE = GOOD in DEV mode (means careful, not blind acceptance)
     */
    calculateCriticalScore(suggestions) {
        const accepted = suggestions.filter(s => s.status === 'accepted').length;
        const rejected = suggestions.filter(s => s.status === 'rejected').length;
        const total = suggestions.length;
        
        const acceptRate = accepted / total;
        const rejectRate = rejected / total;
        
        // INVERTED: In DEV mode, blind acceptance = HIGH score (bad)
        // We want LOW scores (careful review, selective acceptance)
        
        if (acceptRate === 1.0) {
            // Accepts everything blindly - WORST (high score = bad in DEV)
            return 30;
        } else if (rejectRate === 1.0) {
            // Rejects everything (not using AI effectively)
            return 20;
        } else if (acceptRate >= 0.6 && acceptRate <= 0.8) {
            // Moderate acceptance - not great, not terrible
            return 15;
        } else if (acceptRate < 0.5) {
            // Low acceptance rate = careful review = BEST
            return 0;
        } else {
            // Linear interpolation for other cases
            return Math.round(acceptRate * 30);
        }
    }

    /**
     * Calculate adaptation score (0-30)
     * High score = user customizes AI suggestions
     */
    calculateAdaptationScore(suggestions) {
        const adapted = suggestions.filter(s => s.status === 'adapted').length;
        const adaptRate = adapted / suggestions.length;
        
        // Average edits per suggestion
        const totalEdits = suggestions.reduce((sum, s) => sum + s.editCount, 0);
        const avgEdits = totalEdits / suggestions.length;
        
        // Adaptation rate (0-15): % of suggestions user edited
        const adaptationRate = adaptRate * 15;
        
        // Adaptation depth (0-15): How much editing per suggestion
        // Good: 2+ edits = 15 points
        // Fair: 1 edit = 7.5 points
        // Poor: 0 edits = 0 points
        const adaptationDepth = Math.min((avgEdits / 2) * 15, 15);
        
        return Math.round(adaptationRate + adaptationDepth);
    }

    /**
     * Helper: Get relative path from workspace folder
     */
    getRelativePath(filePath) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return path.basename(filePath);
        }
        
        // Try each workspace folder
        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath;
            if (filePath.startsWith(folderPath)) {
                const relative = path.relative(folderPath, filePath);
                return relative || path.basename(filePath);
            }
        }
        
        // Fallback to basename if not in workspace
        return path.basename(filePath);
    }

    /**
     * Get current awareness score and breakdown
     */
    getScore() {
        const debtSummary = this.getReviewDebtSummary();
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        // Filter suggestions from last 10 seconds for score calculation
        const recentSuggestions = this.aiSuggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        // For display: show ALL suggestions (not just last 10 seconds) so meter shows activity
        // But use recentSuggestions for actual score calculation
        const allSuggestions = this.aiSuggestions;
        
        // Get pending suggestions with file paths
        const pendingSuggestions = allSuggestions
            .filter(s => s.status === 'pending')
            .map(s => {
                // Extract file path from document URI or use filePath if available
                let filePath = s.filePath;
                if (!filePath && s.document) {
                    try {
                        const uri = vscode.Uri.parse(s.document);
                        if (uri.scheme === 'file') {
                            filePath = uri.fsPath;
                        }
                    } catch (err) {
                        log(`AwarenessMonitor: Error parsing document URI: ${err.message}`);
                    }
                }
                return {
                    path: filePath ? this.getRelativePath(filePath) : 'Unknown',
                    fullPath: filePath || '',
                    ageMinutes: Math.round((now - s.timestamp) / (1000 * 60)),
                    type: s.isFileCreation ? 'file creation' : 
                          s.isExternalCreation ? 'external file' :
                          s.isFileWrite ? 'file write' : 'text change'
                };
            });
        
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
                    path: this.getRelativePath(f.path), // Relative path instead of just filename
                    fullPath: f.path,
                    ageMinutes: Math.round(f.age / (1000 * 60)),
                    modifications: f.modificationCount
                }))
            },
            // Add debug info for troubleshooting
            debug: {
                lastActivity: recentSuggestions.length > 0 ? 
                    new Date(recentSuggestions[recentSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                    (this.aiSuggestions.length > 0 ? 
                    new Date(this.aiSuggestions[this.aiSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                        'None'),
                monitoringActive: this.updateTimer !== null,
                totalDebtEntries: this.reviewDebt.size,
                recentWindowCount: recentSuggestions.length,
                totalTrackedCount: this.aiSuggestions.length
            }
        };
    }

    /**
     * Helper: Check if position is within range
     */
    isPositionInRange(position, range) {
        if (position.line < range.start.line || position.line > range.end.line) {
            return false;
        }
        if (position.line === range.start.line && position.character < range.start.character) {
            return false;
        }
        if (position.line === range.end.line && position.character > range.end.character) {
            return false;
        }
        return true;
    }

    /**
     * Helper: Check if two ranges overlap
     */
    rangesOverlap(range1, range2) {
        // Check if ranges are on same lines or overlapping lines
        return !(range1.end.line < range2.start.line || range1.start.line > range2.end.line);
    }

    // ==================== "KEEP ALL" DETECTION ====================

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
            
            log(`AwarenessMonitor: "Keep All" detected - ${recent.length} suggestions accepted across ${uniqueFiles.size} files`);
            
            // Emit to usage statistics
            if (this.usageStats && this.usageStats.trackKeepAll) {
                this.usageStats.trackKeepAll({
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

    // ==================== REVIEW DEBT SYSTEM ====================

    /**
     * Load review debt from workspace storage
     */
    loadReviewDebt() {
        if (!this.context) return;
        
        try {
            const stored = this.context.workspaceState.get('reviewDebt', {});
            this.reviewDebt = new Map(Object.entries(stored));
            
            console.log(`AwarenessMonitor: Loaded ${this.reviewDebt.size} files with review debt`);
            
            // Clean up old debt (older than 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            for (const [path, debt] of this.reviewDebt.entries()) {
                if (debt.modifiedAt < sevenDaysAgo) {
                    this.reviewDebt.delete(path);
                    console.log(`AwarenessMonitor: Removed stale debt for ${path}`);
                }
            }
            
            this.saveReviewDebt();
        } catch (error) {
            console.error('AwarenessMonitor: Error loading review debt', error);
            this.reviewDebt = new Map();
        }
    }

    /**
     * Save review debt to workspace storage
     */
    saveReviewDebt() {
        if (!this.context) return;
        
        try {
            const debtObject = Object.fromEntries(this.reviewDebt);
            this.context.workspaceState.update('reviewDebt', debtObject);
        } catch (error) {
            console.error('AwarenessMonitor: Error saving review debt', error);
        }
    }

    /**
     * Add file to review debt
     */
    addToReviewDebt(filePath, changeSize) {
        const existing = this.reviewDebt.get(filePath);
        const now = Date.now();
        
        if (existing && !existing.reviewed) {
            // File already has debt, accumulate it
            existing.totalChanges += changeSize;
            existing.lastModifiedAt = now;
            existing.modificationCount++;
        } else if (existing && existing.reviewed) {
            // File was reviewed but new changes came in - create new entry
            this.reviewDebt.set(filePath, {
                modifiedAt: now,
                lastModifiedAt: now,
                totalChanges: changeSize,
                modificationCount: 1,
                reviewed: false,
                firstOpenedAt: null,
                totalReviewTime: 0,
                lastVisitedAt: null,
                reviewSessions: 0
            });
        } else {
            // New debt entry
            this.reviewDebt.set(filePath, {
                modifiedAt: now,
                lastModifiedAt: now,
                totalChanges: changeSize,
                modificationCount: 1,
                reviewed: false,
                firstOpenedAt: null,
                totalReviewTime: 0,
                lastVisitedAt: null,
                reviewSessions: 0
            });
        }
        
        this.saveReviewDebt();
        
        // Trigger immediate score update to refresh file decorations
        if (this.onScoreUpdate) {
            this.updateScore();
        }
    }

    /**
     * Handle file opened (user might be reviewing debt)
     */
    onFileOpened(document) {
        const scheme = document.uri.scheme;
        if (['output', 'vscode', 'vscode-notebook', 'debug'].includes(scheme)) {
            return;
        }
        
        const filePath = document.uri.fsPath;
        const debt = this.reviewDebt.get(filePath);
        
        if (debt && !debt.reviewed) {
            // Start tracking review session
            if (!this.fileReviewTracking.has(filePath)) {
                const now = Date.now();
                this.fileReviewTracking.set(filePath, {
                    sessionStart: now,
                    lastActivity: now,
                    cursorMovements: 0,
                    scrollEvents: 0
                });
                
                debt.firstOpenedAt = debt.firstOpenedAt || now;
                debt.lastVisitedAt = now;
                debt.reviewSessions++;
                
                this.saveReviewDebt();
            }
        }
    }

    /**
     * Check review progress periodically
     */
    checkReviewProgress() {
        const now = Date.now();
        const MINIMUM_REVIEW_TIME = 30000; // 30 seconds
        const ACTIVITY_TIMEOUT = 60000; // 1 minute of inactivity ends session
        
        const activeSessions = this.fileReviewTracking.size;
        if (activeSessions === 0) {
            return; // No active review sessions
        }
        
        for (const [filePath, tracking] of this.fileReviewTracking.entries()) {
            const debt = this.reviewDebt.get(filePath);
            if (!debt || debt.reviewed) {
                this.fileReviewTracking.delete(filePath);
                continue;
            }
            
            const sessionDuration = now - tracking.sessionStart;
            const timeSinceActivity = now - tracking.lastActivity;
            
            // Check if session ended due to inactivity
            if (timeSinceActivity > ACTIVITY_TIMEOUT) {
                debt.totalReviewTime += sessionDuration;
                this.fileReviewTracking.delete(filePath);
                this.saveReviewDebt();
                continue;
            }
            
            // Check if user has reviewed enough
            if (sessionDuration >= MINIMUM_REVIEW_TIME && tracking.cursorMovements >= 5) {
                // Debt is paid!
                debt.reviewed = true;
                debt.reviewedAt = now;
                debt.totalReviewTime += sessionDuration;
                this.fileReviewTracking.delete(filePath);
                
                // EMIT DEBT CLEARED TO USAGE STATISTICS
                if (this.usageStats) {
                    this.usageStats.trackAIDebtCleared({
                        filePath,
                        totalChanges: debt.totalChanges,
                        totalReviewTime: debt.totalReviewTime,
                        modificationCount: debt.modificationCount
                    });
                }
                
                this.saveReviewDebt();
                this.updateScore(); // Recalculate score immediately
            }
        }
    }

    /**
     * Track cursor activity in files being reviewed
     */
    onCursorMove(event) {
        if (!event.textEditor || !event.selections.length) return;
        
        const editor = event.textEditor;
        const position = event.selections[0].active;
        const filePath = editor.document.uri.fsPath;
        const fileName = filePath.split('/').pop();
        
        this.cursorPosition = position;
        
        // Update review tracking if this file has debt
        const tracking = this.fileReviewTracking.get(filePath);
        if (tracking) {
            tracking.lastActivity = Date.now();
            tracking.cursorMovements++;
        }
        
        // Check if cursor is on any AI suggestion (original logic)
        for (const suggestion of this.aiSuggestions) {
            if (suggestion.document !== editor.document.uri.toString()) continue;
            if (suggestion.status !== 'pending') continue;
            
            // Check if cursor is within suggestion range
            if (this.isPositionInRange(position, suggestion.range)) {
                if (!suggestion.reviewed) {
                    suggestion.reviewed = true;
                    suggestion.reviewStarted = Date.now();
                }
                return; // Only track one suggestion at a time
            } else {
                // Cursor left the suggestion
                if (suggestion.reviewStarted) {
                    const reviewDuration = Date.now() - suggestion.reviewStarted;
                    suggestion.reviewTime += reviewDuration;
                    suggestion.reviewStarted = null;
                }
            }
        }
    }

    /**
     * Track active editor changes
     */
    onEditorChange(editor) {
        this.activeDocument = editor?.document;
        
        // Track as file opened if it has debt
        if (editor?.document) {
            this.onFileOpened(editor.document);
        }
        
        // Stop any active reviews when switching files
        for (const suggestion of this.aiSuggestions) {
            if (suggestion.reviewStarted) {
                suggestion.reviewTime += Date.now() - suggestion.reviewStarted;
                suggestion.reviewStarted = null;
            }
        }
    }

    /**
     * Calculate debt score (0-30)
     * High score = lots of unreviewed files (BAD in DEV mode)
     */
    calculateDebtScore() {
        const unreviewedFiles = Array.from(this.reviewDebt.values())
            .filter(d => !d.reviewed);
        
        // Pending suggestions are also debt - they represent unreviewed AI-generated code
        const pendingSuggestions = this.aiSuggestions.filter(s => s.status === 'pending');
        
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
     * Get review debt summary for UI
     */
    getReviewDebtSummary() {
        const unreviewedFiles = Array.from(this.reviewDebt.entries())
            .filter(([_, debt]) => !debt.reviewed)
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
}

module.exports = AwarenessMonitor;
module.exports.setLogOutput = setLogOutput;



