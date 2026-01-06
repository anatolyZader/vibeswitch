/**
 * IEventPort - Interface for event emission
 * 
 * This port abstracts event emission, enabling:
 * - Testability with mock event emitters
 * - Flexibility to swap event mechanisms (callbacks, event emitters, pub/sub)
 * - Clear separation between domain and infrastructure
 * 
 * Currently optional - may be used for future event-driven communication between modules.
 */

/**
 * @interface IEventPort
 */
class IEventPort {
    /**
     * Emit an event
     * @param {string} eventName - Name of the event
     * @param {*} data - Event data
     * @returns {void}
     */
    emit(eventName, data) {
        throw new Error('emit not implemented');
    }

    /**
     * Register an event listener
     * @param {string} eventName - Name of the event
     * @param {Function} handler - Handler function
     * @returns {Object} Disposable to unsubscribe
     */
    on(eventName, handler) {
        throw new Error('on not implemented');
    }

    /**
     * Remove an event listener
     * @param {string} eventName - Name of the event
     * @param {Function} handler - Handler function
     * @returns {void}
     */
    off(eventName, handler) {
        throw new Error('off not implemented');
    }
}

module.exports = IEventPort;


