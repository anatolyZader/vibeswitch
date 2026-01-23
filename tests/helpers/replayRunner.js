/**
 * Replay Runner for Testing
 * 
 * Replays recorded suggestion timelines deterministically to validate score behavior.
 */

class ReplayRunner {
    constructor(scoreService, debtService, suggestionAggregate) {
        this.scoreService = scoreService;
        this.debtService = debtService;
        this.suggestionAggregate = suggestionAggregate;
        this.now = Date.now();
        this._suggestionIdMap = new Map(); // Map event suggestionId to actual suggestion ID
    }

    /**
     * Replay events from a fixture
     * @param {Array} events - Array of events to replay
     * @param {Function} onEvent - Optional callback for each event
     * @returns {Array} Array of score snapshots after each event
     */
    replay(events, onEvent = null) {
        const snapshots = [];
        
        for (const event of events) {
            // Advance time if specified
            if (event.timestamp) {
                this.now = event.timestamp;
            } else if (event.advanceMs) {
                this.now += event.advanceMs;
            }

            // Process event
            switch (event.type) {
                case 'suggestion_created':
                    this._handleSuggestionCreated(event);
                    break;
                case 'suggestion_reviewed':
                    this._handleSuggestionReviewed(event);
                    break;
                case 'suggestion_status_changed':
                    this._handleStatusChanged(event);
                    break;
                case 'debt_added':
                    this._handleDebtAdded(event);
                    break;
                case 'tick':
                    // Just advance time
                    break;
            }

            // Calculate score after event
            const suggestions = this.suggestionAggregate.getSuggestions();
            const result = this.scoreService.calculateScore({
                suggestions,
                debtService: this.debtService
            });

            snapshots.push({
                timestamp: this.now,
                event: event.type,
                score: result.currentScore,
                components: { ...result.scores }
            });

            if (onEvent) {
                onEvent(event, result);
            }
        }

        return snapshots;
    }

    _handleSuggestionCreated(event) {
        const suggestion = this.suggestionAggregate.createSuggestion({
            document: event.document || 'file:///test.js',
            range: event.range || { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
            text: event.text || 'test code',
            size: event.size || 100,
            timestamp: event.timestamp || this.now,
            isFileWrite: event.isFileWrite || false,
            isFileCreation: event.isFileCreation || false,
            provenanceScore: event.provenanceScore || 0.8
        });
        this.suggestionAggregate.addSuggestion(suggestion);
        // Store suggestion ID for later reference (use index if no ID provided)
        const eventId = event.suggestionId || `suggestion-${this._suggestionIdMap.size + 1}`;
        this._suggestionIdMap.set(eventId, suggestion.id);
    }

    _handleSuggestionReviewed(event) {
        // Map event suggestionId to actual suggestion ID if needed
        let suggestionId = event.suggestionId;
        if (this._suggestionIdMap && this._suggestionIdMap.has(suggestionId)) {
            suggestionId = this._suggestionIdMap.get(suggestionId);
        }
        
        this.suggestionAggregate.markSuggestionReviewed(suggestionId, {
            reviewTimeDeltaMs: event.reviewTime || 6000
        });
    }

    _handleStatusChanged(event) {
        // Map event suggestionId to actual suggestion ID if needed
        let suggestionId = event.suggestionId;
        if (this._suggestionIdMap && this._suggestionIdMap.has(suggestionId)) {
            suggestionId = this._suggestionIdMap.get(suggestionId);
        } else {
            // Try to find by index if no mapping exists
            const allSuggestions = this.suggestionAggregate.getSuggestions();
            if (allSuggestions.length > 0) {
                // Use most recent suggestion if ID not found
                suggestionId = allSuggestions[allSuggestions.length - 1].id;
            }
        }
        
        const suggestion = this.suggestionAggregate.findSuggestion(suggestionId);
        if (suggestion) {
            this.suggestionAggregate.updateSuggestionStatus(suggestion, event.status);
        }
    }

    _handleDebtAdded(event) {
        this.debtService.addToDebt(event.fileUri || 'file:///test.js', event.size || 100, () => {});
    }
}

module.exports = ReplayRunner;
