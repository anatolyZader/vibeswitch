/**
 * Agent Suggestion Handler
 * Manages AI suggestion lifecycle: creation, tracking, status detection, and user interaction
 */

const vscode = require('vscode');
const path = require('path');
const { getLogger } = require('../logger');
const { rangesOverlap } = require('./utils');

class AgentSuggestionHandler {
    constructor(debtManager, updateScore, usageStats, trackAcceptance) {
        this.debtManager = debtManager;
        this.updateScore = updateScore;
        this.usageStats = usageStats;
        this.trackAcceptance = trackAcceptance;
        
        // Rolling window of last 10 AI suggestions (for immediate feedback)
        this.aiSuggestions = [];
        this.maxSuggestions = 10;
    }

    /**
     * Create a suggestion object with standard structure
     * @param {Object} options - Suggestion properties
     * @returns {Object} Suggestion object
     */
    createSuggestionObject(options) {
        const {
            document,
            range,
            text,
            size,
            isFileCreation = false,
            isExternalCreation = false,
            isFileWrite = false
        } = options;

        return {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            document: document,
            range: range,
            text: text,
            size: size,
            
            reviewed: false,
            reviewTime: 0,
            reviewStarted: null,
            
            status: 'pending',
            statusTimestamp: null,
            
            userEdited: false,
            editCount: 0,
            
            isFileCreation: isFileCreation,
            isExternalCreation: isExternalCreation,
            isFileWrite: isFileWrite
        };
    }

    /**
     * Add suggestion to tracking and schedule status check
     * Handles the common workflow after creating a suggestion
     * @param {Object} suggestion - Suggestion object
     * @param {string} filePath - Path to the file
     * @param {number} contentLength - Length of content
     */
    addSuggestionAndTrack(suggestion, filePath, contentLength) {
        // Add to rolling window
        this.aiSuggestions.push(suggestion);
        
        // Keep only last maxSuggestions
        if (this.aiSuggestions.length > this.maxSuggestions) {
            this.aiSuggestions.shift();
        }
        
        // Add to debt
        if (this.debtManager) {
            this.debtManager.addToDebt(filePath, contentLength, this.updateScore);
        }
        
        // Schedule status check after 5 seconds
        setTimeout(() => this.checkSuggestionStatus(suggestion.id), 5000);
        
        // Immediately update score to reflect new activity
        if (this.updateScore) {
            this.updateScore();
        }
    }

    /**
     * Process a file as an AI-generated suggestion
     * Reads file content and creates suggestion if non-empty
     * @param {vscode.Uri} fileUri - URI of the file
     * @param {Object} options - Processing options
     * @returns {Promise<Object|null>} Suggestion object or null
     */
    async processFileAsSuggestion(fileUri, options = {}) {
        const {
            isFileCreation = false,
            isExternalCreation = false,
            isFileWrite = false,
            filePath = null
        } = options;

        try {
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const content = doc.getText();
            
            // Treat any non-empty file as potentially AI-generated
            if (content.trim().length > 0) {
                const suggestion = this.createSuggestionObject({
                    document: doc.uri.toString(),
                    range: new vscode.Range(0, 0, doc.lineCount, 0),
                    text: content,
                    size: content.length,
                    isFileCreation: isFileCreation,
                    isExternalCreation: isExternalCreation,
                    isFileWrite: isFileWrite
                });
                
                const pathToUse = filePath || fileUri.fsPath || doc.uri.fsPath;
                this.addSuggestionAndTrack(suggestion, pathToUse, content.length);
                
                return suggestion;
            }
        } catch (err) {
            getLogger().log(`AwarenessMonitor: Error processing file ${fileUri.fsPath || fileUri}: ${err.message}`);
            console.error('AwarenessMonitor: Error processing file', err);
        }
        
        return null;
    }

