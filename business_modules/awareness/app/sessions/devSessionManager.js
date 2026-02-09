/**
 * DevSessionManager - Builds DevSession list from change ledger and suggestion aggregate.
 * Session boundaries: idle gap (default 30 min). Used for session view and detectors.
 */

const DEFAULT_IDLE_THRESHOLD_MS = 30 * 60 * 1000;

/**
 * Build DevSession list from ledger and aggregate.
 * @param {ChangeLedgerService} changeLedgerService - Ledger service (getAll or getSinceCheckpoint)
 * @param {SuggestionAggregate} suggestionAggregate - For batch timestamps and file paths (optional for timeline)
 * @param {Object} [options]
 * @param {number} [options.idleThresholdMs] - Idle gap to split sessions (default 30 min)
 * @param {number} [options.sinceTs] - Only include ledger entries with ts >= sinceTs
 * @param {boolean} [options.useGetSinceCheckpoint] - If true, use getSinceCheckpoint() instead of getAll()
 * @returns {Array<DevSession>} DevSession array, newest first
 */
function buildSessionsFromLedgerAndAggregate(changeLedgerService, suggestionAggregate, options = {}) {
    const idleThresholdMs = options.idleThresholdMs ?? DEFAULT_IDLE_THRESHOLD_MS;
    const sinceTs = options.sinceTs != null ? options.sinceTs : 0;
    const useGetSinceCheckpoint = options.useGetSinceCheckpoint === true;

    const entries = useGetSinceCheckpoint
        ? (changeLedgerService.getSinceCheckpoint && changeLedgerService.getSinceCheckpoint()) || []
        : (changeLedgerService.getAll && changeLedgerService.getAll()) || [];

    const batchEntries = entries.filter(e => e.kind === 'batch' && e.ts >= sinceTs);
    if (batchEntries.length === 0) {
        return [];
    }

    batchEntries.sort((a, b) => (a.ts || 0) - (b.ts || 0));

    const sessions = [];
    let current = {
        startTs: batchEntries[0].ts,
        endTs: batchEntries[0].ts,
        focusedFiles: new Set(),
        aiEventCount: 0,
        humanEditCount: 0,
        timeline: []
    };

    const fileFrom = (e) => (e.file && String(e.file).trim()) || (e.uri && String(e.uri).trim()) || '';

    for (const e of batchEntries) {
        const ts = e.ts || 0;
        const gap = ts - current.endTs;
        if (gap > idleThresholdMs && current.endTs >= current.startTs) {
            sessions.push(toDevSession(current));
            current = {
                startTs: ts,
                endTs: ts,
                focusedFiles: new Set(),
                aiEventCount: 0,
                humanEditCount: 0,
                timeline: []
            };
        } else {
            current.endTs = ts;
        }

        const f = fileFrom(e);
        if (f) current.focusedFiles.add(f);
        if (e.label === 'ai') {
            current.aiEventCount++;
            current.timeline.push({ ts, type: 'batch' });
        } else if (e.label === 'user') {
            current.humanEditCount++;
            current.timeline.push({ ts, type: 'edit' });
        }
    }

    sessions.push(toDevSession(current));
    return sessions.reverse();
}

/**
 * @param {Object} raw - Raw session shape
 * @returns {DevSession}
 */
function toDevSession(raw) {
    return {
        startTs: raw.startTs,
        endTs: raw.endTs,
        focusedFiles: Array.from(raw.focusedFiles || []),
        criticality: raw.criticality ?? null,
        aiEventCount: raw.aiEventCount ?? 0,
        humanEditCount: raw.humanEditCount ?? 0,
        timeline: raw.timeline || []
    };
}

function getIdleThresholdMs() {
    return DEFAULT_IDLE_THRESHOLD_MS;
}

module.exports = {
    buildSessionsFromLedgerAndAggregate,
    getIdleThresholdMs,
    DEFAULT_IDLE_THRESHOLD_MS
};
