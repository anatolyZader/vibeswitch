/**
 * AwarenessEventEmitterMessagingAdapter - Messaging adapter using Node.js EventEmitter
 * 
 * This adapter publishes domain events using an EventEmitter pattern.
 * For VS Code extensions, this is a simple in-process messaging solution.
 * Can be replaced with Pub/Sub or other messaging systems if needed.
 */

const EventEmitter = require('events');
const IAwarenessMessagingPort = require('../../domain/ports/IAwarenessMessagingPort');
const { getLogger } = require('../../../../logger');

class AwarenessEventEmitterMessagingAdapter extends IAwarenessMessagingPort {
    constructor(eventEmitter = null) {
        super();
        // Use provided event emitter or create a new one
        this.eventEmitter = eventEmitter || new EventEmitter();
        this.logger = getLogger();
    }

    /**
     * Get the underlying event emitter (for subscribing to events)
     * @returns {EventEmitter} The event emitter instance
     */
    getEventEmitter() {
        return this.eventEmitter;
    }

    async publishAISuggestionEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('aiSuggestion', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published AISuggestionEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing AISuggestionEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishAISuggestionOutcomeEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('aiSuggestionOutcome', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published AISuggestionOutcomeEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing AISuggestionOutcomeEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishScoreUpdateEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('scoreUpdate', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published ScoreUpdateEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing ScoreUpdateEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishKeepAllEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('keepAll', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published KeepAllEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing KeepAllEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishDebtClearedEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('debtCleared', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published DebtClearedEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing DebtClearedEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishReviewSessionStartedEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('reviewSessionStarted', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published ReviewSessionStartedEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing ReviewSessionStartedEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishReviewSessionCompletedEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('reviewSessionCompleted', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published ReviewSessionCompletedEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing ReviewSessionCompletedEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    async publishSuggestionBatchCreatedEvent(event, correlationId = null) {
        try {
            const payload = {
                event: event.toJSON(),
                correlationId: correlationId || this._generateCorrelationId()
            };
            this.eventEmitter.emit('suggestionBatchCreated', payload);
            this.logger.log(`EventEmitterMessagingAdapter: Published SuggestionBatchCreatedEvent (correlationId: ${payload.correlationId})`);
            return payload.correlationId;
        } catch (error) {
            this.logger.log(`EventEmitterMessagingAdapter: Error publishing SuggestionBatchCreatedEvent: ${error.message}`, false, true);
            throw error;
        }
    }

    _generateCorrelationId() {
        return `awareness-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
}

module.exports = AwarenessEventEmitterMessagingAdapter;

