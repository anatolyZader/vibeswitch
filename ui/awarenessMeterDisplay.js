/**
 * Awareness Meter UI Component
 * 
 * Displays awareness score in the status bar with visual meter and emoji indicators
 */

const vscode = require('vscode');

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
    if (!workspaceFolders) {
        awarenessBarItem.hide();
        return;
    }

    // Show awareness meter in both DEV and VIBE modes
    if (currentMode === 'vibe' || currentMode === 'dev') {
        // DEV mode: Show real-time awareness score
        let scoreData;
        try {
            scoreData = awarenessEngine.getScore();
        } catch (error) {
            if (outputChannel) {
                outputChannel.appendLine(`ERROR getting score from awareness monitor: ${error.message}`);
            }
            awarenessBarItem.text = '$(graph) ERR';
            awarenessBarItem.tooltip = `Awareness meter error: ${error.message}`;
            awarenessBarItem.show();
            return;
        }
        
        if (!scoreData) {
            awarenessBarItem.text = '$(graph) --';
            awarenessBarItem.tooltip = 'Awareness meter: No data available';
            awarenessBarItem.show();
            return;
        }
        
        const score = scoreData.total || 0;
        
        // Handle "no data" state (no AI suggestions detected yet)
        // Check if we have ANY suggestions (including pending) to show activity
        const hasAnySuggestions = scoreData.suggestions.total > 0;
        const hasRecentActivity = scoreData.debug.recentWindowCount > 0;
        const unreviewedCompact = getUnreviewedFilesForDisplay(scoreData);
        const hasReviewDebt = unreviewedCompact.count > 0;
        
        // NOTE: ScoreService uses 0 to represent "no activity" (not -1).
        // If we have no tracked suggestions and no debt, show a neutral state instead of 🟢 0/100.
        if (!hasAnySuggestions && !hasReviewDebt) {
            // Truly no activity - no suggestions and no debt
            awarenessBarItem.text = `⚪ No Activity`;
            awarenessBarItem.tooltip = `${currentMode.toUpperCase()} Mode Awareness: Waiting for AI activity...

No AI suggestions detected yet.
The meter will update once AI generates code.

Monitoring: ${scoreData.debug.monitoringActive ? '✅ Active' : '❌ Inactive'}
Last Activity: ${scoreData.debug.lastActivity}
Total Tracked: ${scoreData.debug.totalTrackedCount}
Recent (10s): ${scoreData.debug.recentWindowCount}

Click for detailed statistics`;
            awarenessBarItem.backgroundColor = undefined;
        } else if (!hasRecentActivity && hasReviewDebt) {
            // No recent activity (10s window), but there's review debt - show debt indicator
            const debtScore = scoreData.components.debt;
            const { unopened: unopenedCompact, unreviewedSuggestions: unreviewedCompactSuggestions } = getUnopenedAndUnreviewedForDisplay(scoreData);
            // Use the total score (already normalized/combined by ScoreService) so the meter
            // doesn't "snap back" to green while debt/pending reviews are still outstanding.
            let displayScore = scoreData.total || 0;
            displayScore = Math.max(0, Math.min(100, displayScore));
            const meter = getScoreMeter(displayScore);
            const emoji = getScoreEmoji(displayScore);
            const mergedFiles = getUnreviewedFilesForDisplay(scoreData);

            awarenessBarItem.text = `${emoji} ${meter} (${mergedFiles.count})`;
            const filesList = mergedFiles.files.slice(0, 10).map(f => `• ${f.path || f.fullPath} (${(f.ageMinutes || 0) < 60 ? `${f.ageMinutes || 0}m ago` : `${Math.round((f.ageMinutes || 0) / 60)}h ago`})`).join('\n');
            const moreLine = mergedFiles.count > 10 ? `\n... and ${mergedFiles.count - 10} more` : '';
            awarenessBarItem.tooltip = `${currentMode.toUpperCase()} Mode Awareness: Review Debt Detected

📁 Unopened files: ${unopenedCompact.count}  ⏳ Unreviewed suggestions: ${unreviewedCompactSuggestions.count}

Recent Activity: None (last 10 seconds)
Total Risk Score: ${displayScore}/100
Review Debt Score: ${debtScore}/30

${filesList}${moreLine}

Click for detailed statistics`;
            // Only show error background when score reaches critical red level (80+)
            // Red bulb + background = critically low awareness
            if (displayScore >= 80) {
                awarenessBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            } else {
                awarenessBarItem.backgroundColor = undefined;
            }
        } else {
            // Show meter (real-time awareness score)
            let displayScore = score;
            
            // Ensure displayScore is valid (0-100)
            displayScore = Math.max(0, Math.min(100, displayScore));
            
            const meter = getScoreMeter(displayScore);
            const emoji = getScoreEmoji(displayScore);
            
            awarenessBarItem.text = `${emoji} ${meter}`;
            
            // Build tooltip with component breakdown
            // Note: score is RiskScore (0-100, higher = worse)
            // Review and Adaptation are "good" scores (higher = better)
            // Blind Acceptance and Debt are "risk" scores (higher = worse)
            const scoreDisplay = `${score}/100`;
            
            // Calculate risk components for display (show both "good" and "risk" for clarity)
            const reviewRisk = 40 - scoreData.components.review;
            const reviewRisk01 = Math.max(0, Math.min(1, reviewRisk / 40));
            const adaptationRisk = 30 - scoreData.components.adaptation;
            const adaptationRisk01 = Math.max(0, Math.min(1, adaptationRisk / 30));
            const blindAcceptanceRisk01 = Math.max(0, Math.min(1, scoreData.components.blindAcceptance / 30));
            const debtRisk01 = Math.max(0, Math.min(1, scoreData.components.debt / 30));
            
            // Calculate weighted contributions to final score (makes tuning easier)
            const RISK_WEIGHTS = { review: 0.30, blindAcceptance: 0.30, adaptation: 0.20, debt: 0.20 };
            const reviewContribution = Math.round(RISK_WEIGHTS.review * reviewRisk01 * 100);
            const blindAcceptanceContribution = Math.round(RISK_WEIGHTS.blindAcceptance * blindAcceptanceRisk01 * 100);
            const adaptationContribution = Math.round(RISK_WEIGHTS.adaptation * adaptationRisk01 * 100);
            const debtContribution = Math.round(RISK_WEIGHTS.debt * debtRisk01 * 100);
            
            let tooltip = `${currentMode.toUpperCase()} Mode Risk Score: ${scoreDisplay} (higher = worse)

Component Breakdown (with contributions):
Review Quality: ${scoreData.components.review}/40 (higher = better)
  → Review Risk: ${reviewRisk}/40 → contributes ${reviewContribution} points (${RISK_WEIGHTS.review * 100}% weight)
Blind Acceptance Risk: ${scoreData.components.blindAcceptance}/30 (higher = worse)
  → contributes ${blindAcceptanceContribution} points (${RISK_WEIGHTS.blindAcceptance * 100}% weight)
Adaptation Quality: ${scoreData.components.adaptation}/30 (higher = better)
  → Adaptation Risk: ${adaptationRisk}/30 → contributes ${adaptationContribution} points (${RISK_WEIGHTS.adaptation * 100}% weight)
Debt Risk: ${scoreData.components.debt}/30 (higher = worse)
  → contributes ${debtContribution} points (${RISK_WEIGHTS.debt * 100}% weight)

Suggestions tracked: ${scoreData.suggestions.total}
✅ Accepted: ${scoreData.suggestions.accepted}
✏️  Adapted: ${scoreData.suggestions.adapted}
❌ Rejected: ${scoreData.suggestions.rejected}
⏳ Pending: ${scoreData.suggestions.pending}`;

            // Add two measures: unopened files and unreviewed suggestions
            const { unopened: unopenedTip, unreviewedSuggestions: unreviewedTip } = getUnopenedAndUnreviewedForDisplay(scoreData);
            if (unopenedTip.count > 0 || unreviewedTip.count > 0) {
                tooltip += `\n\n📁 Unopened files: ${unopenedTip.count}  ⏳ Unreviewed suggestions: ${unreviewedTip.count}`;
                if (unopenedTip.count > 0) {
                    tooltip += `\n  Unopened (open file to start review):`;
                    unopenedTip.files.slice(0, 5).forEach(file => {
                        const timeStr = (file.ageMinutes || 0) < 60 ? `${file.ageMinutes || 0}m ago` : `${Math.round((file.ageMinutes || 0) / 60)}h ago`;
                        tooltip += `\n    • ${file.path || file.fullPath} (${timeStr})`;
                    });
                    if (unopenedTip.count > 5) tooltip += `\n    ... and ${unopenedTip.count - 5} more`;
                }
                if (unreviewedTip.count > 0) {
                    tooltip += `\n  Unreviewed suggestions (pending):`;
                    unreviewedTip.files.slice(0, 5).forEach(file => {
                        const timeStr = (file.ageMinutes || 0) < 60 ? `${file.ageMinutes || 0}m ago` : `${Math.round((file.ageMinutes || 0) / 60)}h ago`;
                        tooltip += `\n    • ${file.path || file.fullPath} (${timeStr})`;
                    });
                    if (unreviewedTip.count > 5) tooltip += `\n    ... and ${unreviewedTip.count - 5} more`;
                }
                tooltip += `\n\n⚠️  Open files and engage (scroll/cursor) to clear debt!`;
            } else {
                tooltip += `\n\n✅ No unreviewed files - great job!`;
            }

            tooltip += `\n\nLast Activity: ${scoreData.debug.lastActivity}
Monitoring: ${scoreData.debug.monitoringActive ? '✅ Active' : '❌ Inactive'}`;
            
            awarenessBarItem.tooltip = tooltip;
            
            // Only show error background when score reaches critical red level (80+)
            // Red bulb + background = critically low awareness
            if (displayScore >= 80) {
                awarenessBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            } else {
                awarenessBarItem.backgroundColor = undefined;
            }
        }
    } else {
        // No mode set
        awarenessBarItem.text = '$(graph)';
        awarenessBarItem.tooltip = 'Mode not set';
        awarenessBarItem.backgroundColor = undefined;
    }

    // Show awareness meter in both DEV and VIBE modes
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const shouldShow = (currentMode === 'dev' || currentMode === 'vibe') && config.get('showInStatusBar', true); // Default to true
    
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
