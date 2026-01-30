/**
 * Interleave tick events to control "recent" vs "horizon" vs "dropped" in time windows.
 */

const { generateSuggestionCreated, generateTick } = require('./suggestionEventGenerator');

/**
 * Insert tick events between suggestion events so that after replay,
 * "recent" (e.g. 10s) and "horizon" (e.g. 15min) can be controlled.
 * @param {Array} events - Replay events (will be copied and mutated with timestamps)
 * @param {Object} opts
 * @param {number} opts.baseTime - Start time (ms)
 * @param {number} opts.stepMs - Ms between suggestion creates (default 1000)
 * @param {number} opts.bigGapAfterIndex - After this many events, insert a big advance (e.g. 20min) so later events are "recent" only
 * @param {number} opts.bigGapMs - Big advance ms (default 20 * 60 * 1000)
 */
function interleaveTicks(events, opts = {}) {
    const baseTime = opts.baseTime ?? Date.now();
    const stepMs = opts.stepMs ?? 1000;
    const result = [];
    let t = baseTime;

    events.forEach((ev, i) => {
        if (opts.bigGapAfterIndex != null && i === opts.bigGapAfterIndex) {
            const gap = opts.bigGapMs ?? 20 * 60 * 1000;
            result.push(generateTick(gap));
            t += gap;
        }
        if (ev.type === 'suggestion_created') {
            const withTime = { ...ev, timestamp: t };
            result.push(withTime);
            t += stepMs;
        } else {
            result.push(ev);
        }
    });

    return result;
}

/**
 * Generate a timeline that has events in "recent" window (last 10s) and events outside (older).
 * Useful for testing that score uses recent window correctly.
 */
function generateRecentVsOldScenario(opts = {}) {
    const baseTime = opts.baseTime ?? 1000000;
    const recentWindowMs = opts.recentWindowMs ?? 10000;
    const oldCount = opts.oldCount ?? 20;
    const recentCount = opts.recentCount ?? 10;
    const events = [];

    let t = baseTime;
    for (let i = 0; i < oldCount; i++) {
        events.push(generateSuggestionCreated({ document: 'file:///old.js', size: 100, timestamp: t }));
        events.push(generateTick(2000));
        t += 2000;
    }
    events.push(generateTick(recentWindowMs + 5000));
    t += recentWindowMs + 5000;
    for (let i = 0; i < recentCount; i++) {
        events.push(generateSuggestionCreated({ document: 'file:///recent.js', size: 100, timestamp: t }));
        events.push(generateTick(500));
        t += 500;
    }

    return events;
}

module.exports = {
    interleaveTicks,
    generateRecentVsOldScenario
};
