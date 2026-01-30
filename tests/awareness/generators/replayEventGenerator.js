/**
 * Generates full replay event streams: random (seeded) and regime-based.
 */

const { generateSuggestionCreated, generateStatusChange, generateTick, createSeededRandom } = require('./suggestionEventGenerator');

function generateRandomReplay(opts) {
    opts = opts || {};
    const eventCount = opts.eventCount || 200;
    const seed = opts.seed !== undefined ? opts.seed : 12345;
    const random = createSeededRandom(seed);
    const events = [];
    let t = opts.startTime !== undefined ? opts.startTime : 1000000;
    const createCount = Math.max(10, Math.floor(eventCount / 3));

    for (let i = 0; i < createCount; i++) {
        if (random() < 0.1) {
            events.push(generateTick(5000));
            t += 5000;
        }
        events.push(generateSuggestionCreated({
            document: 'file:///f' + (i % 8) + '.js',
            size: 50 + Math.floor(random() * 200),
            timestamp: t,
            provenanceScore: 0.6 + random() * 0.4
        }));
        t += 500 + Math.floor(random() * 2000);
        const sid = 'suggestion-' + (i + 1);
        const r = random();
        if (r < 0.35) {
            if (random() < 0.5) events.push({ type: 'suggestion_reviewed', suggestionId: sid, reviewTime: 6000 });
            events.push(generateStatusChange(sid, 'accepted'));
        } else if (r < 0.55) {
            events.push(generateStatusChange(sid, 'rejected'));
        } else if (r < 0.7) {
            events.push({ type: 'suggestion_reviewed', suggestionId: sid, reviewTime: 4000 });
            events.push(generateStatusChange(sid, 'adapted'));
        }
    }
    return events;
}

function generateRegimeScenarios(opts) {
    opts = opts || {};
    const baseTime = opts.startTime !== undefined ? opts.startTime : 1000000;
    const count = opts.count !== undefined ? opts.count : 50;

    function mkCreates(n) {
        const events = [];
        for (let i = 0; i < n; i++) {
            events.push(generateSuggestionCreated({
                document: 'file:///f' + (i % 5) + '.js',
                size: 100 + i * 5,
                timestamp: baseTime + i * 1000,
                provenanceScore: 0.8
            }));
        }
        return events;
    }

    const blind_only = (function () {
        const events = mkCreates(count);
        for (let i = 0; i < count; i++) events.push(generateStatusChange('suggestion-' + (i + 1), 'accepted'));
        return events;
    })();

    const careful_only = (function () {
        const events = mkCreates(count);
        for (let i = 0; i < count; i++) {
            events.push({ type: 'suggestion_reviewed', suggestionId: 'suggestion-' + (i + 1), reviewTime: 6000 });
            events.push(generateStatusChange('suggestion-' + (i + 1), 'accepted'));
        }
        return events;
    })();

    const adapted_only = (function () {
        const events = mkCreates(count);
        for (let i = 0; i < count; i++) {
            events.push({ type: 'suggestion_reviewed', suggestionId: 'suggestion-' + (i + 1), reviewTime: 4000 });
            events.push(generateStatusChange('suggestion-' + (i + 1), 'adapted'));
        }
        return events;
    })();

    const pending_only = mkCreates(count);

    const mixed = (function () {
        const events = mkCreates(count);
        const third = Math.floor(count / 3);
        for (let i = 0; i < third; i++) events.push(generateStatusChange('suggestion-' + (i + 1), 'accepted'));
        for (let i = third; i < 2 * third; i++) {
            events.push({ type: 'suggestion_reviewed', suggestionId: 'suggestion-' + (i + 1), reviewTime: 6000 });
            events.push(generateStatusChange('suggestion-' + (i + 1), 'accepted'));
        }
        for (let i = 2 * third; i < count; i++) events.push(generateStatusChange('suggestion-' + (i + 1), 'rejected'));
        return events;
    })();

    return { blind_only, careful_only, adapted_only, pending_only, mixed };
}

module.exports = { generateRandomReplay, generateRegimeScenarios };
