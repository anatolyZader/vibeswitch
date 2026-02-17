/**
 * GoF Facade: provide a unified interface to a set of interfaces in a subsystem.
 * Simplifies debug/awareness operations by hiding complexity of score, events, and logging.
 */

/**
 * Facade: single entry point for debug dashboard operations.
 * Hides awareness engine, event store, and output channel behind a simple API.
 */
class DebugDashboardFacade {
    /**
     * @param {Object} deps – { awarenessEngine, eventStore, outputChannel }
     */
    constructor(deps = {}) {
        this._engine = deps.awarenessEngine || null;
        this._eventStore = deps.eventStore || null;
        this._output = deps.outputChannel || null;
    }

    /**
     * Get a summary suitable for display (score + event count).
     * @returns {{ score: number, eventCount: number, mode: string }}
     */
    getSummary() {
        let score = 0;
        let eventCount = 0;
        let mode = 'unknown';

        if (this._engine && typeof this._engine.getScore === 'function') {
            const data = this._engine.getScore();
            score = data?.total ?? 0;
        }
        if (this._engine && typeof this._engine.getAntipatternEvents === 'function') {
            this._engine.getAntipatternEvents(0).then((events) => {
                eventCount = events?.length ?? 0;
            }).catch(() => {});
        }
        if (this._eventStore && typeof this._eventStore.getEventCount === 'function') {
            eventCount = this._eventStore.getEventCount();
        }

        return { score, eventCount, mode };
    }

    /**
     * Append a line to the output channel (if available).
     * @param {string} line
     */
    appendLine(line) {
        if (this._output && typeof this._output.appendLine === 'function') {
            this._output.appendLine(line);
        }
    }

    /**
     * Show the output channel.
     */
    show() {
        if (this._output && typeof this._output.show === 'function') {
            this._output.show();
        }
    }

    /**
     * One-shot: get summary and log it to output.
     */
    logSummary() {
        const s = this.getSummary();
        this.appendLine(`[Debug] score=${s.score} events=${s.eventCount}`);
        this.show();
    }
}

module.exports = {
    DebugDashboardFacade
};
