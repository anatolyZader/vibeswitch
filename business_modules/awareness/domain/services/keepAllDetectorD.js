/**
 * KeepAllDetectorD - Domain service for detecting "Keep All" patterns
 * 
 * Encapsulates business logic for detecting when users rapidly accept
 * multiple AI suggestions. This is a domain service.
 */

class KeepAllDetectorD {
    /**
     * @param {Function} onKeepAll - Callback when "keep all" pattern detected
     * @param {ILoggerPort} loggerPort - Logger port (interface, optional)
     */
    constructor(onKeepAll, loggerPort = null) {
        this.onKeepAll = onKeepAll;
        this.loggerPort = loggerPort;
        
        // "Keep All" detection - track rapid acceptances
        this.recentAcceptances = [];
        this.keepAllDetectionWindow = 2000; // 2 seconds
        this.keepAllThreshold = 3; // Minimum acceptances to trigger
    }

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
            
            if (this.loggerPort) {
                this.loggerPort.log(`AwarenessMonitor: "Keep All" detected - ${recent.length} suggestions accepted across ${uniqueFiles.size} files`);
            }
            
            // Call optional callback (e.g., for UsageStats)
            if (this.onKeepAll) {
                this.onKeepAll({
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

    /**
     * Get number of recent acceptances
     * @returns {number} Number of recent acceptances
     */
    getRecentAcceptanceCount() {
        return this.recentAcceptances.length;
    }

    /**
     * Clear all tracked acceptances
     */
    clear() {
        this.recentAcceptances = [];
    }
}

module.exports = KeepAllDetectorD;

