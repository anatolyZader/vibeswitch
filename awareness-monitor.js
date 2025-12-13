/**
 * VibeSwitch Real-Time Awareness Monitor
 * Tracks user interaction with AI-generated code in DEV mode
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Global output channel for logging (set by extension)
let logOutput = null;

function setLogOutput(channel) {
    logOutput = channel;
}

function log(message) {
    console.log(message);
    if (logOutput) {
        logOutput.appendLine(message);
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
        this.updateScore();
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
        
        // Reset temporary state but KEEP review debt
        this.aiSuggestions = [];
        this.currentScore = 0;
        this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
        this.fileReviewTracking.clear();
        this.recentAcceptances = [];
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
        log(`AwarenessMonitor: ✅ Text change detected - scheme: ${scheme}, file: ${fileName}, changes: ${event.contentChanges.length}`);
        
        // Analyze each change
        for (const change of event.contentChanges) {
            const changeSize = change.text.length;
            const isMultiLine = change.text.includes('\n');
            const isInsertion = change.rangeLength === 0;
            const preview = change.text.substring(0, 50).replace(/\n/g, '\\n');

            // Log every change for debugging
            log(
                `[Awareness] Change: size=${changeSize}, hasNewline=${isMultiLine}, rangeLength=${change.rangeLength}, isInsertion=${isInsertion}, preview="${preview}${changeSize > 50 ? '...' : ''}"`
            );

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
                log(
                    `AwarenessMonitor: ✅ AI-like change detected: size=${changeSize}, multiLine=${isMultiLine}, insertion=${isInsertion}, rangeLength=${change.rangeLength}, file=${event.document.fileName}`
                );
                this.recordAISuggestion(event.document, change);
            } else {
                // Everything else counts as user edit
                log(
                    `AwarenessMonitor: ⚪ User edit (not AI): size=${changeSize}, multiLine=${isMultiLine}, insertion=${isInsertion}`
                );
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
                
                // If file has substantial content, it's likely AI-generated
                if (content.length > 50) {
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
            
            // If file has substantial content, treat it as potentially AI-generated
            if (content.length > 50) {
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
        const preview = change.text.substring(0, 100).replace(/\n/g, '\\n');
        
        log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        log(`[DEBUG] 📝 RECORDING AI SUGGESTION`);
        log(`[DEBUG]   File: ${filePath}`);
        log(`[DEBUG]   Size: ${changeSize} chars`);
        log(`[DEBUG]   Range: L${change.range.start.line}:${change.range.start.character} → L${change.range.end.line}:${change.range.end.character}`);
        log(`[DEBUG]   Preview: "${preview}${changeSize > 100 ? '...' : ''}"`);
        log(`[DEBUG]   Timestamp: ${new Date(timestamp).toISOString()}`);
        
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
        const beforeCount = this.aiSuggestions.length;
        this.aiSuggestions.push(suggestion);
        
        // Keep only last 10
        if (this.aiSuggestions.length > this.maxSuggestions) {
            const removed = this.aiSuggestions.shift();
            log(`[DEBUG]   ⚠️  Removed oldest suggestion (ID: ${removed.id}, kept ${this.maxSuggestions} suggestions)`);
        }
        
        log(`[DEBUG]   Suggestions array: ${beforeCount} → ${this.aiSuggestions.length}`);
        log(`[DEBUG]   Suggestion ID: ${suggestion.id}`);
        
        // ADD TO REVIEW DEBT
        log(`[DEBUG]   → Calling addToReviewDebt(${filePath}, ${changeSize})`);
        this.addToReviewDebt(filePath, changeSize);
        
        // EMIT AI EVENT TO USAGE STATISTICS
        if (this.usageStats) {
            log(`[DEBUG]   → Emitting to usageStats.trackAISuggestion`);
            this.usageStats.trackAISuggestion({
                filePath,
                size: suggestion.size,
                timestamp: suggestion.timestamp,
                isFileCreation: false
            });
        }
        
        // NEW: recompute immediately
        log(`[DEBUG]   → Triggering immediate score update...`);
        this.updateScore();
        
        // Schedule status check (after 5 seconds, classify as accept/reject)
        log(`[DEBUG]   → Scheduling status check in 5 seconds (suggestion ID: ${suggestion.id})`);
        setTimeout(() => {
            log(`[DEBUG] ⏰ Status check timer fired for suggestion ID: ${suggestion.id}`);
            this.checkSuggestionStatus(suggestion.id);
        }, 5000);
        
        log(`[DEBUG] ✅ AI suggestion recorded successfully`);
        log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
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
                const oldEditCount = suggestion.editCount;
                suggestion.userEdited = true;
                suggestion.editCount++;
                
                log(`[DEBUG] ✏️  USER EDIT OVERLAPS AI SUGGESTION`);
                log(`[DEBUG]   File: ${fileName}`);
                log(`[DEBUG]   Suggestion ID: ${suggestion.id}`);
                log(`[DEBUG]   Edit size: ${changeSize} chars`);
                log(`[DEBUG]   Edit count: ${oldEditCount} → ${suggestion.editCount}`);
                log(`[DEBUG]   Original suggestion size: ${suggestion.size} chars`);
                log(`[DEBUG]   Status: ${suggestion.status} (will become 'adapted' if kept)`);
            }
        }
        
        if (!foundOverlap) {
            // Only log occasionally to avoid spam
            if (Math.random() < 0.1) { // 10% chance
                log(`[DEBUG] ⚪ User edit (no AI suggestion overlap) - File: ${fileName}, Size: ${changeSize} chars`);
            }
        }
    }

    /**
     * Check if suggestion was accepted, rejected, or adapted
     */
    async checkSuggestionStatus(suggestionId) {
        log(`[DEBUG] ──────────────────────────────────────────────────────────────────────────`);
        log(`[DEBUG] 🔍 CHECKING SUGGESTION STATUS`);
        log(`[DEBUG]   Suggestion ID: ${suggestionId}`);
        
        const suggestion = this.aiSuggestions.find(s => s.id === suggestionId);
        if (!suggestion) {
            log(`[DEBUG]   ❌ Suggestion not found in array`);
            log(`[DEBUG] ──────────────────────────────────────────────────────────────────────────`);
            return;
        }
        
        if (suggestion.status !== 'pending') {
            log(`[DEBUG]   ⚠️  Suggestion already has status: ${suggestion.status}`);
            log(`[DEBUG] ──────────────────────────────────────────────────────────────────────────`);
            return;
        }
        
        log(`[DEBUG]   File: ${suggestion.document}`);
        log(`[DEBUG]   Original size: ${suggestion.size} chars`);
        log(`[DEBUG]   User edited: ${suggestion.userEdited}`);
        log(`[DEBUG]   Edit count: ${suggestion.editCount}`);
        log(`[DEBUG]   Review time: ${suggestion.reviewTime}ms`);
        log(`[DEBUG]   Reviewed: ${suggestion.reviewed}`);
        
        // Try to open the document to check if code still exists
        try {
            log(`[DEBUG]   → Opening document to check current state...`);
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(suggestion.document));
            const currentText = doc.getText(suggestion.range);
            const currentSize = currentText.length;
            const sizeRatio = currentSize / suggestion.size;
            
            log(`[DEBUG]   Current text size: ${currentSize} chars`);
            log(`[DEBUG]   Size ratio: ${(sizeRatio * 100).toFixed(1)}%`);
            
            // Check if AI code was deleted/rejected
            if (currentSize < suggestion.size * 0.5) {
                suggestion.status = 'rejected';
                suggestion.statusTimestamp = Date.now();
                log(`[DEBUG]   ❌ STATUS: REJECTED (text reduced to ${(sizeRatio * 100).toFixed(1)}% of original)`);
            }
            // Check if AI code was modified/adapted
            else if (suggestion.userEdited) {
                suggestion.status = 'adapted';
                suggestion.statusTimestamp = Date.now();
                log(`[DEBUG]   ✏️  STATUS: ADAPTED (user edited the code)`);
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
                    log(`[DEBUG]   ✅ STATUS: ACCEPTED (${sourceType}, user reviewed)`);
                    
                    // Track acceptance for "Keep All" detection
                    log(`[DEBUG]   → Tracking acceptance for "Keep All" detection...`);
                    this.trackAcceptance(suggestion);
                } else {
                    // No user interaction yet - keep pending
                    // DEV MODE: All suggestions require review, even if code exists unchanged
                    log(`[DEBUG]   ⏳ STATUS: PENDING (${sourceType}, awaiting user review)`);
                    log(`[DEBUG]   → Code exists but user hasn't reviewed it yet (DEV mode strictness)`);
                    // Don't change status, keep it pending
                    // Schedule another check in 10 seconds
                    setTimeout(() => this.checkSuggestionStatus(suggestion.id), 10000);
                    return; // Exit early, don't emit outcome yet
                }
            }
            
            log(`[DEBUG]   Status timestamp: ${new Date(suggestion.statusTimestamp).toISOString()}`);
            
            // EMIT OUTCOME TO USAGE STATISTICS
            if (this.usageStats) {
                log(`[DEBUG]   → Emitting outcome to usageStats`);
                this.usageStats.trackAISuggestionOutcome({
                    document: suggestion.document,
                    status: suggestion.status,
                    reviewTime: suggestion.reviewTime,
                    editCount: suggestion.editCount,
                    size: suggestion.size
                });
            }
            
            log(`[DEBUG]   → Triggering score update after status change...`);
            this.updateScore();
            
        } catch (error) {
            // Document might be closed/deleted
            log(`[DEBUG]   ⚠️  Error checking document: ${error.message}`);
            suggestion.status = 'rejected';
            suggestion.statusTimestamp = Date.now();
            log(`[DEBUG]   ❌ STATUS: REJECTED (document error)`);
            
            // EMIT OUTCOME TO USAGE STATISTICS
            if (this.usageStats) {
                log(`[DEBUG]   → Emitting outcome to usageStats (error case)`);
                this.usageStats.trackAISuggestionOutcome({
                    document: suggestion.document,
                    status: 'rejected',
                    reviewTime: suggestion.reviewTime,
                    editCount: suggestion.editCount,
                    size: suggestion.size
                });
            }
            
            log(`[DEBUG]   → Triggering score update after status change (error case)...`);
            this.updateScore();
        }
        
        log(`[DEBUG] ✅ Status check complete`);
        log(`[DEBUG] ──────────────────────────────────────────────────────────────────────────`);
    }

    /**
     * Calculate awareness score based on last 10 seconds of suggestions
     */
    updateScore() {
        log(`[DEBUG] ════════════════════════════════════════════════════════════════════════════`);
        log(`[DEBUG] 📊 UPDATING SCORE`);
        log(`[DEBUG]   Timestamp: ${new Date().toISOString()}`);
        
        const now = Date.now();
        const TEN_SECONDS = 10 * 1000;
        
        log(`[DEBUG]   Total suggestions in array: ${this.aiSuggestions.length}`);
        
        // Filter suggestions from last 10 seconds
        const recentSuggestions = this.aiSuggestions.filter(
            s => (now - s.timestamp) <= TEN_SECONDS
        );
        
        log(`[DEBUG]   Recent suggestions (last 10s): ${recentSuggestions.length}`);
        if (recentSuggestions.length > 0) {
            recentSuggestions.forEach((s, i) => {
                const age = Math.round((now - s.timestamp) / 1000);
                log(`[DEBUG]     [${i+1}] ID: ${s.id}, Status: ${s.status}, Size: ${s.size} chars, Age: ${age}s`);
            });
        }
        
        // Only calculate if we have suggestions in the last 10 seconds
        if (recentSuggestions.length === 0) {
            log(`[DEBUG]   ⚠️  No recent suggestions (last 10 seconds)`);
            
            // Check for pending suggestions even if they're older than 10 seconds
            const allPending = this.aiSuggestions.filter(s => s.status === 'pending');
            log(`[DEBUG]   Total pending suggestions (any age): ${allPending.length}`);
            
            // Even with no recent suggestions, calculate debt score if there's review debt
            log(`[DEBUG]   → Calculating debt score...`);
            const debtScore = this.calculateDebtScore();
            log(`[DEBUG]   Debt score result: ${debtScore}/30`);
            log(`[DEBUG]   Total files in debt map: ${this.reviewDebt.size}`);
            
            if (debtScore > 0) {
                // If there's review debt but no pending, show debt score
                this.currentScore = Math.min(debtScore, 100); // Cap at 100
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: debtScore };
                log(`[DEBUG]   ✅ Score set to ${this.currentScore} (debt-only)`);
                log(`[DEBUG]   Components: R:0, C:0, A:0, D:${debtScore}`);
            } else {
                // No recent activity and no debt
                this.currentScore = -1; // Special value: no data yet
                this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
                log(`[DEBUG]   ⚪ Score set to -1 (no activity, no debt)`);
            }
            // Trigger callback for meter update
            if (this.onScoreUpdate) {
                log(`[DEBUG]   → Triggering score update callback`);
                this.onScoreUpdate();
            }
            log(`[DEBUG] ✅ Score update complete (no recent activity)`);
            log(`[DEBUG] ════════════════════════════════════════════════════════════════════════════`);
            return;
        }
        
        // Include pending suggestions in score calculation (they count as activity)
        // This ensures meter shows activity even when suggestions are still pending
        const allRecent = recentSuggestions;
        
        // Filter to completed suggestions only for detailed scoring
        const completed = recentSuggestions.filter(s => s.status !== 'pending');
        const pending = recentSuggestions.filter(s => s.status === 'pending');
        
        log(`[DEBUG]   Completed suggestions: ${completed.length}`);
        log(`[DEBUG]   Pending suggestions: ${pending.length}`);
        
        if (completed.length === 0 && allRecent.length > 0) {
            // Still pending, but we have activity - show partial score based on pending count
            // This ensures meter shows activity instead of "No Activity"
            log(`[DEBUG]   ⏳ All suggestions are pending, showing activity indicator`);
            const debtScore = this.calculateDebtScore();
            log(`[DEBUG]   Debt score: ${debtScore}/30`);
            
            this.currentScore = 50; // Neutral - pending activity detected
            this.scores = { 
                review: 0, 
                critical: 0, 
                adaptation: 0, 
                debt: debtScore // Still calculate debt
            };
            log(`[DEBUG]   ✅ Score set to 50 (pending activity)`);
            log(`[DEBUG]   Components: R:0, C:0, A:0, D:${debtScore}`);
            
            // Trigger callback for meter update
            if (this.onScoreUpdate) {
                log(`[DEBUG]   → Triggering score update callback`);
                this.onScoreUpdate();
            }
            log(`[DEBUG] ✅ Score update complete (pending activity)`);
            log(`[DEBUG] ════════════════════════════════════════════════════════════════════════════`);
            return;
        }
        
        if (completed.length === 0) {
            // No suggestions at all
            log(`[DEBUG]   ⚠️  No completed suggestions`);
            this.currentScore = -1;
            this.scores = { review: 0, critical: 0, adaptation: 0, debt: 0 };
            if (this.onScoreUpdate) {
                log(`[DEBUG]   → Triggering score update callback`);
                this.onScoreUpdate();
            }
            log(`[DEBUG] ✅ Score update complete (no suggestions)`);
            log(`[DEBUG] ════════════════════════════════════════════════════════════════════════════`);
            return;
        }
        
        log(`[DEBUG]   → Calculating score components from ${completed.length} completed suggestions...`);
        
        // 1. Code Review Rate (40 points)
        this.scores.review = this.calculateReviewScore(completed);
        log(`[DEBUG]   Review score: ${this.scores.review}/40`);
        
        // 2. Critical Evaluation (30 points)
        this.scores.critical = this.calculateCriticalScore(completed);
        log(`[DEBUG]   Critical score: ${this.scores.critical}/30`);
        
        // 3. Code Adaptation (30 points)
        this.scores.adaptation = this.calculateAdaptationScore(completed);
        log(`[DEBUG]   Adaptation score: ${this.scores.adaptation}/30`);
        
        // 4. Review Debt (30 points) - NEW!
        this.scores.debt = this.calculateDebtScore();
        log(`[DEBUG]   Debt score: ${this.scores.debt}/30`);
        
        // Total score (max 130, normalized to 100)
        const rawScore = this.scores.review + 
                        this.scores.critical + 
                        this.scores.adaptation + 
                        this.scores.debt;
        
        this.currentScore = Math.round(Math.min(rawScore, 100));
        
        log(`[DEBUG]   Raw score: ${rawScore} → Normalized: ${this.currentScore}/100`);
        log(`[DEBUG]   Final components: R:${this.scores.review}, C:${this.scores.critical}, A:${this.scores.adaptation}, D:${this.scores.debt}`);
        
        // Trigger callback for immediate meter update
        if (this.onScoreUpdate) {
            log(`[DEBUG]   → Triggering score update callback`);
            this.onScoreUpdate();
        }
        
        log(`[DEBUG] ✅ Score update complete`);
        log(`[DEBUG] ════════════════════════════════════════════════════════════════════════════`);
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
                recentTotal: recentSuggestions.length
            },
            // Review debt information
            debt: {
                unreviewedFiles: debtSummary.total,
                files: debtSummary.files.map(f => ({
                    path: f.path.split('/').pop(), // Just filename
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
        log(`[DEBUG] 💳 ADDING TO REVIEW DEBT`);
        log(`[DEBUG]   File: ${filePath}`);
        log(`[DEBUG]   Change size: ${changeSize} chars`);
        
        const existing = this.reviewDebt.get(filePath);
        const now = Date.now();
        
        if (existing && !existing.reviewed) {
            // File already has debt, accumulate it
            const oldTotal = existing.totalChanges;
            const oldModCount = existing.modificationCount;
            const ageMinutes = Math.round((now - existing.modifiedAt) / (1000 * 60));
            
            existing.totalChanges += changeSize;
            existing.lastModifiedAt = now;
            existing.modificationCount++;
            
            log(`[DEBUG]   📊 ACCUMULATING existing debt:`);
            log(`[DEBUG]     Previous: ${oldTotal} chars, ${oldModCount} modifications`);
            log(`[DEBUG]     New: ${existing.totalChanges} chars, ${existing.modificationCount} modifications`);
            log(`[DEBUG]     Debt age: ${ageMinutes} minutes`);
            log(`[DEBUG]     Last modified: ${new Date(existing.lastModifiedAt).toISOString()}`);
        } else if (existing && existing.reviewed) {
            log(`[DEBUG]   ⚠️  File was already reviewed, creating new debt entry`);
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
            log(`[DEBUG]   ✅ New debt entry created (file was previously reviewed)`);
        } else {
            // New debt entry
            log(`[DEBUG]   🆕 CREATING new debt entry`);
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
            log(`[DEBUG]   ✅ New debt entry created`);
            log(`[DEBUG]     Total changes: ${changeSize} chars`);
            log(`[DEBUG]     Created at: ${new Date(now).toISOString()}`);
        }
        
        const totalDebtFiles = Array.from(this.reviewDebt.values()).filter(d => !d.reviewed).length;
        log(`[DEBUG]   📈 Total unreviewed files in debt: ${totalDebtFiles}`);
        log(`[DEBUG]   💾 Saving review debt to disk...`);
        
        this.saveReviewDebt();
        
        log(`[DEBUG] ✅ Review debt updated`);
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
        log(`[DEBUG] 📂 FILE OPENED`);
        log(`[DEBUG]   File: ${filePath}`);
        log(`[DEBUG]   Scheme: ${scheme}`);
        
        const debt = this.reviewDebt.get(filePath);
        
        if (debt && !debt.reviewed) {
            log(`[DEBUG]   ✅ File has unreviewed debt!`);
            log(`[DEBUG]     Total changes: ${debt.totalChanges} chars`);
            log(`[DEBUG]     Modifications: ${debt.modificationCount}`);
            log(`[DEBUG]     Age: ${Math.round((Date.now() - debt.modifiedAt) / (1000 * 60))} minutes`);
            log(`[DEBUG]     Review sessions: ${debt.reviewSessions}`);
            
            // Start tracking review session
            if (!this.fileReviewTracking.has(filePath)) {
                const now = Date.now();
                log(`[DEBUG]   🆕 Starting new review session`);
                this.fileReviewTracking.set(filePath, {
                    sessionStart: now,
                    lastActivity: now,
                    cursorMovements: 0,
                    scrollEvents: 0
                });
                
                debt.firstOpenedAt = debt.firstOpenedAt || now;
                debt.lastVisitedAt = now;
                debt.reviewSessions++;
                
                log(`[DEBUG]     Session start: ${new Date(now).toISOString()}`);
                log(`[DEBUG]     First opened: ${debt.firstOpenedAt ? new Date(debt.firstOpenedAt).toISOString() : 'now'}`);
                log(`[DEBUG]     Total sessions: ${debt.reviewSessions}`);
                
                this.saveReviewDebt();
                log(`[DEBUG]   ✅ Review session tracking started`);
            } else {
                log(`[DEBUG]   ⚠️  Review session already active for this file`);
            }
        } else if (debt && debt.reviewed) {
            log(`[DEBUG]   ℹ️  File has debt but was already reviewed`);
        } else {
            log(`[DEBUG]   ℹ️  File has no review debt`);
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
        
        log(`[DEBUG] 🔄 CHECKING REVIEW PROGRESS`);
        log(`[DEBUG]   Active review sessions: ${activeSessions}`);
        
        for (const [filePath, tracking] of this.fileReviewTracking.entries()) {
            const debt = this.reviewDebt.get(filePath);
            if (!debt || debt.reviewed) {
                log(`[DEBUG]   ⚠️  Removing tracking for ${filePath} (debt not found or already reviewed)`);
                this.fileReviewTracking.delete(filePath);
                continue;
            }
            
            const sessionDuration = now - tracking.sessionStart;
            const timeSinceActivity = now - tracking.lastActivity;
            const sessionMinutes = Math.round(sessionDuration / 1000 / 60);
            const inactivitySeconds = Math.round(timeSinceActivity / 1000);
            
            log(`[DEBUG]   📄 File: ${filePath.split('/').pop()}`);
            log(`[DEBUG]     Session duration: ${sessionMinutes} minutes`);
            log(`[DEBUG]     Cursor movements: ${tracking.cursorMovements}`);
            log(`[DEBUG]     Time since activity: ${inactivitySeconds}s`);
            
            // Check if session ended due to inactivity
            if (timeSinceActivity > ACTIVITY_TIMEOUT) {
                debt.totalReviewTime += sessionDuration;
                this.fileReviewTracking.delete(filePath);
                log(`[DEBUG]     ⏸️  Session ended (inactivity timeout)`);
                log(`[DEBUG]     Total review time: ${Math.round(debt.totalReviewTime / 1000)}s`);
                this.saveReviewDebt();
                continue;
            }
            
            // Check if user has reviewed enough
            if (sessionDuration >= MINIMUM_REVIEW_TIME && tracking.cursorMovements >= 5) {
                // Debt is paid!
                log(`[DEBUG]     ✅ DEBT CLEARED!`);
                log(`[DEBUG]       Review time: ${Math.round(sessionDuration / 1000)}s (required: ${MINIMUM_REVIEW_TIME / 1000}s)`);
                log(`[DEBUG]       Cursor movements: ${tracking.cursorMovements} (required: 5)`);
                
                debt.reviewed = true;
                debt.reviewedAt = now;
                debt.totalReviewTime += sessionDuration;
                this.fileReviewTracking.delete(filePath);
                
                log(`[DEBUG]       Total changes reviewed: ${debt.totalChanges} chars`);
                log(`[DEBUG]       Total modifications: ${debt.modificationCount}`);
                log(`[DEBUG]       Total review time: ${Math.round(debt.totalReviewTime / 1000)}s`);
                log(`[DEBUG]       Reviewed at: ${new Date(now).toISOString()}`);
                
                // EMIT DEBT CLEARED TO USAGE STATISTICS
                if (this.usageStats) {
                    log(`[DEBUG]       → Emitting debt cleared to usageStats`);
                    this.usageStats.trackAIDebtCleared({
                        filePath,
                        totalChanges: debt.totalChanges,
                        totalReviewTime: debt.totalReviewTime,
                        modificationCount: debt.modificationCount
                    });
                }
                
                this.saveReviewDebt();
                log(`[DEBUG]       → Triggering score update after debt cleared...`);
                this.updateScore(); // Recalculate score immediately
            } else {
                const remainingTime = Math.max(0, MINIMUM_REVIEW_TIME - sessionDuration);
                const remainingMovements = Math.max(0, 5 - tracking.cursorMovements);
                log(`[DEBUG]     ⏳ Still reviewing... (need ${Math.round(remainingTime / 1000)}s and ${remainingMovements} more movements)`);
            }
        }
        
        log(`[DEBUG] ✅ Review progress check complete`);
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
            const oldMovements = tracking.cursorMovements;
            tracking.lastActivity = Date.now();
            tracking.cursorMovements++;
            
            if (tracking.cursorMovements % 5 === 0 || tracking.cursorMovements === 1) {
                log(`[DEBUG] 👆 CURSOR MOVEMENT (review tracking)`);
                log(`[DEBUG]   File: ${fileName}`);
                log(`[DEBUG]   Position: L${position.line}:${position.character}`);
                log(`[DEBUG]   Movements: ${oldMovements} → ${tracking.cursorMovements}`);
                log(`[DEBUG]   Session duration: ${Math.round((Date.now() - tracking.sessionStart) / 1000)}s`);
            }
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
                    log(`[DEBUG] 👁️  USER REVIEWING AI SUGGESTION`);
                    log(`[DEBUG]   File: ${fileName}`);
                    log(`[DEBUG]   Suggestion ID: ${suggestion.id}`);
                    log(`[DEBUG]   Size: ${suggestion.size} chars`);
                    log(`[DEBUG]   Range: L${suggestion.range.start.line}:${suggestion.range.start.character} → L${suggestion.range.end.line}:${suggestion.range.end.character}`);
                    log(`[DEBUG]   Review started: ${new Date(suggestion.reviewStarted).toISOString()}`);
                }
                return; // Only track one suggestion at a time
            } else {
                // Cursor left the suggestion
                if (suggestion.reviewStarted) {
                    const reviewDuration = Date.now() - suggestion.reviewStarted;
                    suggestion.reviewTime += reviewDuration;
                    log(`[DEBUG] 👋 USER LEFT SUGGESTION`);
                    log(`[DEBUG]   File: ${fileName}`);
                    log(`[DEBUG]   Suggestion ID: ${suggestion.id}`);
                    log(`[DEBUG]   Review duration: ${Math.round(reviewDuration / 1000)}s`);
                    log(`[DEBUG]   Total review time: ${Math.round(suggestion.reviewTime / 1000)}s`);
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



