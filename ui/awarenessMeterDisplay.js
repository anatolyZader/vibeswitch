/**
 * Awareness Meter UI Component
 * 
 * Displays awareness score in the status bar with visual meter and emoji indicators
 */

const vscode = require('vscode');
const { flashCyanIfHighScore } = require('./frameFlash');
const { getCircleState } = require('./dashboardContent');

/**
 * Helper function: Generates a visual meter bar representation of the awareness score
 * 
 * Creates a 7-segment bar where filled segments (▰) represent the score percentage
 * Empty segments (▱) represent remaining capacity
 * 
 * @param {number} score - Awareness score (0-100)
 * @returns {string} Visual meter string (e.g., "▰▰▰▱▱▱▱")
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
 * Normalize a component score to the 0-100 range.
 * Components like debt are naturally 0-30; the meter/emoji thresholds assume 0-100.
 *
 * @param {number} value - Component value (e.g., 0-30)
 * @param {number} max - Component max (e.g., 30)
 * @returns {number} Normalized score (0-100)
 */
function normalizeTo100(value, max) {
    const safeMax = (typeof max === 'number' && max > 0) ? max : 1;
    const safeValue = (typeof value === 'number' && Number.isFinite(value)) ? value : 0;
    const normalized = Math.round((safeValue / safeMax) * 100);
    return Math.max(0, Math.min(100, normalized));
}

/**
 * Helper function: Returns an emoji indicator based on risk score
 * 
 * Score is now unified as RiskScore (0-100, higher = worse):
 * - Low risk (0-39) = 🟢 GOOD (careful, skeptical, thorough review)
 * - Medium risk (40-59) = 🟡 CAUTION (moderate engagement)
 * - High risk (60-79) = 🟠 WARNING (too trusting, not selective enough)
 * - Very high risk (80-100) = 🔴 DANGER (blind acceptance, no review)
 * 
 * @param {number} score - Risk score (0-100, higher = worse)
 * @returns {string} Emoji indicator (🟢/🟡/🟠/🔴)
 */
function getScoreEmoji(score) {
    // Risk score: LOW = GOOD (careful), HIGH = BAD (blind acceptance)
    if (score >= 80) return '🔴'; // Danger! High risk
    if (score >= 60) return '🟠'; // Warning: Elevated risk
    if (score >= 40) return '🟡'; // Caution: Moderate risk
    return '🟢'; // Good: Low risk
}

/**
 * Two measures: unopened files (debt files user hasn't opened) and unreviewed suggestions (pending).
 * Uses scoreData.unopenedFiles and scoreData.unreviewedSuggestions when present (from engine); otherwise falls back to debt + suggestions.
 * @param {Object} scoreData - Result of awarenessEngine.getScore()
 * @returns {{ unopened: { count: number, files: Array }, unreviewedSuggestions: { count: number, files: Array } }}
 */
function getUnopenedAndUnreviewedForDisplay(scoreData) {
    const unopened = (scoreData && scoreData.unopenedFiles) ? scoreData.unopenedFiles : { count: 0, files: [] };
    const unreviewedSuggestions = (scoreData && scoreData.unreviewedSuggestions) ? scoreData.unreviewedSuggestions : { count: 0, files: [] };
    // Fallback when engine didn't add the split (e.g. older code path)
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
 * Build merged list of unreviewed files (backward compat): unopened files + files with unreviewed (pending) suggestions.
 * Dedupes by fullPath. Use getUnopenedAndUnreviewedForDisplay for the two-measure split.
 * @param {Object} scoreData - Result of awarenessEngine.getScore()
 * @returns {{ count: number, files: Array<{ path: string, fullPath: string, ageMinutes: number }> }}
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
 * Map domain state (score data) to view model for status bar / tooltip.
 * Contract: same input always produces same output; tests snapshot this.
 * @param {Object} scoreData - Result of awarenessEngine.getScore()
 * @param {string|null} currentMode - 'dev', 'vibe', or null
 * @returns {Object} { segments, emoji, label, tooltipLines, warning, confidence }
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

/**
 * Updates the awareness meter status bar item with current awareness score and metrics
 * 
 * @param {vscode.StatusBarItem} awarenessBarItem - The awareness meter status bar item
 * @param {Object} awarenessEngine - The awareness engine instance
 * @param {string|null} currentMode - Current mode ('vibe', 'dev', or null)
 * @param {vscode.OutputChannel} outputChannel - Optional output channel for logging
 */
function updateAwarenessMeter(awarenessBarItem, awarenessEngine, currentMode, outputChannel = null) {
    if (!awarenessBarItem) {
        if (outputChannel) {
            outputChannel.appendLine('WARNING: awarenessBarItem not initialized');
        }
        return;
    }
    
    if (!awarenessEngine) {
        if (currentMode === 'dev' || currentMode === 'vibe') {
            awarenessBarItem.text = '$(graph) --';
            awarenessBarItem.tooltip = 'Awareness meter: Initializing...';
            awarenessBarItem.show();
        } else {
            awarenessBarItem.hide();
        }
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    // Always show report button - it works even without a workspace (shows "no data" state)
    // Show colored circle in both DEV and VIBE modes (click opens dashboard, hover shows schematic)
    if (currentMode === 'vibe' || currentMode === 'dev') {
        let scoreData;
        let scoreBreakdown = null;
        let antipatternBreakdown = null;
        try {
            scoreData = awarenessEngine.getScore();
            if (awarenessEngine.getScoreBreakdown) {
                scoreBreakdown = awarenessEngine.getScoreBreakdown();
            }
            if (awarenessEngine.getAntipatternBreakdown) {
                antipatternBreakdown = awarenessEngine.getAntipatternBreakdown();
            }
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine(`ERROR getting score from awareness monitor: ${error.message}`);
            }
            awarenessBarItem.text = 'REPORT';
            awarenessBarItem.tooltip = `Awareness error: ${error.message}. Click to open dashboard.`;
            awarenessBarItem.backgroundColor = undefined;
            awarenessBarItem.show();
            return;
        }

        if (!scoreData) {
            awarenessBarItem.text = 'REPORT';
            awarenessBarItem.tooltip = 'No data. Click to open dashboard.';
            awarenessBarItem.backgroundColor = undefined;
            awarenessBarItem.show();
            return;
        }

        const score = scoreData.total || 0;
        try {
            flashCyanIfHighScore(score);
        } catch (_) {}

        const circle = getCircleState(scoreData, scoreBreakdown, currentMode, antipatternBreakdown);
        awarenessBarItem.text = circle.text;
        awarenessBarItem.tooltip = circle.tooltip;
        if (circle.backgroundColor === null) {
            awarenessBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else {
            awarenessBarItem.backgroundColor = circle.backgroundColor;
        }
    } else {
        // Even without mode, show report button with basic info
        awarenessBarItem.text = 'REPORT';
        awarenessBarItem.tooltip = 'VibeSwitch: Click to open dashboard';
        awarenessBarItem.backgroundColor = undefined;
    }

    // Always show report button (unless explicitly disabled by config)
    // Report button provides value even without active mode - shows dashboard with available data
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const shouldShow = config.get('showInStatusBar', true); // Default to true
    
    if (shouldShow) {
        awarenessBarItem.show();
    } else {
        awarenessBarItem.hide();
    }
}

module.exports = {
    updateAwarenessMeter,
    getScoreMeter,
    getScoreEmoji,
    mapDomainStateToViewModel,
    normalizeTo100,
    getUnreviewedFilesForDisplay,
    getUnopenedAndUnreviewedForDisplay
};
