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

// ---------------------------------------------------------------------------
// GoF State: object behavior changes with internal state.
// Used for debug mode (idle / tracing / paused) so notify behavior varies by state.
// ---------------------------------------------------------------------------

/**
 * Base state for debug subject: defines interface for handle/notify behavior.
 */
class DebugModeState {
    get name() {
        return 'base';
    }

    /**
     * @param {StatefulDebugSubject} subject
     * @param {string} eventName
     * @param {Object} payload
     */
    notify(subject, eventName, payload) {
        subject.notifyObservers(eventName, payload);
    }
}

/**
 * Idle state: notifies all observers as usual.
 */
class IdleDebugState extends DebugModeState {
    get name() {
        return 'idle';
    }
}

/**
 * Tracing state: notifies observers and optionally logs to console.
 */
class TracingDebugState extends DebugModeState {
    get name() {
        return 'tracing';
    }

    notify(subject, eventName, payload) {
        console.log(`[Trace] ${eventName}`, payload);
        subject.notifyObservers(eventName, payload);
    }
}

/**
 * Paused state: does not notify observers (events are dropped).
 */
class PausedDebugState extends DebugModeState {
    get name() {
        return 'paused';
    }

    notify(subject, eventName, payload) {
        // no-op: drop events while paused
    }
}

/**
 * Subject whose notify behavior depends on current state (State pattern).
 */
class StatefulDebugSubject extends DebugEventSubject {
    constructor() {
        super();
        this._state = new IdleDebugState();
    }

    /** Forward event to all observers (used by state implementations). */
    notifyObservers(eventName, payload) {
        for (const obs of this._observers) {
            try {
                obs(eventName, payload);
            } catch (e) {
                console.error('StatefulDebugSubject: observer error', e);
            }
        }
    }

    setState(state) {
        this._state = state;
    }

    getState() {
        return this._state;
    }

    notify(eventName, payload = {}) {
        this._state.notify(this, eventName, payload);
    }
}

module.exports = {
    DebugEventSubject,
    logObserver,
    historyObserver,
    DebugModeState,
    IdleDebugState,
    TracingDebugState,
    PausedDebugState,
    StatefulDebugSubject
};
