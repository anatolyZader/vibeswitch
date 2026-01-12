/**
 * ReviewTrackingService - Application service for tracking suggestion review sessions
 * 
 * Handles cursor movement, scroll, and dwell time tracking for suggestion reviews.
 * This service manages review state and coordinates with suggestion lifecycle.
 * 
 * This service replaces the review tracking logic that was previously in the input layer.
 */

class ReviewTrackingService {
    /**
     * @param {Object} suggestionService - Suggestion service
     * @param {Object} rangeOperationServiceD - Range operation domain service
     * @param {IAwarenessVSCodePort} vscodePort - VS Code port
     * @param {ILoggerPort} loggerPort - Logger port (optional)
     * @param {Function} onSuggestionReviewed - Callback when suggestion is reviewed
     * @param {Function} onStatusCheck - Callback to trigger status check
     * @param {Object} timerRegistry - Timer registry for managing timers (optional, falls back to setTimeout)
     */
    constructor(suggestionService, rangeOperationServiceD, vscodePort, loggerPort = null, onSuggestionReviewed = null, onStatusCheck = null, timerRegistry = null) {
        this.suggestionService = suggestionService;
        this.rangeOperationServiceD = rangeOperationServiceD;
        this.vscodePort = vscodePort;
        this.loggerPort = loggerPort;
        this.onSuggestionReviewed = onSuggestionReviewed;
        this.onStatusCheck = onStatusCheck;
        this.timerRegistry = timerRegistry; // Use timer registry if provided
        
        // Active review tracking: URI -> { suggestionId, reviewStarted, reviewTime, dwellTimer }
        this.activeReviews = new Map();
        
        // Dwell time threshold (1000ms)
        this.DWELL_TIME_MS = 1000;
    }

    /**
     * Handle cursor move event
     * @param {string} uri - Document URI string
     * @param {Object} position - Cursor position { line, character }
     * @param {number} now - Current timestamp (optional, defaults to Date.now())
     */
    onCursorMoved(uri, position, now = Date.now()) {
        if (!uri || !position) return;
        
        // Get pending suggestions for this document
        const pendingSuggestions = this.suggestionService.getSuggestionsByStatus('pending')
            .filter(s => s.document === uri);
        
        const activeReview = this.activeReviews.get(uri);
        
        // Check if cursor left the active suggestion
        if (activeReview) {
            const activeSuggestion = pendingSuggestions.find(s => s.id === activeReview.suggestionId);
            if (activeSuggestion) {
                const isInRange = this.rangeOperationServiceD.isPositionInRange(
                    this.vscodePort,
                    position,
                    activeSuggestion.range
                );
                
                if (!isInRange) {
                    // Cursor left the suggestion - close review
                    this._closeReview(uri, now);
                } else {
                    // Still in active suggestion - continue tracking
                    return;
                }
            } else {
                // Active suggestion no longer exists
                this._closeReview(uri, now);
            }
        }
        
        // Check if cursor entered a new suggestion
        for (const suggestion of pendingSuggestions) {
            const isInRange = this.rangeOperationServiceD.isPositionInRange(
                this.vscodePort,
                position,
                suggestion.range
            );
            
            if (isInRange) {
                // Start tracking this suggestion
                this._startReview(uri, suggestion.id, now);
                return;
            }
        }
    }

    /**
     * Handle scroll event
     * @param {string} uri - Document URI string
     * @param {number} now - Current timestamp (optional)
     */
    onScroll(uri, now = Date.now()) {
        // Scroll events can be used for engagement tracking
        // Currently just ensure active review is maintained
        if (this.activeReviews.has(uri)) {
            // Review is still active
            return;
        }
    }

    /**
     * Handle document close or editor change
     * @param {string} uri - Document URI string
     * @param {number} now - Current timestamp (optional)
     */
    onDocumentClose(uri, now = Date.now()) {
        if (uri) {
            this._closeReview(uri, now);
        }
    }

    /**
     * Start tracking a review session
     * @private
     */
    _startReview(uri, suggestionId, now) {
        // Clear any existing review for this URI
        this._closeReview(uri, now, false);
        
        // Create dwell timer (use timer registry if available)
        const createTimer = this.timerRegistry 
            ? (callback, delay) => this.timerRegistry.setTimeout(callback, delay)
            : setTimeout;
        
        const dwellTimer = createTimer(() => {
            const currentReview = this.activeReviews.get(uri);
            if (currentReview && currentReview.suggestionId === suggestionId) {
                // Mark suggestion as reviewed after dwell time
                if (this.onSuggestionReviewed) {
                    this.onSuggestionReviewed(suggestionId);
                }
                
                // Trigger status check
                if (this.onStatusCheck) {
                    this.onStatusCheck(suggestionId);
                }
            }
        }, this.DWELL_TIME_MS);
        
        // Store review state
        this.activeReviews.set(uri, {
            suggestionId,
            reviewStarted: now,
            reviewTime: 0,
            dwellTimer
        });
    }

    /**
     * Close an active review session
     * @private
     */
    _closeReview(uri, now, updateReviewTime = true) {
        const activeReview = this.activeReviews.get(uri);
        if (!activeReview) return;
        
        // Clear dwell timer (use timer registry if available)
        if (activeReview.dwellTimer) {
            if (this.timerRegistry) {
                this.timerRegistry.clearTimeout(activeReview.dwellTimer);
            } else {
                clearTimeout(activeReview.dwellTimer);
            }
        }
        
        // Update review time if requested
        if (updateReviewTime && activeReview.reviewStarted) {
            const reviewDuration = now - activeReview.reviewStarted;
            if (reviewDuration > 0 && this.suggestionService) {
                const suggestion = this.suggestionService.getSuggestionById(activeReview.suggestionId);
                if (suggestion) {
                    const currentReviewTime = suggestion.reviewTime || 0;
                    this.suggestionService.updateSuggestionReviewTime(
                        activeReview.suggestionId,
                        currentReviewTime + reviewDuration
                    );
                }
            }
        }
        
        // Remove from active reviews
        this.activeReviews.delete(uri);
    }

    /**
     * Get pending suggestions for a document
     * @param {string} uri - Document URI string
     * @returns {Array} Array of pending suggestions
     */
    getPendingSuggestions(uri) {
        return this.suggestionService.getSuggestionsByStatus('pending')
            .filter(s => s.document === uri);
    }

    /**
     * Check if position is in range (helper for input layer if needed)
     * @param {Object} position - Position { line, character }
     * @param {Object} range - Range { start, end }
     * @returns {boolean} True if position is in range
     */
    isPositionInRange(position, range) {
        return this.rangeOperationServiceD.isPositionInRange(
            this.vscodePort,
            position,
            range
        );
    }

    /**
     * Dispose - clean up all timers
     */
    dispose() {
        for (const [uri, review] of this.activeReviews.entries()) {
            if (review.dwellTimer) {
                if (this.timerRegistry) {
                    this.timerRegistry.clearTimeout(review.dwellTimer);
                } else {
                    clearTimeout(review.dwellTimer);
                }
            }
        }
        this.activeReviews.clear();
    }
}

module.exports = ReviewTrackingService;
