/**
 * Episode - Represents a continuous activity window
 * 
 * An episode is a period of continuous coding activity that may span multiple files.
 * Episodes are used for better behavioral analysis and feature extraction.
 * 
 * Research-aligned: Activity windows (20-45s idle threshold) that group related edits.
 */

class Episode {
    /**
     * @param {string} episodeId - Unique identifier for the episode
     * @param {number} startTs - Start timestamp
     */
    constructor(episodeId, startTs = Date.now()) {
        if (!episodeId) {
            throw new Error('Episode requires an episodeId');
        }
        
        this.episodeId = episodeId;
        this.startTs = startTs;
        this.endTs = null;
        
        // Files touched during this episode
        this.filesTouched = new Set();
        
        // Edit spans: {fileUri, range, deltaSize, timestamp}
        this.editSpans = [];
        
        // Context signals: {type: 'focus'|'save'|'test', timestamp}
        this.contextSignals = [];
        
        // Last activity timestamp (for idle detection)
        this.lastActivityTs = startTs;
    }
    
    /**
     * Add an edit to this episode
     * @param {string} fileUri - File URI where edit occurred
     * @param {Object} range - Text range (start/end positions)
     * @param {number} deltaSize - Size of the change (inserted - deleted)
     * @param {number} timestamp - Timestamp of the edit (default: now)
     */
    addEdit(fileUri, range, deltaSize, timestamp = Date.now()) {
        if (!fileUri) return;
        
        this.filesTouched.add(fileUri);
        this.editSpans.push({
            fileUri,
            range,
            deltaSize,
            timestamp
        });
        this.lastActivityTs = timestamp;
    }
    
    /**
     * Add a context signal (focus change, save, test run, etc.)
     * @param {string} type - Signal type ('focus', 'save', 'test', 'navigation')
     * @param {number} timestamp - Timestamp of the signal (default: now)
     * @param {Object} metadata - Optional metadata
     */
    addContextSignal(type, timestamp = Date.now(), metadata = {}) {
        this.contextSignals.push({
            type,
            timestamp,
            ...metadata
        });
        this.lastActivityTs = timestamp;
    }
    
    /**
     * Check if episode is idle (no activity for threshold duration)
     * @param {number} idleThresholdMs - Idle threshold in milliseconds (default: 30000 = 30s)
     * @returns {boolean} True if episode is idle
     */
    isIdle(idleThresholdMs = 30000) {
        const timeSinceActivity = Date.now() - this.lastActivityTs;
        return timeSinceActivity > idleThresholdMs;
    }
    
    /**
     * End the episode
     * @param {number} endTs - End timestamp (default: now)
     */
    end(endTs = Date.now()) {
        this.endTs = endTs;
    }
    
    /**
     * Get episode duration in milliseconds
     * @returns {number} Duration in ms
     */
    getDuration() {
        const end = this.endTs || Date.now();
        return end - this.startTs;
    }
    
    /**
     * Get total edits in this episode
     * @returns {number} Number of edits
     */
    getEditCount() {
        return this.editSpans.length;
    }
    
    /**
     * Get total delta size (sum of all insertions - deletions)
     * @returns {number} Total delta size
     */
    getTotalDeltaSize() {
        return this.editSpans.reduce((sum, span) => sum + span.deltaSize, 0);
    }
    
    /**
     * Get number of files touched
     * @returns {number} Number of distinct files
     */
    getFileCount() {
        return this.filesTouched.size;
    }
    
    /**
     * Get focus switches count
     * @returns {number} Number of focus/navigation events
     */
    getFocusSwitchCount() {
        return this.contextSignals.filter(s => s.type === 'focus' || s.type === 'navigation').length;
    }
    
    /**
     * Get save count
     * @returns {number} Number of save events
     */
    getSaveCount() {
        return this.contextSignals.filter(s => s.type === 'save').length;
    }
    
    /**
     * Check if episode has multi-file activity
     * @returns {boolean} True if multiple files were touched
     */
    isMultiFile() {
        return this.filesTouched.size > 1;
    }
    
    /**
     * Get time to touch N files (for interaction metrics)
     * @param {number} n - Number of files
     * @returns {number|null} Time in ms to touch N files, or null if not reached
     */
    getTimeToTouchNFiles(n) {
        if (this.filesTouched.size < n) return null;
        
        const fileTimestamps = new Map();
        for (const span of this.editSpans) {
            if (!fileTimestamps.has(span.fileUri)) {
                fileTimestamps.set(span.fileUri, span.timestamp);
            }
        }
        
        const timestamps = Array.from(fileTimestamps.values()).sort((a, b) => a - b);
        if (timestamps.length >= n) {
            return timestamps[n - 1] - this.startTs;
        }
        
        return null;
    }
}

module.exports = Episode;
