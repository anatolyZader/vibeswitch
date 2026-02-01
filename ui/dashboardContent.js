/**
 * Dashboard content builder: schematic tooltip and full dashboard markdown.
 * Shared between status bar hover popup and dashboard tab.
 * Uses existing getScore() / getScoreBreakdown() and unopened/unreviewed file data.
 */

function getUnopenedAndUnreviewed(scoreData) {
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

// Risk score (0-100) to background color for status bar circle
const RISK_TO_BG = {
    low: '#4caf50',      // green 0-39
    medium: '#ffeb3b',    // yellow 40-59
    high: '#ff9800',     // orange 60-79
    critical: null       // 80+ use ThemeColor('statusBarItem.errorBackground')
};

/**
 * Normalize component to 0-100 risk for display (higher = worse).
 * Review/adaptation are "good" (higher = better), so we invert to risk.
 */
function componentToRisk100(value, max, invert = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || typeof max !== 'number' || max <= 0) return 0;
    const normalized = Math.max(0, Math.min(max, value));
    const pct = normalized / max;
    return Math.round((invert ? (1 - pct) : pct) * 100);
}

/**
 * Returns { text, backgroundColor, tooltip } for the status bar circle.
 * text: single circle character; backgroundColor: hex or null (null = use ThemeColor in caller); tooltip: schematic string.
 * @param {Object} scoreData - Result of awarenessEngine.getScore()
 * @param {Object} [scoreBreakdown] - Result of awarenessEngine.getScoreBreakdown()
 * @param {string|null} currentMode - 'dev', 'vibe', or null
 * @param {Object} [antipatternBreakdown] - Result of awarenessEngine.getAntipatternBreakdown()
 */
function getCircleState(scoreData, scoreBreakdown, currentMode, antipatternBreakdown) {
    const noData = {
        text: '$(record)',
        backgroundColor: undefined,
        tooltip: 'VibeSwitch: No data. Click to open dashboard.'
    };

    if (!scoreData) return noData;

    const score = Math.max(0, Math.min(100, scoreData.total || 0));
    const hasAnySuggestions = scoreData.suggestions && scoreData.suggestions.total > 0;
    const { unopened, unreviewedSuggestions } = getUnopenedAndUnreviewed(scoreData);
    const hasReviewDebt = unopened.count > 0 || unreviewedSuggestions.count > 0;

    let backgroundColor;
    if (!hasAnySuggestions && !hasReviewDebt) {
        backgroundColor = undefined; // neutral / gray (no custom theme for gray, leave default)
    } else if (score >= 80) {
        backgroundColor = null; // caller uses ThemeColor('statusBarItem.errorBackground')
    } else if (score >= 60) {
        backgroundColor = RISK_TO_BG.high;
    } else if (score >= 40) {
        backgroundColor = RISK_TO_BG.medium;
    } else {
        backgroundColor = RISK_TO_BG.low;
    }

    const tooltip = buildSchematicTooltip(scoreData, scoreBreakdown, currentMode, antipatternBreakdown);

    return {
        text: '$(record)',
        backgroundColor,
        tooltip
    };
}

/**
 * Build concise schematic tooltip: risk score, one line per antipattern, then files section.
 * @param {Object} [antipatternBreakdown] - Result of awarenessEngine.getAntipatternBreakdown()
 */
function buildSchematicTooltip(scoreData, scoreBreakdown, currentMode, antipatternBreakdown) {
    const modeLabel = (currentMode || 'unknown').toUpperCase();
    const score = Math.max(0, Math.min(100, scoreData.total || 0));
    const c = scoreData.components || {};

    // Antipattern risk 0-100 (higher = worse). Review/adaptation inverted from "good" scores.
    const blindRisk = componentToRisk100(c.blindAcceptance ?? 0, 30, false);
    const debtRisk = componentToRisk100(c.debt ?? 0, 30, false);
    const reviewRisk = componentToRisk100(c.review ?? 0, 40, true);  // low review = high risk
    const overDelegationRisk = componentToRisk100(c.adaptation ?? 0, 30, true); // low adaptation = high risk

    let lines = [
        `${modeLabel} · Risk: ${score}/100`,
        '',
        'Antipatterns:',
        `  Blind Acceptance:  ${blindRisk}%`,
        `  Silent Drift:      ${debtRisk}%`,
        `  Review Engagement: ${reviewRisk}%`,
        `  Over-delegation:  ${overDelegationRisk}%`
    ];
    if (antipatternBreakdown) {
        lines.push(`  Flooding (approx): ${antipatternBreakdown.flooding?.risk0To100 ?? 0}%`);
        lines.push(`  Response drill:    ${antipatternBreakdown.responseDrill?.risk0To100 ?? 0}%`);
        lines.push(`  Context spread:    ${antipatternBreakdown.contextSpread?.risk0To100 ?? 0}%`);
    }

    const { unopened, unreviewedSuggestions } = getUnopenedAndUnreviewed(scoreData);
    lines.push('');
    lines.push('Files:');
    lines.push(`  Unopened (debt): ${unopened.count}   Unreviewed suggestions: ${unreviewedSuggestions.count}`);
    const topUnopened = unopened.files.slice(0, 3);
    const topUnreviewed = unreviewedSuggestions.files.slice(0, 3);
    if (topUnopened.length > 0 || topUnreviewed.length > 0) {
        topUnopened.forEach(f => {
            const age = (f.ageMinutes || 0) < 60 ? `${f.ageMinutes || 0}m` : `${Math.round((f.ageMinutes || 0) / 60)}h`;
            const name = (f.path || f.fullPath || '').split(/[/\\]/).pop() || '?';
            lines.push(`    · ${name} (${age})`);
        });
        topUnreviewed.forEach(f => {
            const age = (f.ageMinutes || 0) < 60 ? `${f.ageMinutes || 0}m` : `${Math.round((f.ageMinutes || 0) / 60)}h`;
            const name = (f.path || f.fullPath || '').split(/[/\\]/).pop() || '?';
            lines.push(`    · ${name} (${age})`);
        });
    }
    lines.push('');
    lines.push('Click to open dashboard.');

    return lines.join('\n');
}

