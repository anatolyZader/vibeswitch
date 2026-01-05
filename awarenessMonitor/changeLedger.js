/**
 * Change Ledger
 * Stores batch events per document for DIFF bullet generation and enforcement
 * 
 * Tracks:
 * - Observed diffs (editor-level batches with classification)
 * - Declared diffs (DIFF bullet skeletons)
 * - Checkpoints for enforcement boundaries
 * 
 * Fix: Buffered writes to prevent write amplification and race conditions
 */

const vscode = require('vscode');
const crypto = require('crypto');

class ChangeLedger {
    /**
     * @param {vscode.ExtensionContext} context - VS Code extension context
     * @param {number} maxEntries - Maximum entries to keep (default: 2000)
     * @param {number} flushIntervalMs - Flush interval in milliseconds (default: 1000)
     */
    constructor(context, maxEntries = 2000, flushIntervalMs = 1000) {
        this.context = context;
        this.maxEntries = maxEntries;
        this.key = 'vibeswitch.changeLedger.v1';
        this.ckKey = 'vibeswitch.changeLedger.checkpoint.v1';
        
        // Fix: In-memory buffer for batched writes
        this._memEntries = null; // Lazy load on first access
        this._dirty = false;
        this._flushTimer = null;
        this._flushIntervalMs = flushIntervalMs;
        this._flushPending = false; // Mutex for flush operations
        this._flushQueued = false; // Flag to queue another flush if one is pending
        
        // Fix: Default checkpoint to activation time (not 0) to avoid dumping full history
        this._activationTime = Date.now();
    }

    /**
     * Load all entries from workspace state (with caching)
     * @returns {Array} Array of ledger entries
     * @private
     */
    _load() {
        if (this._memEntries === null) {
            this._memEntries = this.context.workspaceState.get(this.key, []);
        }
        return this._memEntries;
    }

    /**
     * Flush entries to workspace state (async, serialized)
     * Fix: Queue additional flush if one is pending to prevent lost writes
     * @returns {Promise<void>}
     * @private
     */
    async _flush() {
        // Mutex: prevent concurrent flushes, but queue another if needed
        if (this._flushPending) {
            this._flushQueued = true; // Mark that we need another flush after this one
            return;
        }
        
        if (!this._dirty || !this._memEntries) {
            return;
        }
        
        this._flushPending = true;
        try {
            // Trim old entries if over limit
            if (this._memEntries.length > this.maxEntries) {
                this._memEntries.splice(0, this._memEntries.length - this.maxEntries);
            }
            
            // Fix: Await the async update
            await this.context.workspaceState.update(this.key, this._memEntries);
            this._dirty = false;
        } finally {
            this._flushPending = false;
            
            // Fix: If another flush was queued or dirty flag set, flush again
            if (this._flushQueued || this._dirty) {
                this._flushQueued = false;
                // Fix: Use queueMicrotask for smoother scheduling (avoids starving if flush work piles up)
                // queueMicrotask is available in Node.js and VS Code extension host
                if (typeof queueMicrotask === 'function') {
                    queueMicrotask(() => this._flush().catch(err => {
                        const { getLogger } = require('../logger');
                        getLogger().log(`ChangeLedger: Queued flush error: ${err.message}`, true);
                    }));
                } else {
                    // Fallback for older Node versions
                    Promise.resolve().then(() => this._flush().catch(err => {
                        const { getLogger } = require('../logger');
                        getLogger().log(`ChangeLedger: Queued flush error: ${err.message}`, true);
                    }));
                }
            }
        }
    }

    /**
     * Schedule a flush (debounced)
     * Fix: Coalesce flush calls - if timer already set, keep earliest scheduled time
     * This reduces timer churn under bursts
     * @private
     */
    _scheduleFlush() {
        // Fix: If timer already scheduled, don't reset it (coalesce to earliest flush)
        // This reduces timer churn and ensures we don't delay flushes unnecessarily
        if (this._flushTimer) {
            return; // Keep existing scheduled flush
        }
        
        this._flushTimer = setTimeout(() => {
            this._flushTimer = null; // Clear timer ref
            this._flush().catch(err => {
                // Log but don't throw - ledger writes shouldn't crash the extension
                const { getLogger } = require('../logger');
                getLogger().log(`ChangeLedger: Flush error: ${err.message}`, true);
            });
        }, this._flushIntervalMs);
    }

