/**
 * GoF Command: encapsulate a request as an object so it can be logged, queued, or replayed.
 * Used for debug actions (e.g. "dump state", "trace on") that can be executed or undone.
 */

/**
 * Base command interface: execute() and optional undo().
 */
class DebugCommand {
    /**
     * Execute the command.
     * @returns {Promise<void>|void}
     */
    execute() {
        throw new Error('Subclass must implement execute()');
    }

    /**
     * Undo the command if applicable.
     * @returns {Promise<void>|void}
     */
    undo() {
        // optional
    }
}

/**
 * Concrete command: log current timestamp and label (e.g. for trace points).
 */
class LogMarkerCommand extends DebugCommand {
    /**
     * @param {string} label
     * @param {function(string, number): void} [sink] – (label, ts) => void
     */
    constructor(label, sink = (l, ts) => console.log(`[Marker] ${l} ${ts}`)) {
        super();
        this.label = label;
        this.sink = sink;
        this._ts = null;
    }

    execute() {
        this._ts = Date.now();
        this.sink(this.label, this._ts);
    }
}

/**
 * Concrete command: toggle a boolean flag (e.g. "trace enabled").
 * Supports undo by restoring previous value.
 */
class ToggleFlagCommand extends DebugCommand {
    /**
     * @param {Object} obj – object that holds the flag
     * @param {string} key – property name
     * @param {boolean} [value] – value to set; if omitted, flips current
     */
    constructor(obj, key, value) {
        super();
        this.obj = obj;
        this.key = key;
        this.value = value;
        this._previous = undefined;
    }

    execute() {
        this._previous = this.obj[this.key];
        this.obj[this.key] = this.value !== undefined ? this.value : !this._previous;
    }

    undo() {
        if (this._previous !== undefined) {
            this.obj[this.key] = this._previous;
        }
    }
}

/**
 * Invoker: executes commands and optionally keeps history for undo.
 */
class CommandInvoker {
    constructor(undoStackSize = 50) {
        this._undoStack = [];
        this._undoStackSize = undoStackSize;
    }

    /**
     * @param {DebugCommand} command
     */
    run(command) {
        command.execute();
        if (typeof command.undo === 'function') {
            this._undoStack.push(command);
            if (this._undoStack.length > this._undoStackSize) {
                this._undoStack.shift();
            }
        }
    }

    undoLast() {
        const cmd = this._undoStack.pop();
        if (cmd && typeof cmd.undo === 'function') cmd.undo();
    }
}

// ---------------------------------------------------------------------------
// GoF Observer: define a one-to-many dependency so observers are notified
// when a subject’s state changes. Used for debug events (e.g. command run, state change).
// ---------------------------------------------------------------------------

/**
 * Subject: maintains a list of observers and notifies them on state/event changes.
 */
class DebugSubject {
    constructor() {
        this._observers = new Set();
    }

    /**
     * @param {function(*): void} observer – callback(event) when subject notifies
     */
    subscribe(observer) {
        if (typeof observer === 'function') this._observers.add(observer);
    }

    unsubscribe(observer) {
        this._observers.delete(observer);
    }

    /**
     * Notify all observers with an event payload.
     * @param {*} event – e.g. { type: 'commandExecuted', command, result }
     */
    notify(event) {
        for (const obs of this._observers) {
            try {
                obs(event);
            } catch (err) {
                console.error('[DebugSubject] observer error:', err);
            }
        }
    }
}

/**
 * Concrete subject that emits events when commands are run (combines Command + Observer).
 */
class ObservableCommandInvoker extends CommandInvoker {
    constructor(undoStackSize = 50) {
        super(undoStackSize);
        this._subject = new DebugSubject();
    }

    subscribe(observer) {
        this._subject.subscribe(observer);
    }

    unsubscribe(observer) {
        this._subject.unsubscribe(observer);
    }

    run(command) {
        super.run(command);
        this._subject.notify({ type: 'commandExecuted', command });
    }
}

module.exports = {
    DebugCommand,
    LogMarkerCommand,
    ToggleFlagCommand,
    CommandInvoker,
    DebugSubject,
    ObservableCommandInvoker
};
