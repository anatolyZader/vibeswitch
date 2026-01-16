/**
 * Episode Manager
 * Manages episode lifecycle and provides episode-based analysis
 * 
 * Research-aligned: Groups events into activity windows (episodes) for better
 * behavioral analysis and feature extraction.
 */

const Episode = require('./episode');

class EpisodeManager {
    /**
     * @param {Object} options - Configuration options
     * @param {number} options.idleThresholdMs - Idle threshold in milliseconds (default: 30000 = 30s)
     * @param {Function} options.idGenerator - ID generator function (default: generates UUID-like string)
     */
    constructor(options = {}) {
        this.idleThresholdMs = options.idleThresholdMs || 30000; // 30 seconds
        this.idGenerator = options.idGenerator || (() => {
            // Simple ID generator (can be replaced with proper UUID generator)
            return `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        });
        
        // Current active episode
        this.currentEpisode = null;
        
        // Completed episodes (keep last N for analysis)
        this.episodes = [];
        this.maxEpisodes = 100; // Keep last 100 episodes
    }
    
    /**
     * Start a new episode (or return current if not idle)
     * @returns {Episode} Current or new episode
     */
    startEpisode() {
        // If current episode exists and is not idle, return it
        if (this.currentEpisode && !this.currentEpisode.isIdle(this.idleThresholdMs)) {
            return this.currentEpisode;
        }
        
        // End current episode if it exists
        if (this.currentEpisode) {
            this.currentEpisode.end();
            this.episodes.push(this.currentEpisode);
            
            // Trim episodes if needed
            if (this.episodes.length > this.maxEpisodes) {
                this.episodes.shift(); // Remove oldest
            }
        }
        
        // Create new episode
        const episodeId = this.idGenerator();
        this.currentEpisode = new Episode(episodeId, Date.now());
        
        return this.currentEpisode;
    }
    
    /**
     * Add an edit to current episode (creates episode if needed)
     * @param {string} fileUri - File URI where edit occurred
     * @param {Object} range - Text range
     * @param {number} deltaSize - Size of the change
     * @param {number} timestamp - Timestamp (default: now)
     */
    addEdit(fileUri, range, deltaSize, timestamp = Date.now()) {
        const episode = this.startEpisode();
        episode.addEdit(fileUri, range, deltaSize, timestamp);
    }
    
    /**
     * Add a context signal to current episode (creates episode if needed)
     * @param {string} type - Signal type ('focus', 'save', 'test', 'navigation')
     * @param {number} timestamp - Timestamp (default: now)
     * @param {Object} metadata - Optional metadata
     */
    addContextSignal(type, timestamp = Date.now(), metadata = {}) {
        const episode = this.startEpisode();
        episode.addContextSignal(type, timestamp, metadata);
    }
    
    /**
     * Get current active episode
     * @returns {Episode|null} Current episode or null
     */
    getCurrentEpisode() {
        return this.currentEpisode;
    }
    
    /**
     * Get recent episodes (last N)
     * @param {number} count - Number of episodes to return (default: 10)
     * @returns {Array<Episode>} Array of recent episodes
     */
    getRecentEpisodes(count = 10) {
        return this.episodes.slice(-count);
    }
    
    /**
     * Get all episodes
     * @returns {Array<Episode>} All episodes
     */
    getAllEpisodes() {
        return [...this.episodes, ...(this.currentEpisode ? [this.currentEpisode] : [])];
    }
    
    /**
     * End current episode (if any)
     */
    endCurrentEpisode() {
        if (this.currentEpisode) {
            this.currentEpisode.end();
            this.episodes.push(this.currentEpisode);
            
            // Trim episodes if needed
            if (this.episodes.length > this.maxEpisodes) {
                this.episodes.shift();
            }
            
            this.currentEpisode = null;
        }
    }
    
    /**
     * Clear all episodes (for cleanup/reset)
     */
    clear() {
        if (this.currentEpisode) {
            this.currentEpisode.end();
        }
        this.episodes = [];
        this.currentEpisode = null;
    }
}

module.exports = EpisodeManager;
