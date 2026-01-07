/**
 * Agent Suggestion Handler
 * Manages AI suggestion lifecycle: creation, tracking, status detection, and user interaction
 */

// Keep minimal vscode import for types only (Range, Position, Uri, etc.)
// All API calls should go through vscodeAdapter
const vscode = require('vscode');
const path = require('path');
const crypto = require('crypto'); // Fix: Move to module scope to avoid require() in hot paths
const { getLogger } = require('../../../../logger');
const { rangesOverlap } = require('../utils/utils');

class AgentSuggestionHandler {
    constructor(debtManager, updateScore, callbacks, trackAcceptance, updateFileColorsInExplorer = null, vscodeAdapter = null) {
        this.debtManager = debtManager;
        this.updateScore = updateScore;
        this.onAISuggestion = callbacks?.onAISuggestion || null;
        this.onAISuggestionOutcome = callbacks?.onAISuggestionOutcome || null;
        this.trackAcceptance = trackAcceptance;
        this.updateFileColorsInExplorer = updateFileColorsInExplorer;
        // VS Code adapter (Ports and Adapters pattern) - optional for backward compatibility
        this.vscodeAdapter = vscodeAdapter;
        
        // Fix: Split storage - durable Map for all suggestions, capped array for UI
        // This prevents losing pending debt when rolling window drops old suggestions
        this.suggestionsById = new Map(); // Authoritative storage (capped with eviction)
        this.recentIds = []; // Capped to 10 for UI/quick feedback
        this.maxRecentSuggestions = 10;
        
        // Production: Cap total suggestions to prevent unbounded growth
        // Eviction policy: non-pending first, then oldest pending as last resort
        this.MAX_TOTAL_SUGGESTIONS = 5000; // Global cap
        this._evictionThreshold = 0.9; // Evict when 90% full (4500)
        
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
        // Fix: crypto is now at module scope (no require() in hot path)
        this._idSeq = (this._idSeq || 0) + 1;
        let id;
        try {
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
        
        // Production: Enforce global cap with eviction policy
        if (this.suggestionsById.size >= this.MAX_TOTAL_SUGGESTIONS * this._evictionThreshold) {
            this._evictSuggestions();
        }
        
        // Store in authoritative Map (capped with eviction)
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
            // Use vscodeAdapter if available (Ports and Adapters pattern), otherwise fallback to direct vscode
            const openDoc = this.vscodeAdapter 
                ? (uri) => this.vscodeAdapter.openTextDocument(uri)
                : (uri) => vscode.workspace.openTextDocument(uri);
            const doc = await openDoc(fileUri);
            const content = doc.getText();
            
            // Treat any non-empty file as potentially AI-generated
            if (content.trim().length > 0) {
                // Fixed: Range math bug - lineCount is 1-based count, but line indices are 0-based
                const lastLine = Math.max(0, doc.lineCount - 1);
                const lastLineText = doc.lineAt(lastLine).text;
                const lastChar = lastLineText.length;
                
                // Use vscodeAdapter.Range if available (Ports and Adapters pattern), otherwise fallback to vscode.Range
                const Range = this.vscodeAdapter ? this.vscodeAdapter.Range : vscode.Range;
                const suggestion = this.createSuggestionObject({
                    document: doc.uri.toString(),
                    range: new Range(0, 0, lastLine, lastChar),
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
        // Use vscodeAdapter.Range if available (Ports and Adapters pattern), otherwise fallback to vscode.Range
        const Range = this.vscodeAdapter ? this.vscodeAdapter.Range : vscode.Range;
        const mergedRange = new Range(start, end);
        
        // Fix: Cap merged range span for debt sizing if huge but inserted tiny
        // This prevents enormous suggestion sizes/debt for scattered tiny edits
        const lineSpan = end.line - start.line;
        const totalInserted = aggregatedChanges.reduce((sum, c) => sum + (c.text?.length || 0), 0);
        const avgInsertedPerLine = lineSpan > 0 ? totalInserted / lineSpan : totalInserted;
        
        // If line span is huge but average inserted per line is tiny, cap the range for sizing
        // Threshold: > 100 lines but < 5 chars per line average
        let effectiveRange = mergedRange;
        let effectiveRangeCapped = false;
        if (lineSpan > 100 && avgInsertedPerLine < 5) {
            // Use a smaller window around the first change for sizing (but keep full range for tracking)
            const firstChange = aggregatedChanges[0];
            const windowSize = Math.min(50, lineSpan); // Cap at 50 lines
            // Use vscodeAdapter types if available (Ports and Adapters pattern), otherwise fallback to vscode
            const Position = this.vscodeAdapter ? this.vscodeAdapter.Position : vscode.Position;
            const Range = this.vscodeAdapter ? this.vscodeAdapter.Range : vscode.Range;
            const cappedEnd = new Position(
                Math.min(firstChange.range.start.line + windowSize, end.line),
                end.character
            );
            effectiveRange = new Range(firstChange.range.start, cappedEnd);
            effectiveRangeCapped = true; // Production: Flag for UI/debugging
        }

        // Safer than concatenating change.text: take current doc snapshot
        // This handles overlapping changes correctly
        // Use effectiveRange for sizing (may be capped for scattered edits)
        const mergedText = document.getText(effectiveRange);
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

        // Call optional callback (e.g., for UsageStats)
        if (this.onAISuggestion) {
            this.onAISuggestion({
                filePath: uri,
                size: mergedSize,
                timestamp: suggestion.timestamp,
                isFileCreation: false
            });
        }
    }

    /**
     * Record a batch of user edits (fixes per-change explosion)
     * Fix: Batch version to match recordAISuggestionBatch pattern
     * @param {vscode.TextDocument} document - The document
     * @param {Array<vscode.TextDocumentContentChangeEvent>} aggregatedChanges - Batch of changes
     */
    recordUserEditBatch(document, aggregatedChanges) {
        if (!aggregatedChanges || aggregatedChanges.length === 0) {
            return;
        }
        
        const uri = document.uri.toString();
        const fileName = uri.split('/').pop().split('?')[0];
        
        // Fix: Use per-document index for O(1) lookup
        const pendingIds = this.pendingByDocUri.get(uri);
        if (!pendingIds || pendingIds.size === 0) {
            return; // No pending suggestions for this document
        }
        
        // Fix: Optimize range merging from O(n²) to O(n log n)
        // Sort ranges by start position, then merge in one pass
        const sortedRanges = [...aggregatedChanges]
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
            // Fix: Use VS Code position comparisons for reliable adjacency detection
            // Adjacent means: range starts at or before last end (touching or overlapping)
            const isTouching = range.start.isEqual(lastMerged.end) || 
                range.start.isBefore(lastMerged.end) ||
                (range.start.line === lastMerged.end.line && range.start.character <= lastMerged.end.character);
            const isOverlapping = rangesOverlap(range, lastMerged);
            
            if (isOverlapping || isTouching) {
                // Merge: union of ranges
                const start = range.start.isBefore(lastMerged.start) 
                    ? range.start 
                    : lastMerged.start;
                const end = range.end.isAfter(lastMerged.end)
                    ? range.end
                    : lastMerged.end;
                // Use vscodeAdapter.Range if available (Ports and Adapters pattern), otherwise fallback to vscode.Range
                const Range = this.vscodeAdapter ? this.vscodeAdapter.Range : vscode.Range;
                mergedRanges[mergedRanges.length - 1] = new Range(start, end);
            } else {
                mergedRanges.push(range);
            }
        }
        
        // Check overlap against pending suggestions using merged ranges
        const staleIds = [];
        for (const id of pendingIds) {
            const suggestion = this.suggestionsById.get(id);
            if (!suggestion || suggestion.status !== 'pending') {
                staleIds.push(id);
                continue;
            }
            
            // Check if any merged range overlaps with suggestion
            for (const mergedRange of mergedRanges) {
                if (rangesOverlap(mergedRange, suggestion.range)) {
                    suggestion.userEdited = true;
                    suggestion.editCount = (suggestion.editCount || 0) + 1;
                    
                    // Rate-limited debug logging via logger's built-in rate limiter
                    const logKey = `userEditOverlap:${uri}:${suggestion.id}`;
                    getLogger().debug(`✏️  User edit batch overlaps AI suggestion in ${fileName}`, false, logKey);
                    break; // One overlap per suggestion is enough
                }
            }
        }
        
        // Clean up stale index entries
        for (const id of staleIds) {
            pendingIds.delete(id);
        }
        if (pendingIds.size === 0) {
            this.pendingByDocUri.delete(uri);
        }
    }

    /**
     * Record user edits (might be adapting AI suggestions)
     * @deprecated Use recordUserEditBatch for batch processing
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
                
                // Rate-limited debug logging via logger's built-in rate limiter
                const logKey = `userEditOverlap:${uri}:${suggestion.id}`;
                getLogger().debug(`✏️  User edit overlaps AI suggestion in ${fileName}`, false, logKey);
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
            // Use vscodeAdapter if available (Ports and Adapters pattern), otherwise fallback to direct vscode
            const openDoc = this.vscodeAdapter 
                ? (uri) => this.vscodeAdapter.openTextDocument(uri)
                : (uri) => vscode.workspace.openTextDocument(uri);
            const Uri = this.vscodeAdapter ? this.vscodeAdapter.Uri : vscode.Uri;
            const doc = await openDoc(Uri.parse(suggestion.document));
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
            
            // Update score immediately when status changes
            if (this.updateScore) {
                this.updateScore();
            }
        } catch (err) {
            getLogger().log(`AwarenessMonitor: Error checking suggestion status: ${err.message}`);
            // Production: Use logger instead of console.error
            getLogger().log(`[AgentSuggestionHandler] Error checking suggestion status: ${err.message}`, true);
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
     * Evict suggestions when approaching capacity limit
     * Eviction policy: non-pending first, then oldest pending as last resort
     * Production: Evicts to 0.8 threshold (not 0.9) to avoid constant churn
     * Ensures index consistency: always removes from pendingByDocUri and recentIds when evicting
     * @private
     */
    _evictSuggestions() {
        // Production: Evict to 0.8 (not 0.9) to avoid thrashing on every insert near threshold
        const targetSize = Math.floor(this.MAX_TOTAL_SUGGESTIONS * 0.8);
        const currentSize = this.suggestionsById.size;
        
        if (currentSize < targetSize) {
            return; // Not at threshold yet
        }
        
        // Collect non-pending suggestions first (safe to evict)
        const nonPending = [];
        const pending = [];
        
        for (const [id, suggestion] of this.suggestionsById.entries()) {
            if (suggestion.status === 'pending') {
                pending.push({ id, suggestion, timestamp: suggestion.timestamp || 0 });
            } else {
                nonPending.push({ id, suggestion, timestamp: suggestion.statusTimestamp || suggestion.timestamp || 0 });
            }
        }
        
        // Sort by timestamp (oldest first)
        nonPending.sort((a, b) => a.timestamp - b.timestamp);
        pending.sort((a, b) => a.timestamp - b.timestamp);
        
        // Evict non-pending first
        let evicted = 0;
        for (const { id } of nonPending) {
            if (this.suggestionsById.size <= targetSize) break;
            this.suggestionsById.delete(id);
            // Remove from recentIds if present
            const recentIndex = this.recentIds.indexOf(id);
            if (recentIndex >= 0) {
                this.recentIds.splice(recentIndex, 1);
            }
            evicted++;
        }
        
        // If still over limit, evict oldest pending (last resort)
        // Production: Always maintain index consistency - remove from pendingByDocUri
        for (const { id, suggestion } of pending) {
            if (this.suggestionsById.size <= targetSize) break;
            
            // Remove from authoritative Map
            this.suggestionsById.delete(id);
            
            // Production: Always remove from index to maintain consistency
            const docUri = suggestion.document;
            if (docUri) {
                const pendingIds = this.pendingByDocUri.get(docUri);
                if (pendingIds) {
                    pendingIds.delete(id);
                    if (pendingIds.size === 0) {
                        this.pendingByDocUri.delete(docUri);
                    }
                }
            }
            
            // Also remove from recentIds if present (UI window)
            const recentIndex = this.recentIds.indexOf(id);
            if (recentIndex >= 0) {
                this.recentIds.splice(recentIndex, 1);
            }
            
            evicted++;
        }
        
        // Log eviction for monitoring
        if (evicted > 0) {
            const { total, pending: pendingCount } = this.getSuggestionMetrics();
            getLogger().log(`[AgentSuggestionHandler] Evicted ${evicted} suggestions (total: ${total}, pending: ${pendingCount})`, true);
        }
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
        // Production: Use index for O(1) lookup instead of O(n) scan
        // Also avoids edge cases where suggestion was evicted but stale state lingers
        const pendingIds = this.pendingByDocUri.get(documentUri);
        return !!pendingIds && pendingIds.size > 0;
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
                // Use vscodeAdapter.Uri if available (Ports and Adapters pattern), otherwise fallback to vscode.Uri
                const Uri = this.vscodeAdapter ? this.vscodeAdapter.Uri : vscode.Uri;
                const uri = Uri.file(filePathOrUri);
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

