/**
 * VibeSwitch Real-Time Awareness Monitor
 * Tracks user interaction with AI-generated code in DEV mode
 */

const vscode = require('vscode');

class AwarenessMonitor {
    constructor() {
        // Rolling window of last 10 AI suggestions
        this.aiSuggestions = [];
        this.maxSuggestions = 10;
        
        // Current score (0-100)
        this.currentScore = 0;
        
        // Score components
        this.scores = {
            review: 0,      // 0-40 points
            critical: 0,    // 0-30 points
            adaptation: 0   // 0-30 points
        };
        
        // Update timer
        this.updateTimer = null;
        
        // Active document tracking
        this.activeDocument = null;
        this.cursorPosition = null;
        
        // Store disposables for cleanup
        this.disposables = [];
    }

    /**
     * Start monitoring (called when switching to DEV mode)
     */
    start(context) {
        console.log('AwarenessMonitor: Starting real-time monitoring');
        
        // Clear any existing subscriptions
        this.stop();
        
        // Track text changes (potential AI edits)
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(this.onTextChange.bind(this))
        );
        
        // Track file creation (AI creating new files)
        this.disposables.push(
            vscode.workspace.onDidCreateFiles(this.onFilesCreated.bind(this))
        );
        
        // Track file saves (AI writing entire files)
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(this.onFileSaved.bind(this))
        );
        
        // Track cursor position (user reviewing code)
        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection(this.onCursorMove.bind(this))
        );
        
        // Track active editor
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(this.onEditorChange.bind(this))
        );
        
        // Start periodic score updates (every 10 seconds)
        this.updateTimer = setInterval(() => {
            this.updateScore();
        }, 10000);
        
        console.log('AwarenessMonitor: Monitoring active');
    }

    /**
     * Stop monitoring (called when switching away from DEV mode)
     */
    stop() {
        console.log('AwarenessMonitor: Stopping monitoring');
        
        // Dispose all event listeners
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        // Reset state
        this.aiSuggestions = [];
        this.currentScore = 0;
        this.scores = { review: 0, critical: 0, adaptation: 0 };
    }

    /**
     * Detect potential AI-generated code changes
     */
    onTextChange(event) {
        // Skip if no changes
        if (event.contentChanges.length === 0) return;
        
        // Skip if this is an internal document (like output panel)
        if (event.document.uri.scheme !== 'file') return;
        
        // Analyze each change
        for (const change of event.contentChanges) {
            const changeSize = change.text.length;
            
            // Improved heuristic: AI typically inserts blocks of code
            // Made less strict to catch more AI activity
            const isLikelyAI = (
                // Large insertions with multiple lines
                (changeSize > 50 && change.text.includes('\n')) ||
                // Very large single-line insertions
                (changeSize > 100) ||
                // Whole file replacements (common with AI agents)
                (changeSize > 200 && change.rangeLength > 100)
            );
            
            if (isLikelyAI) {
                console.log(`AwarenessMonitor: Detected AI edit - ${changeSize} chars in ${event.document.fileName}`);
                this.recordAISuggestion(event.document, change);
            } else if (changeSize > 0 && changeSize < 50) {
                // Track user edits (small changes are likely manual)
                this.recordUserEdit(event.document, change);
            }
        }
    }

    /**
     * Handle file creation (AI creating new files)
     */
    onFilesCreated(event) {
        for (const file of event.files) {
            // Skip non-file URIs
            if (file.scheme !== 'file') continue;
            
            console.log(`AwarenessMonitor: File created - ${file.fsPath}`);
            
            // Read the file to see its size
            vscode.workspace.openTextDocument(file).then(doc => {
                const content = doc.getText();
                
                // If file has substantial content, it's likely AI-generated
                if (content.length > 50) {
                    console.log(`AwarenessMonitor: Detected AI file creation - ${content.length} chars`);
                    
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
                    
                    // Check status after 5 seconds
                    setTimeout(() => this.checkSuggestionStatus(suggestion.id), 5000);
                    
                    // Immediately update score to reflect new activity
                    this.updateScore();
                }
            }).catch(err => {
                console.error('AwarenessMonitor: Error reading created file', err);
            });
        }
    }

    /**
     * Handle file saves (entire file writes by AI)
     */
    onFileSaved(document) {
        // Skip non-file URIs
        if (document.uri.scheme !== 'file') return;
        
        const content = document.getText();
        
        // If it's a large file save shortly after creation/modification
        // This catches AI "write" operations that don't trigger text changes
        if (content.length > 500) {
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
        const suggestion = {
            id: Date.now() + Math.random(), // Unique ID
            timestamp: Date.now(),
            document: document.uri.toString(),
            range: change.range,
            text: change.text,
            size: change.text.length,
            
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
        
        console.log(`AwarenessMonitor: Detected AI suggestion (${change.text.length} chars)`);
        
        // Schedule status check (after 5 seconds, classify as accept/reject)
        setTimeout(() => this.checkSuggestionStatus(suggestion.id), 5000);
    }

    /**
     * Track cursor movement (user reviewing code)
     */
    onCursorMove(event) {
        if (!event.textEditor || !event.selections.length) return;
        
        const editor = event.textEditor;
        const position = event.selections[0].active;
        
        this.cursorPosition = position;
        
        // Check if cursor is on any AI suggestion
        for (const suggestion of this.aiSuggestions) {
            if (suggestion.document !== editor.document.uri.toString()) continue;
            if (suggestion.status !== 'pending') continue;
            
            // Check if cursor is within suggestion range
            if (this.isPositionInRange(position, suggestion.range)) {
                if (!suggestion.reviewed) {
                    suggestion.reviewed = true;
                    suggestion.reviewStarted = Date.now();
                    console.log('AwarenessMonitor: User reviewing AI suggestion');
                }
                return; // Only track one suggestion at a time
            } else {
                // Cursor left the suggestion
                if (suggestion.reviewStarted) {
                    suggestion.reviewTime += Date.now() - suggestion.reviewStarted;
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
        
        // Stop any active reviews when switching files
        for (const suggestion of this.aiSuggestions) {
            if (suggestion.reviewStarted) {
                suggestion.reviewTime += Date.now() - suggestion.reviewStarted;
                suggestion.reviewStarted = null;
            }
        }
    }

    /**
     * Record user edits (might be adapting AI suggestions)
     */
    recordUserEdit(document, change) {
        // Check if edit overlaps with any AI suggestion
        for (const suggestion of this.aiSuggestions) {
            if (suggestion.document !== document.uri.toString()) continue;
            if (suggestion.status !== 'pending') continue;
            
            // Check if edit overlaps with suggestion
            if (this.rangesOverlap(change.range, suggestion.range)) {
                suggestion.userEdited = true;
                suggestion.editCount++;
                console.log('AwarenessMonitor: User edited AI suggestion');
            }
        }
    }

    /**
     * Check if suggestion was accepted, rejected, or adapted
     */
    async checkSuggestionStatus(suggestionId) {
        const suggestion = this.aiSuggestions.find(s => s.id === suggestionId);
        if (!suggestion || suggestion.status !== 'pending') return;
        
        // Try to open the document to check if code still exists
        try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(suggestion.document));
            const currentText = doc.getText(suggestion.range);
            
            // Check if AI code was deleted/rejected
            if (currentText.length < suggestion.size * 0.5) {
                suggestion.status = 'rejected';
                suggestion.statusTimestamp = Date.now();
                console.log('AwarenessMonitor: Suggestion rejected');
            }
            // Check if AI code was modified/adapted
            else if (suggestion.userEdited) {
                suggestion.status = 'adapted';
                suggestion.statusTimestamp = Date.now();
                console.log('AwarenessMonitor: Suggestion adapted');
            }
            // Otherwise, accepted as-is
            else {
                suggestion.status = 'accepted';
                suggestion.statusTimestamp = Date.now();
                console.log('AwarenessMonitor: Suggestion accepted');
            }
        } catch (error) {
            // Document might be closed/deleted
            suggestion.status = 'rejected';
            suggestion.statusTimestamp = Date.now();
        }
    }

    /**
     * Calculate awareness score based on last 10 suggestions
     */
    updateScore() {
        // Only calculate if we have suggestions
        if (this.aiSuggestions.length === 0) {
            this.currentScore = -1; // Special value: no data yet
            this.scores = { review: 0, critical: 0, adaptation: 0 };
            return;
        }
        
        // Filter to completed suggestions only
        const completed = this.aiSuggestions.filter(s => s.status !== 'pending');
        
        if (completed.length === 0) {
            // Still pending, show partial score
            this.currentScore = 50; // Neutral
            return;
        }
        
        // 1. Code Review Rate (40 points)
        this.scores.review = this.calculateReviewScore(completed);
        
        // 2. Critical Evaluation (30 points)
        this.scores.critical = this.calculateCriticalScore(completed);
        
        // 3. Code Adaptation (30 points)
        this.scores.adaptation = this.calculateAdaptationScore(completed);
        
        // Total score
        this.currentScore = Math.round(
            this.scores.review + 
            this.scores.critical + 
            this.scores.adaptation
        );
        
        console.log(`AwarenessMonitor: Score updated - ${this.currentScore}/100 (R:${this.scores.review}, C:${this.scores.critical}, A:${this.scores.adaptation})`);
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
        return {
            total: this.currentScore,
            components: { ...this.scores },
            suggestions: {
                total: this.aiSuggestions.length,
                pending: this.aiSuggestions.filter(s => s.status === 'pending').length,
                accepted: this.aiSuggestions.filter(s => s.status === 'accepted').length,
                rejected: this.aiSuggestions.filter(s => s.status === 'rejected').length,
                adapted: this.aiSuggestions.filter(s => s.status === 'adapted').length
            },
            // Add debug info for troubleshooting
            debug: {
                lastActivity: this.aiSuggestions.length > 0 ? 
                    new Date(this.aiSuggestions[this.aiSuggestions.length - 1].timestamp).toLocaleTimeString() : 
                    'None',
                monitoringActive: this.updateTimer !== null
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
}

module.exports = AwarenessMonitor;



