/**
 * GoF Observer: one-to-many dependency; when subject changes, observers are notified.
 * Used for debug/awareness events so multiple listeners can react without coupling.
 */

/**
 * Subject that notifies observers of debug events.
 */
class DebugEventSubject {
    constructor() {
        this._observers = new Set();
    }

    /**
     * @param {function(string, Object): void} observer – (eventName, payload) => void
     * @returns {function(): void} Unsubscribe
     */
    subscribe(observer) {
        this._observers.add(observer);
        return () => this._observers.delete(observer);
    }

    /**
     * @param {string} eventName
     * @param {Object} [payload]
     */
    notify(eventName, payload = {}) {
        for (const obs of this._observers) {
            try {
                obs(eventName, payload);
            } catch (e) {
                console.error('DebugEventSubject: observer error', e);
            }
        }
    }

    /** Number of registered observers */
    get observerCount() {
        return this._observers.size;
    }
}

/**
 * Example observer: logs events to console.
 * @param {string} eventName
 * @param {Object} payload
 */
function logObserver(eventName, payload) {
    console.log(`[DebugEvent] ${eventName}`, payload);
}

/**
 * Example observer: collects last N events for inspection.
 * @param {number} maxSize
 * @returns {{ events: Array<{eventName: string, payload: Object}>, observer: function}}
 */
function historyObserver(maxSize = 100) {
    const events = [];
    return {
        events,
        observer(eventName, payload) {
            events.push({ eventName, payload, at: Date.now() });
            if (events.length > maxSize) events.shift();
        }
    };
}

module.exports = {
    DebugEventSubject,
    logObserver,
    historyObserver
};