    /**
     * Generate a unique batch ID
     * @returns {string} Batch ID
     * @private
     */
    _generateBatchId() {
        // Use crypto.randomUUID() if available, fallback to timestamp + random
        if (typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Append a new entry to the ledger
     * Fix: Uses in-memory buffer + scheduled flush to prevent write amplification
     * @param {Object} entry - Entry to append
     *   - {string} batchId - Batch ID (auto-generated if not provided for 'batch' kind)
     *   - {number} ts - Timestamp
     *   - {string} uri - Document URI
     *   - {string} file - Workspace-relative file path
     *   - {string} label - Classification label (ai/user/formatter/unknown)
     *   - {number} confidence - Classification confidence
     *   - {Array<string>} reasons - Classification reasons
     *   - {number} changeCount - Number of changes in batch
     *   - {number} inserted - Total characters inserted
     *   - {number} deleted - Total characters deleted
     *   - {number} lineSpan - Line span of changes
     *   - {number} distinctRangeCount - Number of distinct ranges
     *   - {string} kind - Entry kind ('batch' or 'diff_bullets')
     *   - {Array<string>} bullets - DIFF bullets (if kind is 'diff_bullets')
     *   - {string} batchId - For diff_bullets, links to batch entry (auto-linked if not provided)
     * @returns {string} The batchId (for linking diff_bullets)
     */
    append(entry) {
        const entries = this._load();
        let batchId = entry.batchId;
        
        // Fix: Generate batchId if not provided and kind is 'batch'
        if (entry.kind === 'batch' && !batchId) {
            batchId = this._generateBatchId();
            entry.batchId = batchId;
        }
        
        // Fix: Auto-link diff_bullets to most recent batch if batchId not provided
        // Prefer URI match first (handles multi-root workspaces), then fallback to file
        if (entry.kind === 'diff_bullets' && !batchId) {
            // Find most recent batch entry matching URI first, then file
            for (let i = entries.length - 1; i >= 0; i--) {
                if (entries[i].kind === 'batch') {
                    // Prefer URI match (handles multi-root workspaces, remote URIs)
                    if (entry.uri && entries[i].uri === entry.uri) {
                        batchId = entries[i].batchId;
                        entry.batchId = batchId;
                        break;
                    }
                    // Fallback to file match (for backwards compatibility)
                    if (!batchId && entry.file && entries[i].file === entry.file) {
                        batchId = entries[i].batchId;
                        entry.batchId = batchId;
                        // Don't break - continue to find URI match if available
                    }
                }
            }
            
            // Fix: Invariant check in dev - log error if still no batchId found
            if (!batchId && process.env.NODE_ENV !== 'production') {
                const { getLogger } = require('../logger');
                const recentTail = entries.slice(-5).map(e => `${e.kind}:${e.uri || e.file || 'unknown'}`).join(', ');
                getLogger().log(`ChangeLedger: diff_bullets entry missing batchId for ${entry.uri || entry.file || 'unknown'}. Recent entries: ${recentTail}`, true);
            }
        }
        
        entries.push({
            ...entry,
            ts: entry.ts || Date.now()
        });
        
        this._dirty = true;
        this._scheduleFlush();
        
        return batchId;
    }

    /**
     * Force immediate flush (for dispose/critical moments)
     * @returns {Promise<void>}
     */
    async flush() {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }
        await this._flush();
    }

    /**
     * Set a checkpoint (marks "reviewed up to here")
     * Fix: Richer checkpoint payload with reason and metadata
     * @param {Object} options - Checkpoint options
     *   - {string} reason - Reason for checkpoint ('markReviewed', 'gitCommit', etc.)
     *   - {string} mode - Current mode ('vibe', 'dev')
     *   - {string} workspaceFolder - Workspace folder path
     */
    async checkpointNow(options = {}) {
        const checkpoint = {
            ts: Date.now(),
            reason: options.reason || 'markReviewed',
            mode: options.mode || 'dev',
            workspaceFolder: options.workspaceFolder || null
        };
        
        await this.context.workspaceState.update(this.ckKey, checkpoint);
    }

    /**
     * Get checkpoint info
     * @returns {Object|null} Checkpoint object or null
     */
    getCheckpoint() {
        const checkpoint = this.context.workspaceState.get(this.ckKey, null);
        
        // Fix: If checkpoint is 0 or missing, use activation time
        if (!checkpoint) {
            return { ts: this._activationTime, reason: 'activation' };
        }
        
        // Handle legacy numeric checkpoints
        if (typeof checkpoint === 'number') {
            return { ts: checkpoint, reason: 'legacy' };
        }
        
        return checkpoint;
    }

    /**
     * Get all entries since the last checkpoint
     * Fix: Uses activation time as default, not 0
     * @returns {Array} Entries since checkpoint
     */
    getSinceCheckpoint() {
        const checkpoint = this.getCheckpoint();
        const since = checkpoint ? checkpoint.ts : this._activationTime;
        return this._load().filter(e => e.ts > since);
    }

    /**
     * Get all entries (for debugging/admin)
     * @returns {Array} All entries
     */
    getAll() {
        return this._load();
    }

    /**
     * Clear all entries (for testing/reset)
     */
    async clear() {
        this._memEntries = [];
        this._dirty = true;
        await this.flush();
        await this.context.workspaceState.update(this.ckKey, null);
    }

    /**
     * Dispose and flush pending writes
     */
    async dispose() {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }
        await this.flush();
    }
}

module.exports = ChangeLedger;

