/**
 * IAwarenessMessagingPort - Interface for publishing domain events used by the Awareness module
 * 
 * This port defines the contract for publishing awareness domain events.
 * Implementations can use event emitters, Pub/Sub, or other messaging systems.
 */

class IAwarenessMessagingPort {
    constructor() {
        if (new.target === IAwarenessMessagingPort) {
            throw new Error('Cannot instantiate an abstract class.');
        }
    }

    /**
     * Publish an AI suggestion event
     * @param {Object} event - AISuggestionEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishAISuggestionEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish an AI suggestion outcome event
     * @param {Object} event - AISuggestionOutcomeEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishAISuggestionOutcomeEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a score update event
     * @param {Object} event - ScoreUpdateEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishScoreUpdateEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a keep all event
     * @param {Object} event - KeepAllEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishKeepAllEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a debt cleared event
     * @param {Object} event - DebtClearedEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishDebtClearedEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a review session started event
     * @param {Object} event - ReviewSessionStartedEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishReviewSessionStartedEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a review session completed event
     * @param {Object} event - ReviewSessionCompletedEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishReviewSessionCompletedEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }

    /**
     * Publish a suggestion batch created event
     * @param {Object} event - SuggestionBatchCreatedEvent instance
     * @param {string} correlationId - Optional correlation ID for tracking
     */
    async publishSuggestionBatchCreatedEvent(event, correlationId = null) {
        throw new Error('Method not implemented.');
    }
}

module.exports = IAwarenessMessagingPort;

