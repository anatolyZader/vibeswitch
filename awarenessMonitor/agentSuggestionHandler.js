/**
 * Agent Suggestion Handler
 * Manages AI suggestion lifecycle: creation, tracking, status detection, and user interaction
 */

const vscode = require('vscode');
const path = require('path');
const { getLogger } = require('../logger');
const { rangesOverlap } = require('./utils');

class AgentSuggestionHandler {
    constructor(debtManager, updateScore, usageStats, trackAcceptance, updateFileColorsInExplorer = null) {
        this.debtManager = debtManager;
        this.updateScore = updateScore;
        this.usageStats = usageStats;
        this.trackAcceptance = trackAcceptance;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        
        // Fix: Split storage - durable Map for all suggestions, capped array for UI
        // This prevents losing pending debt when rolling window drops old suggestions
        this.suggestionsById = new Map(); // Authoritative storage (unbounded for pending items)
        this.recentIds = []; // Capped to 10 for UI/quick feedback
        this.maxRecentSuggestions = 10;
        
        // Legacy: aiSuggestions array for backward compatibility (derived from Map)
        // Will be populated from suggestionsById for existing code
        Object.defineProperty(this, 'aiSuggestions', {
            get: () => Array.from(this.suggestionsById.values()),
            enumerable: true,
            configurable: true
        });
        
        // FIXED: Track timers for proper cleanup on dispose
        this.activeTimers = new Set();
        this.isActive = true; // Flag to prevent timers from running after dispose
        
        // Fix: Monotonic counter for stable ID generation (avoids collisions in fast bursts)
        this._idSeq = 0;
        
        // Fix: Add log rate limiter for deterministic logging (replaces Math.random())
        const LogRateLimiter = require('./logRateLimiter');
        this.logRateLimiter = new LogRateLimiter(5000, 500); // 5 second window, max 500 keys
        
        // Fix: Per-document index for O(1) lookup in recordUserEdit (optimization)
        // Maps document URI to Set of pending suggestion IDs
        this.pendingByDocUri = new Map(); // uri -> Set<id>
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

        // Fix: Use monotonic counter for stable ID generation (avoids collisions in fast bursts)
        // Prefer crypto.randomUUID() if available, otherwise use timestamp + counter
        this._idSeq = (this._idSeq || 0) + 1;
        let id;
        try {
            const crypto = require('crypto');
            if (crypto.randomUUID) {
                id = crypto.randomUUID();
            } else {
                id = `${Date.now()}-${this._idSeq}`;
            }
        } catch (e) {
            id = `${Date.now()}-${this._idSeq}`;
        }
        
        return {
            id: id,
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
     * Fix: Removed unused filePathOrUri parameter (standardized on suggestion.document as URI)
     * @param {Object} suggestion - Suggestion object
     * @param {number} contentLength - Length of content
     */
    addSuggestionAndTrack(suggestion, contentLength) {
        // Fix: Use durable Map storage instead of rolling window
        // This prevents losing pending debt when suggestions are dropped
        const id = suggestion.id;
        
        // Store in authoritative Map (unbounded for pending items)
        this.suggestionsById.set(id, suggestion);
        
        // Fix: Update per-document index for O(1) lookup in recordUserEdit
        const docUri = suggestion.document;
        if (!this.pendingByDocUri.has(docUri)) {
            this.pendingByDocUri.set(docUri, new Set());
        }
        if (suggestion.status === 'pending') {
            this.pendingByDocUri.get(docUri).add(id);
        }
        
        // Add to recent IDs for UI (capped)
        if (!this.recentIds.includes(id)) {
            this.recentIds.push(id);
        }
        
        // Keep only last maxRecentSuggestions in recent list
        if (this.recentIds.length > this.maxRecentSuggestions) {
            const removedId = this.recentIds.shift();
            // Only remove from Map if suggestion is resolved (not pending)
            const removed = this.suggestionsById.get(removedId);
            if (removed && removed.status !== 'pending') {
                this.suggestionsById.delete(removedId);
            }
        }
        
        // Add to debt
        // FIXED: Use URI as canonical identifier (works with remote workspaces)
        if (this.debtManager) {
            const uri = suggestion.document; // Already a URI string
            this.debtManager.addToDebt(uri, contentLength, this.updateScore);
        }
        
        // Update file colors immediately when new suggestion is added (for pending files)
        if (this.updateFileColorsInExplorer) {
            this.updateFileColorsInExplorer();
        }
        
        // Schedule status check after 5 seconds
        // FIXED: Track timer for cleanup
        const timer = setTimeout(() => {
            this.activeTimers.delete(timer);
            if (this.isActive) {
                this.checkSuggestionStatus(suggestion.id);
            }
        }, 5000);
        this.activeTimers.add(timer);
        
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
                // Fixed: Range math bug - lineCount is 1-based count, but line indices are 0-based
                const lastLine = Math.max(0, doc.lineCount - 1);
                const lastLineText = doc.lineAt(lastLine).text;
                const lastChar = lastLineText.length;
                
                const suggestion = this.createSuggestionObject({
                    document: doc.uri.toString(),
                    range: new vscode.Range(0, 0, lastLine, lastChar),
                    text: content,
                    size: content.length,
                    isFileCreation: isFileCreation,
                    isExternalCreation: isExternalCreation,
                    isFileWrite: isFileWrite
                });
                
                // Fix: Remove unused uriToUse - suggestion.document already has the URI
                this.addSuggestionAndTrack(suggestion, content.length);
                
                return suggestion;
            }
        } catch (err) {
            getLogger().log(`AwarenessMonitor: Error processing file ${fileUri.fsPath || fileUri}: ${err.message}`, true);
        }
        
        return null;
    }