    /**
     * Record a detected AI suggestion
     * @param {vscode.TextDocument} document - The document
     * @param {vscode.TextDocumentContentChangeEvent} change - The change event
     */
    recordAISuggestion(document, change) {
        const filePath = document.uri.fsPath;
        const timestamp = Date.now();
        const changeSize = change.text.length;
        
        // Reduced verbose debug logging - only log summary
        getLogger().debug(`[DEBUG] 📝 AI suggestion: ${changeSize} chars in ${path.basename(filePath)}`);
        
        const suggestion = this.createSuggestionObject({
            document: document.uri.toString(),
            range: change.range,
            text: change.text,
            size: changeSize
        });
        
        // Override timestamp to use the one from recordAISuggestion
        suggestion.timestamp = timestamp;
        suggestion.id = timestamp + Math.random();
        
        // Add to tracking (includes adding to array, debt, status check, score update)
        this.addSuggestionAndTrack(suggestion, filePath, changeSize);
        
        // EMIT AI EVENT TO USAGE STATISTICS
        if (this.usageStats) {
            this.usageStats.trackAISuggestion({
                filePath,
                size: suggestion.size,
                timestamp: suggestion.timestamp,
                isFileCreation: false
            });
        }
    }

    /**
     * Record user edits (might be adapting AI suggestions)
     * @param {vscode.TextDocument} document - The document
     * @param {vscode.TextDocumentContentChangeEvent} change - The change event
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
            if (rangesOverlap(change.range, suggestion.range)) {
                foundOverlap = true;
                suggestion.userEdited = true;
                suggestion.editCount++;
                
                // Reduced logging - only log occasionally
                if (Math.random() < 0.2) { // 20% chance
                    getLogger().debug(`[DEBUG] ✏️  User edit overlaps AI suggestion in ${fileName}`);
                }
            }
        }
        
        // Removed verbose logging for non-overlapping edits
    }

    /**
     * Check if suggestion was accepted, rejected, or adapted
     * @param {number} suggestionId - ID of the suggestion to check
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
                getLogger().debug(`[DEBUG] Suggestion rejected: ${(sizeRatio * 100).toFixed(1)}% of original`);
            }
            // Check if AI code was modified/adapted
            else if (suggestion.userEdited) {
                suggestion.status = 'adapted';
                suggestion.statusTimestamp = Date.now();
                getLogger().debug(`[DEBUG] Suggestion adapted by user`);
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
                    getLogger().debug(`[DEBUG] Suggestion accepted (${sourceType})`);
                    if (this.trackAcceptance) {
                        this.trackAcceptance(suggestion);
                    }
                } else {
                    // No user interaction yet - keep pending
                    // DEV MODE: All suggestions require review, even if code exists unchanged
                    // Schedule another check in 10 seconds
                    setTimeout(() => this.checkSuggestionStatus(suggestion.id), 10000);
                    return; // Exit early, don't emit outcome yet
                }
            }
            
            // Emit outcome to usage statistics
            if (this.usageStats) {
                this.usageStats.trackAISuggestionOutcome({
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
            
            // Update score immediately when status changes
            if (this.updateScore) {
                this.updateScore();
            }
        } catch (err) {
            getLogger().log(`AwarenessMonitor: Error checking suggestion status: ${err.message}`);
            console.error('AwarenessMonitor: Error checking suggestion status', err);
        }
    }

    /**
     * Get all suggestions
     * @returns {Array} Array of suggestions
     */
    getSuggestions() {
        return this.aiSuggestions;
    }

    /**
     * Get suggestions by status
     * @param {string} status - Status to filter by
     * @returns {Array} Filtered suggestions
     */
    getSuggestionsByStatus(status) {
        return this.aiSuggestions.filter(s => s.status === status);
    }

    /**
     * Find suggestion by ID
     * @param {number} id - Suggestion ID
     * @returns {Object|null} Suggestion or null
     */
    findSuggestion(id) {
        return this.aiSuggestions.find(s => s.id === id) || null;
    }

    /**
     * Check if file has pending suggestions
     * @param {string} documentUri - Document URI string
     * @returns {boolean} True if file has pending suggestions
     */
    hasPendingSuggestions(documentUri) {
        return this.aiSuggestions.some(s => 
            s.status === 'pending' && s.document === documentUri
        );
    }

    /**
     * Get pending suggestions for a file
     * @param {string} filePath - File path
     * @returns {Array} Array of pending suggestions
     */
    getPendingSuggestionsForFile(filePath) {
        return this.aiSuggestions.filter(s => {
            if (s.status !== 'pending' || !s.document) return false;
            try {
                const uri = vscode.Uri.parse(s.document);
                return uri.scheme === 'file' && uri.fsPath === filePath;
            } catch {
                return false;
            }
        });
    }
}

module.exports = AgentSuggestionHandler;

