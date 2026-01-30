'use strict';

function generateSuggestionCreated(opts) {
    opts = opts || {};
    const now = opts.timestamp !== undefined ? opts.timestamp : Date.now();
    return {
        type: 'suggestion_created',
        timestamp: now,
        document: opts.document || 'file:///test.js',
        size: opts.size || 100,
        provenanceScore: opts.provenanceScore !== undefined ? opts.provenanceScore : 0.8,
        range: opts.range || { start: { line: 0, character: 0 }, end: { line: 1, character: 10 } },
        text: opts.text || 'test code'
    };
}

function generateStatusChange(suggestionId, status) {
    return { type: 'suggestion_status_changed', suggestionId, status };
}

function generateTick(advanceMs) {
    return { type: 'tick', advanceMs };
}

function createSeededRandom(seed) {
    let s = seed;
    return function next() {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

function generateBulkScenario(opts) {
    opts = opts || {};
    const count = opts.count || 100;
    const acceptedRatio = opts.acceptedRatio !== undefined ? opts.acceptedRatio : 0.3;
    const rejectedRatio = opts.rejectedRatio !== undefined ? opts.rejectedRatio : 0.2;
    const adaptedRatio = opts.adaptedRatio !== undefined ? opts.adaptedRatio : 0.1;
    const timeSpreadMs = opts.timeSpreadMs || 1000;
    const seed = opts.seed !== undefined ? opts.seed : 42;
    const random = createSeededRandom(seed);
    const events = [];
    let t = opts.startTime !== undefined ? opts.startTime : Date.now();

    for (let i = 0; i < count; i++) {
        const doc = 'file:///f' + (i % 5) + '.js';
        events.push(generateSuggestionCreated({ document: doc, size: 100 + (i % 50) * 10, timestamp: t, provenanceScore: 0.7 + random() * 0.2 }));
        t += timeSpreadMs;
        const r = random();
        let status;
        if (r < acceptedRatio) status = 'accepted';
        else if (r < acceptedRatio + rejectedRatio) status = 'rejected';
        else if (r < acceptedRatio + rejectedRatio + adaptedRatio) status = 'adapted';
        else status = 'pending';
        const suggestionId = 'suggestion-' + (i + 1);
        if (status === 'accepted') {
            if (random() < 0.5) events.push({ type: 'suggestion_reviewed', suggestionId, reviewTime: 6000 });
            events.push(generateStatusChange(suggestionId, 'accepted'));
        } else if (status === 'rejected') {
            events.push(generateStatusChange(suggestionId, 'rejected'));
        } else if (status === 'adapted') {
            events.push({ type: 'suggestion_reviewed', suggestionId, reviewTime: 4000 });
            events.push(generateStatusChange(suggestionId, 'adapted'));
        }
    }
    return events;
}

module.exports = {
    generateSuggestionCreated,
    generateStatusChange,
    generateTick,
    createSeededRandom,
    generateBulkScenario
};
