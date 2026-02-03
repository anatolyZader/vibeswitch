const { getScoreMeter, getScoreEmoji, updateAwarenessMeter, mapDomainStateToViewModel } = require('../../ui/awarenessMeterDisplay');
const vscode = require('vscode');

describe('getScoreMeter', () => {
    test('score 0 returns all empty segments', () => {
        expect(getScoreMeter(0)).toBe('\u25B1'.repeat(7));
    });
    test('score 100 returns all filled segments', () => {
        expect(getScoreMeter(100)).toBe('\u25B0'.repeat(7));
    });
    test('score 50 returns 4 segments', () => {
        const m = getScoreMeter(50);
        expect(m.length).toBe(7);
        expect(m.slice(0, 4)).toBe('\u25B0\u25B0\u25B0\u25B0');
    });
});

describe('getScoreEmoji', () => {
    test('0-39 returns green', () => {
        expect(getScoreEmoji(0)).toBe('\uD83D\uDFE2');
        expect(getScoreEmoji(39)).toBe('\uD83D\uDFE2');
    });
    test('40-59 returns yellow', () => {
        expect(getScoreEmoji(40)).toBe('\uD83D\uDFE1');
        expect(getScoreEmoji(59)).toBe('\uD83D\uDFE1');
    });
    test('60-79 returns orange', () => {
        expect(getScoreEmoji(60)).toBe('\uD83D\uDFE0');
        expect(getScoreEmoji(79)).toBe('\uD83D\uDFE0');
    });
    test('80-100 returns red', () => {
        expect(getScoreEmoji(80)).toBe('\uD83D\uDD34');
        expect(getScoreEmoji(100)).toBe('\uD83D\uDD34');
    });
});

describe('updateAwarenessMeter mocked', () => {
    let barItem;
    let mockEngine;
    beforeEach(() => {
        barItem = { text: '', tooltip: '', backgroundColor: undefined, show: jest.fn(), hide: jest.fn() };
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/test' } }];
        vscode.workspace.getConfiguration = jest.fn(() => ({ get: jest.fn((k, d) => (k === 'showInStatusBar' ? true : d)) }));
    });
    test('with engine returning scoreData sets text to colored circle (no emoji/meter in bar)', () => {
        mockEngine = {
            getScore: jest.fn(() => ({
                total: 25,
                components: { review: 20, blindAcceptance: 5, adaptation: 10, debt: 0 },
                suggestions: { total: 5, pendingFiles: [] },
                debt: { unreviewedFiles: 0, files: [] },
                unopenedFiles: { count: 0, files: [] },
                unreviewedSuggestions: { count: 0, files: [] },
                debug: { recentWindowCount: 3, monitoringActive: true, lastActivity: 'now', totalTrackedCount: 5 }
            })),
            getScoreBreakdown: jest.fn(() => ({})),
            getAntipatternBreakdown: jest.fn(() => ({}))
        };
        updateAwarenessMeter(barItem, mockEngine, 'dev');
        expect(barItem.text).toBe('REPORT');
        expect(barItem.tooltip).toMatch(/Risk: 25\/100/);
    });
    test('tooltip contains mode and score', () => {
        mockEngine = {
            getScore: jest.fn(() => ({
                total: 50,
                components: { review: 15, blindAcceptance: 10, adaptation: 10, debt: 5 },
                suggestions: { total: 5, pendingFiles: [] },
                debt: { unreviewedFiles: 0, files: [] },
                unopenedFiles: { count: 0, files: [] },
                unreviewedSuggestions: { count: 0, files: [] },
                debug: { recentWindowCount: 3, monitoringActive: true, lastActivity: 'now', totalTrackedCount: 5 }
            })),
            getScoreBreakdown: jest.fn(() => ({})),
            getAntipatternBreakdown: jest.fn(() => ({}))
        };
        updateAwarenessMeter(barItem, mockEngine, 'dev');
        expect(barItem.tooltip).toContain('DEV');
        expect(barItem.tooltip).toMatch(/\d+\/100/);
    });
});

describe('mapDomainStateToViewModel contract', () => {
    test('null scoreData returns no-data view model', () => {
        const vm = mapDomainStateToViewModel(null, 'dev');
        expect(vm.segments).toBe('');
        expect(vm.emoji).toBe('\u26AA');
        expect(vm.label).toBe('--');
        expect(Array.isArray(vm.tooltipLines)).toBe(true);
        expect(vm.tooltipLines[0]).toContain('No data');
        expect(vm.warning).toBe(true);
        expect(vm.confidence).toBe('none');
    });

    test('no activity (no suggestions, no debt) returns No Activity', () => {
        const scoreData = {
            total: 0,
            components: { review: 0, blindAcceptance: 0, adaptation: 0, debt: 0 },
            suggestions: { total: 0, pending: 0 },
            debt: { unreviewedFiles: 0, files: [] },
            debug: { recentWindowCount: 0, monitoringActive: true }
        };
        const vm = mapDomainStateToViewModel(scoreData, 'dev');
        expect(vm.label).toBe('No Activity');
        expect(vm.confidence).toBe('none');
    });

    test('low risk score produces 7-segment meter and green emoji', () => {
        const scoreData = {
            total: 25,
            components: { review: 25, blindAcceptance: 5, adaptation: 15, debt: 0 },
            suggestions: { total: 5, pending: 0 },
            debt: { unreviewedFiles: 0, files: [] },
            debug: { recentWindowCount: 3, monitoringActive: true }
        };
        const vm = mapDomainStateToViewModel(scoreData, 'dev');
        expect(vm.segments.length).toBe(7);
        expect((vm.segments.match(/\u25B0/g) || []).length).toBeLessThanOrEqual(2);
        expect(vm.emoji).toBe('\uD83D\uDFE2');
        expect(vm.tooltipLines.some((l) => l.includes('25/100'))).toBe(true);
        expect(vm.warning).toBe(false);
    });

    test('high risk score produces warning and red emoji', () => {
        const scoreData = {
            total: 85,
            components: { review: 5, blindAcceptance: 28, adaptation: 5, debt: 25 },
            suggestions: { total: 10, pending: 2 },
            debt: { unreviewedFiles: 1, files: [] },
            debug: { recentWindowCount: 5, monitoringActive: true }
        };
        const vm = mapDomainStateToViewModel(scoreData, 'dev');
        expect(vm.segments.length).toBe(7);
        expect(vm.emoji).toBe('\uD83D\uDD34');
        expect(vm.warning).toBe(true);
        expect(vm.tooltipLines.some((l) => l.includes('85/100'))).toBe(true);
    });

    test('debt-only (no recent activity) includes unreviewed count in label and tooltip', () => {
        const scoreData = {
            total: 40,
            components: { review: 0, blindAcceptance: 0, adaptation: 0, debt: 15 },
            suggestions: { total: 0, pending: 0 },
            debt: { unreviewedFiles: 3, files: [{ path: 'x.js', fullPath: '/x.js', ageMinutes: 5 }] },
            unopenedFiles: { count: 1, files: [{ path: 'x.js', fullPath: '/x.js', ageMinutes: 5 }] },
            unreviewedSuggestions: { count: 0, files: [] },
            debug: { recentWindowCount: 0, monitoringActive: true }
        };
        const vm = mapDomainStateToViewModel(scoreData, 'dev');
        expect(vm.label).toMatch(/\d+/);
        expect(vm.tooltipLines.some((l) => l.includes('unreviewed') || l.includes('Unopened'))).toBe(true);
    });
});
