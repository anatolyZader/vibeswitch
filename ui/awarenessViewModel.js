/**
 * Pure view-model helpers for awareness score data.
 * Used by commands and dashboard; status bar uses reportButtonDisplay.js only.
 * No status bar item or VS Code API here.
 */

/**
 * Generates a 7-segment bar for score (0-100).
 * @param {number} score - Awareness score (0-100)
 * @returns {string} e.g. "▰▰▰▱▱▱▱"
 */
function getScoreMeter(score) {
    const segments = 7;
    const filled = Math.round((score / 100) * segments);
    let meter = '';
    for (let i = 0; i < segments; i++) {
        meter += (i < filled) ? '▰' : '▱';
    }
    return meter;
}

/**
 * Normalize component score to 0-100. Components like debt are 0-30.
 * @param {number} value - Component value
 * @param {number} max - Component max
 * @returns {number} 0-100
 */
function normalizeTo100(value, max) {
    const safeMax = (typeof max === 'number' && max > 0) ? max : 1;
    const safeValue = (typeof value === 'number' && Number.isFinite(value)) ? value : 0;
    const normalized = Math.round((safeValue / safeMax) * 100);
    return Math.max(0, Math.min(100, normalized));
}

/**
 * Emoji for risk score (0-100, higher = worse): 🟢/🟡/🟠/🔴
 * @param {number} score - Risk score (0-100)
 * @returns {string}
 */
function getScoreEmoji(score) {
    if (score >= 80) return '🔴';
    if (score >= 60) return '🟠';
    if (score >= 40) return '🟡';
    return '🟢';
}

/**
 * Unopened vs unreviewed split from score data.
 * @param {Object} scoreData - awarenessEngine.getScore()
 * @returns {{ unopened: { count, files }, unreviewedSuggestions: { count, files } }}
 */
function getUnopenedAndUnreviewedForDisplay(scoreData) {
    const unopened = (scoreData && scoreData.unopenedFiles) ? scoreData.unopenedFiles : { count: 0, files: [] };
    const unreviewedSuggestions = (scoreData && scoreData.unreviewedSuggestions) ? scoreData.unreviewedSuggestions : { count: 0, files: [] };
    if (unopened.count === 0 && unreviewedSuggestions.count === 0 && scoreData && scoreData.debt) {
        const debtFiles = scoreData.debt.files || [];
        const pendingFiles = (scoreData.suggestions && scoreData.suggestions.pendingFiles) ? scoreData.suggestions.pendingFiles : [];
        const pendingCount = (scoreData.suggestions && scoreData.suggestions.pending) != null ? scoreData.suggestions.pending : pendingFiles.length;
        return {
            unopened: { count: debtFiles.length, files: debtFiles.map(f => ({ path: f.path || f.fullPath, fullPath: f.fullPath || f.path, ageMinutes: f.ageMinutes || 0 })) },
            unreviewedSuggestions: { count: pendingCount, files: pendingFiles }
        };
    }
    return {
        unopened: { count: unopened.count || 0, files: unopened.files || [] },
        unreviewedSuggestions: { count: unreviewedSuggestions.count || 0, files: unreviewedSuggestions.files || [] }
    };
}

/**
 * Merged unreviewed files list (unopened + pending), deduped by fullPath.
 * @param {Object} scoreData - awarenessEngine.getScore()
 * @returns {{ count: number, files: Array }}
 */
function getUnreviewedFilesForDisplay(scoreData) {
    const { unopened, unreviewedSuggestions } = getUnopenedAndUnreviewedForDisplay(scoreData);
    const byPath = new Map();
    for (const f of unopened.files) {
        const key = (f.fullPath || f.path || '').toString();
        if (key) byPath.set(key, { path: f.path || key, fullPath: f.fullPath || key, ageMinutes: typeof f.ageMinutes === 'number' ? f.ageMinutes : 0 });
    }
    for (const f of unreviewedSuggestions.files) {
        const key = (f.fullPath || f.path || '').toString();
        if (key && !byPath.has(key)) {
            byPath.set(key, { path: f.path || key, fullPath: f.fullPath || key, ageMinutes: typeof f.ageMinutes === 'number' ? f.ageMinutes : 0 });
        }
    }
    const files = Array.from(byPath.values()).sort((a, b) => (b.ageMinutes || 0) - (a.ageMinutes || 0));
    return { count: files.length, files };
}

/**
 * Map score data to view model for commands/dashboard (segments, emoji, label, tooltipLines, warning, confidence).
 * @param {Object} scoreData - awarenessEngine.getScore()
 * @param {string|null} currentMode - 'dev', 'vibe', or null
 * @returns {Object}
 */
function mapDomainStateToViewModel(scoreData, currentMode = 'dev') {
    if (!scoreData) {
        return { segments: '', emoji: '⚪', label: '--', tooltipLines: ['No data'], warning: true, confidence: 'none' };
    }
    const score = Math.max(0, Math.min(100, scoreData.total || 0));
    const segments = getScoreMeter(score);
    const emoji = getScoreEmoji(score);
    const hasAnySuggestions = scoreData.suggestions && scoreData.suggestions.total > 0;
    const { unopened, unreviewedSuggestions } = getUnopenedAndUnreviewedForDisplay(scoreData);
    const unreviewed = getUnreviewedFilesForDisplay(scoreData);
    const hasReviewDebt = unreviewed.count > 0;
    const hasRecentActivity = scoreData.debug && scoreData.debug.recentWindowCount > 0;

    let label;
    let tooltipLines = [];
    let warning = false;
    let confidence = 'full';

    if (!hasAnySuggestions && !hasReviewDebt) {
        label = 'No Activity';
        tooltipLines = ['No AI suggestions detected yet.', 'Monitoring: ' + (scoreData.debug?.monitoringActive ? 'Active' : 'Inactive')];
        confidence = 'none';
    } else if (!hasRecentActivity && hasReviewDebt) {
        label = `${segments} (${unreviewed.count})`;
        tooltipLines = [
            `Unopened files: ${unopened.count}  Unreviewed suggestions: ${unreviewedSuggestions.count}`,
            `Risk: ${score}/100`,
            `Debt: ${scoreData.components?.debt ?? 0}/30`
        ];
        warning = score >= 80;
    } else {
        label = segments;
        tooltipLines = [
            `Risk Score: ${score}/100`,
            `Review: ${scoreData.components?.review ?? 0}/40`,
            `Blind Accept: ${scoreData.components?.blindAcceptance ?? 0}/30`,
            `Adaptation: ${scoreData.components?.adaptation ?? 0}/30`,
            `Debt: ${scoreData.components?.debt ?? 0}/30`,
            `Suggestions: ${scoreData.suggestions?.total ?? 0} (pending: ${scoreData.suggestions?.pending ?? 0})`
        ];
        warning = score >= 80;
    }

    return { segments, emoji, label, tooltipLines, warning, confidence };
}

module.exports = {
    getScoreMeter,
    getScoreEmoji,
    normalizeTo100,
    getUnopenedAndUnreviewedForDisplay,
    getUnreviewedFilesForDisplay,
    mapDomainStateToViewModel
};