/**
 * Build full dashboard markdown for the virtual document tab.
 * @param {Object} [antipatternBreakdown] - Result of awarenessEngine.getAntipatternBreakdown()
 */
function buildDashboardMarkdown(scoreData, scoreBreakdown, currentMode, antipatternBreakdown) {
    const modeLabel = (currentMode || 'unknown').toUpperCase();
    const score = Math.max(0, Math.min(100, scoreData.total || 0));
    const c = scoreData.components || {};

    const blindRisk = componentToRisk100(c.blindAcceptance ?? 0, 30, false);
    const debtRisk = componentToRisk100(c.debt ?? 0, 30, false);
    const reviewRisk = componentToRisk100(c.review ?? 0, 40, true);
    const overDelegationRisk = componentToRisk100(c.adaptation ?? 0, 30, true);

    const meterBar = (pct) => {
        const n = Math.round((pct / 100) * 10);
        return '▰'.repeat(n) + '▱'.repeat(10 - n);
    };

    let md = `# VibeSwitch Dashboard

**Mode:** ${modeLabel}  
**Total risk score:** ${score}/100 (higher = worse)  
**Last activity:** ${(scoreData.debug && scoreData.debug.lastActivity) || '—'}

---

## Antipattern meters

| Antipattern | Risk | Meter |
|-------------|------|-------|
| Blind Acceptance | ${blindRisk}% | \`${meterBar(blindRisk)}\` |
| Silent Drift (Debt) | ${debtRisk}% | \`${meterBar(debtRisk)}\` |
| Review Engagement | ${reviewRisk}% | \`${meterBar(reviewRisk)}\` |
| Over-delegation | ${overDelegationRisk}% | \`${meterBar(overDelegationRisk)}\` |`;
    if (antipatternBreakdown) {
        const fl = antipatternBreakdown.flooding || {};
        const rd = antipatternBreakdown.responseDrill || {};
        const cs = antipatternBreakdown.contextSpread || {};
        md += `
| Flooding (approx) | ${fl.risk0To100 ?? 0}% | \`${meterBar(fl.risk0To100 ?? 0)}\` |
| Response drill | ${rd.risk0To100 ?? 0}% | \`${meterBar(rd.risk0To100 ?? 0)}\` |
| Context spread | ${cs.risk0To100 ?? 0}% | \`${meterBar(cs.risk0To100 ?? 0)}\` |`;
    }
    md += `

*Component raw scores: Review ${c.review ?? 0}/40, Blind Accept ${c.blindAcceptance ?? 0}/30, Adaptation ${c.adaptation ?? 0}/30, Debt ${c.debt ?? 0}/30.*

---

## File lists

`;

    const { unopened, unreviewedSuggestions } = getUnopenedAndUnreviewed(scoreData);

    md += `### Unopened files (debt): ${unopened.count}\n\n`;
    if (unopened.files.length === 0) {
        md += '*None*\n\n';
    } else {
        unopened.files.forEach(f => {
            const age = (f.ageMinutes || 0) < 60 ? `${f.ageMinutes || 0}m ago` : `${Math.round((f.ageMinutes || 0) / 60)}h ago`;
            md += `- \`${f.path || f.fullPath || ''}\` (${age})\n`;
        });
        md += '\n';
    }

    md += `### Unreviewed suggestions: ${unreviewedSuggestions.count}\n\n`;
    if (unreviewedSuggestions.files.length === 0) {
        md += '*None*\n\n';
    } else {
        unreviewedSuggestions.files.forEach(f => {
            const age = (f.ageMinutes || 0) < 60 ? `${f.ageMinutes || 0}m ago` : `${Math.round((f.ageMinutes || 0) / 60)}h ago`;
            md += `- \`${f.path || f.fullPath || ''}\` (${age})\n`;
        });
        md += '\n';
    }

    md += `---

*Suggestions: ${scoreData.suggestions?.total ?? 0} total (${scoreData.suggestions?.pending ?? 0} pending). Accepted: ${scoreData.suggestions?.accepted ?? 0}, Adapted: ${scoreData.suggestions?.adapted ?? 0}, Rejected: ${scoreData.suggestions?.rejected ?? 0}*

*Commands: **Show Awareness State** (Output), **Show Unreviewed Files** (quick pick).*
`;

    return md;
}

module.exports = {
    getCircleState,
    buildSchematicTooltip,
    buildDashboardMarkdown,
    RISK_TO_BG,
    componentToRisk100
};
