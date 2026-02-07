/**
 * AntiPatternEventStore - Explicit event storage with dedupe and severity (Contract E + F)
 *
 * append(event), query(sinceTs?), dedupe by (type, primaryEntity, ruleId?) within window.
 * Persists to .vibeswitch/events.jsonl (repo-local). Severity from EventPolicy.
 */

const fs = require('fs');
const path = require('path');
const { getSeverity } = require('./eventPolicy');
const { dedupeKey } = require('./primaryEntityMapping');

const DEDUPE_WINDOW_MS = 10 * 60 * 1000; // 10 min
const EVENTS_DIR = '.vibeswitch';
const EVENTS_FILE = 'events.jsonl';

/**
 * @param {string} workspaceRootPath - Absolute path to workspace root
 * @param {Object} [opts] - Optional: loggerPort, dedupeWindowMs
 */
function AntiPatternEventStore(workspaceRootPath, opts) {
    opts = opts || {};
    if (!workspaceRootPath || typeof workspaceRootPath !== 'string') {
        throw new Error('AntiPatternEventStore requires workspaceRootPath');
    }
    this.workspaceRootPath = path.normalize(workspaceRootPath);
    this.loggerPort = opts.loggerPort || null;
    this.dedupeWindowMs = opts.dedupeWindowMs != null ? opts.dedupeWindowMs : DEDUPE_WINDOW_MS;
    this._eventsPath = path.join(this.workspaceRootPath, EVENTS_DIR, EVENTS_FILE);
}

/**
 * Ensure .vibeswitch directory exists.
 * @returns {Promise<void>}
 */
AntiPatternEventStore.prototype._ensureDir = function _ensureDir() {
    const dir = path.dirname(this._eventsPath);
    return fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
};

/**
 * Read existing event lines from file (last N ms or full file for dedupe check).
 * @param {number} sinceTs - Only lines with ts >= sinceTs (optional)
 * @returns {Promise<Array<{ ts: number, type: string, key: string }>>}
 */
AntiPatternEventStore.prototype._readRecentForDedupe = function _readRecentForDedupe(sinceTs) {
    const cutoff = sinceTs != null ? sinceTs : Date.now() - this.dedupeWindowMs;
    return fs.promises.readFile(this._eventsPath, 'utf8').then((raw) => {
        const lines = raw.split('\n').filter((l) => l.trim());
        const result = [];
        for (const line of lines) {
            try {
                const obj = JSON.parse(line);
                if (obj.ts >= cutoff) {
                    result.push({
                        ts: obj.ts,
                        type: obj.type,
                        key: dedupeKey({ type: obj.type, primaryEntity: obj.primaryEntity, ruleId: obj.ruleId })
                    });
                }
            } catch (_) {
                // skip malformed lines
            }
        }
        return result;
    }).catch((err) => {
        if (err.code === 'ENOENT') return [];
        if (this.loggerPort && this.loggerPort.error) {
            this.loggerPort.error('AntiPatternEventStore: read for dedupe failed', err);
        }
        return [];
    });
};

/**
 * Append event. Dedupes by (type, primaryEntity, ruleId?) within window; assigns severity via EventPolicy.
 * @param {Object} event - { type, label, detail?, primaryEntity?, ruleId?, context? }
 * @returns {Promise<boolean>} true if appended, false if deduplicated
 */
AntiPatternEventStore.prototype.append = async function append(event) {
    if (!event || typeof event.type !== 'string') {
        throw new Error('AntiPatternEventStore.append: event.type is required');
    }
    const ts = Date.now();
    const primaryEntity = event.primaryEntity != null ? event.primaryEntity : '';
    const ruleId = event.ruleId != null ? event.ruleId : '';
    const key = dedupeKey({ type: event.type, primaryEntity, ruleId });

    const recent = await this._readRecentForDedupe(ts - this.dedupeWindowMs);
    const isDup = recent.some((r) => r.key === key);
    if (isDup) return false;

    const severity = getSeverity(event.type, event.context || {});
    const line = JSON.stringify({
        ts,
        type: event.type,
        label: event.label != null ? event.label : event.type,
        detail: event.detail,
        primaryEntity,
        ruleId,
        severity
    }) + '\n';

    await this._ensureDir();
    await fs.promises.appendFile(this._eventsPath, line, 'utf8');
    return true;
};

/**
 * Query events with ts >= sinceTs. Returns array of { ts, type, label, detail?, severity? }.
 * Optionally dedupes within window (keeps latest per key).
 * @param {number} [sinceTs] - Return events with ts >= sinceTs (default: 0)
 * @param {Object} [opts] - { dedupe: true } to dedupe by (type, primaryEntity, ruleId) keeping latest
 * @returns {Promise<Array<{ ts: number, type: string, label: string, detail?: string, severity?: string }>>}
 */
AntiPatternEventStore.prototype.query = async function query(sinceTs, opts) {
    sinceTs = sinceTs != null ? sinceTs : 0;
    const dedupe = opts && opts.dedupe === true;

    const raw = await fs.promises.readFile(this._eventsPath, 'utf8').catch((err) => {
        if (err.code === 'ENOENT') return '';
        if (this.loggerPort && this.loggerPort.error) {
            this.loggerPort.error('AntiPatternEventStore: query read failed', err);
        }
        return '';
    });

    const lines = raw.split('\n').filter((l) => l.trim());
    const events = [];
    const keyToLatest = new Map();

    for (const line of lines) {
        try {
            const obj = JSON.parse(line);
            if (obj.ts < sinceTs) continue;
            const e = {
                ts: obj.ts,
                type: obj.type,
                label: obj.label != null ? obj.label : obj.type,
                detail: obj.detail,
                severity: obj.severity
            };
            if (dedupe) {
                const k = dedupeKey({ type: obj.type, primaryEntity: obj.primaryEntity, ruleId: obj.ruleId });
                keyToLatest.set(k, e);
            } else {
                events.push(e);
            }
        } catch (_) {
            // skip
        }
    }

    if (dedupe) {
        return Array.from(keyToLatest.values()).sort((a, b) => a.ts - b.ts);
    }
    return events.sort((a, b) => a.ts - b.ts);
};

module.exports = AntiPatternEventStore;
module.exports.DEDUPE_WINDOW_MS = DEDUPE_WINDOW_MS;
module.exports.EVENTS_DIR = EVENTS_DIR;
module.exports.EVENTS_FILE = EVENTS_FILE;