    /**
     * Record a detected AI suggestion
     * @param {vscode.TextDocument} document - The document
     * @param {vscode.TextDocumentContentChangeEvent} change - The change event
     */
    recordAISuggestion(document, change) {
        // FIXED: Use URI as canonical identifier (works with remote workspaces)
        const uri = document.uri.toString();
        const changeSize = change.text.length;
        
        // Reduced verbose debug logging - only log summary
        // Derive fileName from URI for display purposes only
        const fileName = uri.split('/').pop().split('?')[0];
        getLogger().debug(`[DEBUG] 📝 AI suggestion: ${changeSize} chars in ${fileName}`);
        
        const suggestion = this.createSuggestionObject({
            document: uri,
            range: change.range,
            text: change.text,
            size: changeSize
        });
        
        // Fix: Never override id - it's already a string (UUID or timestamp-seq) from createSuggestionObject
        // suggestion.timestamp is already set in createSuggestionObject
        
        // Add to tracking (includes adding to array, debt, status check, score update)
        // FIXED: Pass URI instead of fsPath
        this.addSuggestionAndTrack(suggestion, changeSize);
        
        // EMIT AI EVENT TO USAGE STATISTICS
        if (this.usageStats) {
            this.usageStats.trackAISuggestion({
                filePath: uri, // Keep filePath key for backward compatibility
                size: suggestion.size,
                timestamp: suggestion.timestamp,
                isFileCreation: false
            });
        }
    }

