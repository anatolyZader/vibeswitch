/**
 * Change Ledger
 * Stores batch events per document for DIFF bullet generation and enforcement
 * 
 * Domain entity - uses ports for all infrastructure operations
 * 
 * Tracks:
 * - Observed diffs (editor-level batches with classification)
 * - Declared diffs (DIFF bullet skeletons)
 * - Checkpoints for enforcement boundaries
 * 
 * Fix: Buffered writes to prevent write amplification and race conditions
 */

class ChangeLedger {
    /**
     * @param {number} maxEntries - Maximum entries to keep (default: 2000)
     * @param {number} flushIntervalMs - Flush interval in milliseconds (default: 1000)
     * @param {IAwarenessPersistencePort} persistencePort - Persistence port (interface, required)
     * @param {IHashGeneratorPort} hashGeneratorPort - Hash generator port (interface, required)
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(maxEntries = 2000, flushIntervalMs = 1000, persistencePort, hashGeneratorPort, loggerPort = null) {
        if (!persistencePort) {
            throw new Error('ChangeLedger requires persistencePort');
        }
        if (!hashGeneratorPort) {
            throw new Error('ChangeLedger requires hashGeneratorPort');
        }
        
        this.persistencePort = persistencePort;
        this.hashGeneratorPort = hashGeneratorPort;
        this.loggerPort = loggerPort;
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

    _load() {
        if (this._memEntries === null) {
            // Use persistence adapter for loading
            this._memEntries = this.persistenceAdapter.loadSync(this.key) || [];
        }
        return this._memEntries;
    }

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
            
            // Use persistence adapter for saving
            await this.persistenceAdapter.save(this.key, this._memEntries);
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
                        if (this.loggerAdapter) {
                            this.loggerPort.error('ChangeLedger: Queued flush error', err);
                        }
                    }));
                } else {
                    // Fallback for older Node versions
                    Promise.resolve().then(() => this._flush().catch(err => {
                        if (this.loggerAdapter) {
                            this.loggerPort.error('ChangeLedger: Queued flush error', err);
                        }
                    }));
                }
            }
        }
    }

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
                if (this.loggerAdapter) {
                    this.loggerPort.error('ChangeLedger: Flush error', err);
                }
            });
        }, this._flushIntervalMs);
    }

    _generateBatchId() {
        // Use hash generator adapter for ID generation (use hash of timestamp + random)
        // Note: This method should ideally use IIdGeneratorPort, but for now we use hashGenerator
        const random = Math.random().toString(36).substring(2, 15);
        const timestamp = Date.now().toString();
        return this.hashGeneratorAdapter.createHash('md5', timestamp + random).substring(0, 36);
        }
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

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
            if (!batchId && process.env.NODE_ENV !== 'production' && this.loggerAdapter) {
                const recentTail = entries.slice(-5).map(e => `${e.kind}:${e.uri || e.file || 'unknown'}`).join(', ');
                this.loggerPort.log(`ChangeLedger: diff_bullets entry missing batchId for ${entry.uri || entry.file || 'unknown'}. Recent entries: ${recentTail}`);
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

    async flush() {
        if (this._flushTimer) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }
        await this._flush();
    }

    async checkpointNow(options = {}) {
        const checkpoint = {
            ts: Date.now(),
            reason: options.reason || 'markReviewed',
            mode: options.mode || 'dev',
            workspaceFolder: options.workspaceFolder || null
        };
        
        // Use persistence adapter for saving checkpoint
        await this.persistenceAdapter.save(this.ckKey, checkpoint);
    }

    getCheckpoint() {
        // Use persistence adapter for loading checkpoint
        const checkpoint = this.persistenceAdapter.loadSync(this.ckKey) || null;
        
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
        // Use persistence adapter if available (Ports and Adapters pattern)
        if (this.persistenceAdapter) {
            await this.persistenceAdapter.save(this.ckKey, null);
        } else if (this.context && this.context.workspaceState) {
            // Fallback to direct context access (backward compatibility)
        await this.context.workspaceState.update(this.ckKey, null);
        }
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

