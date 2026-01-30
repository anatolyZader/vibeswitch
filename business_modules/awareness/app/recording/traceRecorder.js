/**
 * TraceRecorder - Dev-only recording of lifecycle events for replay fixtures.
 * Buffers events in ReplayRunner format and writes to a trace file on stopRecording().
 * Schema: { version: 1, events: [...], recordedAt: iso }.
 */

const fs = require('fs');
const path = require('path');

class TraceRecorder {
    constructor() {
        this.events = [];
        this.outputPath = null;
        this._recording = false;
    }

    /**
     * Start recording; events will be buffered until stopRecording().
     * @param {string} outputPath - Path for the trace file (e.g. tests/awareness/recordings/session_<ts>.trace.json)
     */
    startRecording(outputPath) {
        if (this._recording) return;
        this.outputPath = outputPath;
        this.events = [];
        this._recording = true;
    }

    /**
     * Stop recording and write buffered events to the output path.
     * @returns {Promise<void>}
     */
    async stopRecording() {
        if (!this._recording || !this.outputPath) return;
        this._recording = false;
        const dir = path.dirname(this.outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const payload = {
            version: 1,
            events: this.events,
            recordedAt: new Date().toISOString()
        };
        fs.writeFileSync(this.outputPath, JSON.stringify(payload, null, 2), 'utf8');
        this.outputPath = null;
        this.events = [];
    }

    /**
     * Push an event in ReplayRunner format.
     * @param {Object} event - { type, ... } where type is suggestion_created | suggestion_reviewed | suggestion_status_changed | debt_added | tick
     */
    push(event) {
        if (!this._recording || !event || !event.type) return;
        this.events.push({ ...event });
    }

    isRecording() {
        return this._recording;
    }
}

module.exports = TraceRecorder;