    /**
     * Record a batch of AI changes as a single suggestion (fixes design flaw)
     * Fix: Record one suggestion per classified batch, not per change
     * This prevents dozens of "pending suggestions" from a single AI refactor
     * @param {vscode.TextDocument} document - The document
     * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Batch of changes
     * @param {Object} meta - Optional metadata
     */
    recordAISuggestionBatch(document, aggregatedChanges, meta = {}) {
        if (!aggregatedChanges || aggregatedChanges.length === 0) {
            return;
        }

        const uri = document.uri.toString();
        
        // Calculate merged range (union of all change ranges)
        const start = aggregatedChanges.reduce((min, c) => 
            c.range.start.isBefore(min) ? c.range.start : min, 
            aggregatedChanges[0].range.start
        );
        const end = aggregatedChanges.reduce((max, c) => 
            c.range.end.isAfter(max) ? c.range.end : max, 
            aggregatedChanges[0].range.end
        );
        const mergedRange = new vscode.Range(start, end);

        // Safer than concatenating change.text: take current doc snapshot
        // This handles overlapping changes correctly
        const mergedText = document.getText(mergedRange);
        const mergedSize = mergedText.length;

        // Derive fileName from URI for display purposes only
        const fileName = uri.split('/').pop().split('?')[0];
        getLogger().debug(`[DEBUG] 📝 AI suggestion batch: ${aggregatedChanges.length} changes, ${mergedSize} chars in ${fileName}`);

        const suggestion = this.createSuggestionObject({
            document: uri,
            range: mergedRange,
            text: mergedText,
            size: mergedSize,
            ...meta
        });

        // Add to tracking (includes adding to array, debt, status check, score update)
        this.addSuggestionAndTrack(suggestion, mergedSize);

        // EMIT AI EVENT TO USAGE STATISTICS
        if (this.usageStats) {
            this.usageStats.trackAISuggestion({
                filePath: uri,
                size: mergedSize,
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
        // FIXED: Use URI as canonical identifier (works with remote workspaces)
        const uri = document.uri.toString();
        // Derive fileName from URI for display purposes only
        const fileName = uri.split('/').pop().split('?')[0]; // Remove query params if any
        const changeSize = change.text.length;
        
        // Fix: Use per-document index for O(1) lookup instead of O(n) scan
        // Only check pending suggestions for this document
        const pendingIds = this.pendingByDocUri.get(uri);
        if (!pendingIds || pendingIds.size === 0) {
            return; // No pending suggestions for this document
        }
        
        // Fix: Collect stale IDs first, then delete after iteration (safer than deleting during iteration)
        const staleIds = [];
        
        // Check if edit overlaps with any pending suggestion for this document
        for (const id of pendingIds) {
            const suggestion = this.suggestionsById.get(id);
            if (!suggestion || suggestion.status !== 'pending') {
                // Mark for cleanup (don't delete during iteration)
                staleIds.push(id);
                continue;
            }
            
            // Check if edit overlaps with suggestion
            if (rangesOverlap(change.range, suggestion.range)) {
                suggestion.userEdited = true;
                suggestion.editCount = (suggestion.editCount || 0) + 1;
                
                // Fix: Use rate limiter instead of Math.random() for deterministic, testable logging
                const logKey = `userEditOverlap:${uri}:${suggestion.id}`;
                if (this.logRateLimiter.shouldLog(logKey)) {
                    getLogger().debug(`[DEBUG] ✏️  User edit overlaps AI suggestion in ${fileName}`);
                }
                break; // Usually enough - user edit typically overlaps one suggestion
            }
        }
        
        // Clean up stale index entries after iteration
        for (const id of staleIds) {
            pendingIds.delete(id);
        }
        if (pendingIds.size === 0) {
            this.pendingByDocUri.delete(uri);
        }
        
        // Removed verbose logging for non-overlapping edits
    }

    /**
     * Check if suggestion was accepted, rejected, or adapted
     * Fix: Accept string ID (UUID or timestamp-seq format)
     * @param {string} suggestionId - ID of the suggestion to check
     */
    async checkSuggestionStatus(suggestionId) {
        // Fix: Use Map lookup instead of array find (O(1) vs O(n))
        const suggestion = this.suggestionsById.get(suggestionId);
        if (!suggestion) {
            return;
        }
        
        if (suggestion.status !== 'pending') {
            return;
        }
        
        // Try to open the document to check if code still exists
        try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(suggestion.document));
            // FIXED: Validate range before using it - ranges drift as document changes
            // This prevents errors and incorrect status detection
            const safeRange = doc.validateRange(suggestion.range);
            const currentText = doc.getText(safeRange);
            const currentSize = currentText.length;
            
            // Fix: Guard against division by zero and handle tiny suggestions
            const MIN_SIZE_FOR_RATIO = 10; // Don't use ratio for very small suggestions
            if (!suggestion.size || suggestion.size < MIN_SIZE_FOR_RATIO) {
                // For tiny suggestions, just check if text exists
                if (currentSize === 0) {
                    suggestion.status = 'rejected';
                    suggestion.statusTimestamp = Date.now();
                    getLogger().debug(`[DEBUG] Tiny suggestion rejected: empty after validation`);
                    // Fix: Remove from per-document index when status changes
                    this._removeFromPendingIndex(suggestion);
                }
                // Don't mark as accepted/rejected based on ratio for tiny suggestions
                return;
            }
            
            const sizeRatio = currentSize / suggestion.size;
            
            // Fix: Reduce false rejection due to validateRange() shrinkage
            // Use a more lenient threshold (40% instead of 50%) to account for range drift
            if (currentSize < suggestion.size * 0.4) {
                suggestion.status = 'rejected';
                suggestion.statusTimestamp = Date.now();
                getLogger().debug(`[DEBUG] Suggestion rejected: ${(sizeRatio * 100).toFixed(1)}% of original`);
                // Fix: Remove from per-document index when status changes
                this._removeFromPendingIndex(suggestion);
            }
            // Check if AI code was modified/adapted
            else if (suggestion.userEdited) {
                suggestion.status = 'adapted';
                suggestion.statusTimestamp = Date.now();
                getLogger().debug(`[DEBUG] Suggestion adapted by user`);
                // Fix: Remove from per-document index when status changes
                this._removeFromPendingIndex(suggestion);
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
                    // Fix: Remove from per-document index when status changes
                    this._removeFromPendingIndex(suggestion);
                    if (this.trackAcceptance) {
                        this.trackAcceptance(suggestion);
                    }
                } else {
                    // No user interaction yet - keep pending
                    // DEV MODE: All suggestions require review, even if code exists unchanged
                    // Schedule another check in 10 seconds
                    // FIXED: Track timer for cleanup
                    const timer = setTimeout(() => {
                        this.activeTimers.delete(timer);
                        if (this.isActive) {
                            this.checkSuggestionStatus(suggestion.id);
                        }
                    }, 10000);
                    this.activeTimers.add(timer);
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
     * Find a suggestion by ID
     * Fix: Accept string ID (UUID or timestamp-seq format)
     * @param {string} id - Suggestion ID
     * @returns {Object|null} Suggestion object or null
     */
    findSuggestion(id) {
        // Fix: Use Map lookup instead of array find (O(1) vs O(n))
        return this.suggestionsById.get(id) || null;
    }
    
    /**
     * Remove suggestion from per-document pending index when status changes
     * @param {Object} suggestion - Suggestion object
     * @private
     */
    _removeFromPendingIndex(suggestion) {
        const docUri = suggestion.document;
        const pendingIds = this.pendingByDocUri.get(docUri);
        if (pendingIds) {
            pendingIds.delete(suggestion.id);
            // Clean up empty sets
            if (pendingIds.size === 0) {
                this.pendingByDocUri.delete(docUri);
            }
        }
    }

    /**
     * Dispose and cleanup all timers
     * FIXED: Prevents stray timers from firing after monitor stops
     */
    dispose() {
        this.isActive = false;
        // Clear all active timers
        for (const timer of this.activeTimers) {
            clearTimeout(timer);
        }
        this.activeTimers.clear();
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
     * FIXED: Accept URI string as canonical identifier (works with remote workspaces)
     * @param {string} filePathOrUri - File path (fsPath) or URI string
     * @returns {Array} Array of pending suggestions
     */
    getPendingSuggestionsForFile(filePathOrUri) {
        // Normalize to URI string for comparison
        let targetUri = filePathOrUri;
        if (filePathOrUri && !filePathOrUri.includes('://')) {
            // It's a file path, try to convert to URI
            try {
                const uri = vscode.Uri.file(filePathOrUri);
                targetUri = uri.toString();
            } catch {
                // If conversion fails, use as-is (might already be URI)
                targetUri = filePathOrUri;
            }
        }
        
        return this.aiSuggestions.filter(s => {
            if (s.status !== 'pending' || !s.document) return false;
            // Compare URI strings directly
            return s.document === targetUri;
        });
    }
}

module.exports = AgentSuggestionHandler;

