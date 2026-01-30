'use strict';

const path = require('path');
const fs = require('fs');
const ScoreService = require('../../../business_modules/awareness/app/scoring/scoreService');
const DebtService = require('../../../business_modules/awareness/app/debt/debtService');
const SuggestionAggregate = require('../../../business_modules/awareness/domain/aggregates/suggestionAggregate');
const ReplayRunner = require('../../helpers/replayRunner');

const RECORDINGS_DIR = path.join(__dirname);

function createServices() {
    const mockLogger = { debug: jest.fn(), log: jest.fn(), error: jest.fn() };
    let idCounter = 0;
    const mockIdGenerator = { generateUUID: jest.fn(() => 'u-' + (++idCounter)), generateId: jest.fn(() => 'i-' + (++idCounter)) };
    const mockPersistence = { loadSync: jest.fn(() => new Map()), save: jest.fn(() => Promise.resolve()) };
    const scoreService = new ScoreService(mockLogger);
    const debtService = new DebtService(() => {}, null, mockPersistence, mockLogger);
    const suggestionAggregate = new SuggestionAggregate(mockIdGenerator, mockLogger);
    return { scoreService, debtService, suggestionAggregate };
}

function getTraceFiles() {
    if (!fs.existsSync(RECORDINGS_DIR)) return [];
    return fs.readdirSync(RECORDINGS_DIR)
        .filter((f) => f.endsWith('.trace.json'))
        .map((f) => path.join(RECORDINGS_DIR, f));
}

describe('Replay recordings', () => {
    const traceFiles = getTraceFiles();
    const baseTs = 1000000;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(baseTs);
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    test.each(traceFiles.length ? traceFiles.map((p) => [path.basename(p), p]) : [['sample.trace.json', path.join(RECORDINGS_DIR, 'sample.trace.json')]])('%s replays and yields score in [0,100] and no NaN', (name, filePath) => {
        if (!fs.existsSync(filePath)) return;
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const events = Array.isArray(raw.events) ? raw.events : [];
        const services = createServices();
        const runner = new ReplayRunner(services.scoreService, services.debtService, services.suggestionAggregate);
        const setSystemTime = (ts) => jest.setSystemTime(ts);
        runner.replay(events, null, { setSystemTime });
        const suggestions = services.suggestionAggregate.getSuggestions();
        const result = services.scoreService.calculateScore({
            suggestions,
            debtService: services.debtService
        });
        expect(result.currentScore).toBeGreaterThanOrEqual(0);
        expect(result.currentScore).toBeLessThanOrEqual(100);
        expect(Number.isFinite(result.currentScore)).toBe(true);
        expect(Number.isFinite(result.scores.review)).toBe(true);
        expect(Number.isFinite(result.scores.blindAcceptance)).toBe(true);
        expect(Number.isFinite(result.scores.adaptation)).toBe(true);
        expect(Number.isFinite(result.scores.debt)).toBe(true);
    });
});
