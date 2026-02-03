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
        text: 'REPORT',
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
        text: 'REPORT',
        backgroundColor,
        tooltip
    };
}

/**
 * Canonical "Ownership & Engagement" risk (0-100): weighted blend of blind acceptance, review, adaptation.
 * Same weight as in main score: blind 30, review 40, adaptation 30.
 */
function ownershipEngagementRisk100(c) {
    const blindRisk = componentToRisk100(c.blindAcceptance ?? 0, 30, false);
    const reviewRisk = componentToRisk100(c.review ?? 0, 40, true);
    const overDelegationRisk = componentToRisk100(c.adaptation ?? 0, 30, true);
    return Math.round((blindRisk * 30 + reviewRisk * 40 + overDelegationRisk * 30) / 100);
}

/**
 * Canonical "Interaction Quality" risk (0-100): max of flooding and response-drill (loop risk).
 */
function interactionQualityRisk100(antipatternBreakdown) {
    if (!antipatternBreakdown) return 0;
    const fl = antipatternBreakdown.flooding?.risk0To100 ?? 0;
    const rd = antipatternBreakdown.responseDrill?.risk0To100 ?? 0;
    return Math.max(fl, rd);
}

/**
 * Build concise schematic tooltip: risk score, 4 canonical meters (with sub-signals on hover), then files.
 * @param {Object} [antipatternBreakdown] - Result of awarenessEngine.getAntipatternBreakdown()
 */
function buildSchematicTooltip(scoreData, scoreBreakdown, currentMode, antipatternBreakdown) {
    const modeLabel = (currentMode || 'unknown').toUpperCase();
    const score = Math.max(0, Math.min(100, scoreData.total || 0));
    const c = scoreData.components || {};

    const blindRisk = componentToRisk100(c.blindAcceptance ?? 0, 30, false);
    const debtRisk = componentToRisk100(c.debt ?? 0, 30, false);
    const reviewRisk = componentToRisk100(c.review ?? 0, 40, true);
    const overDelegationRisk = componentToRisk100(c.adaptation ?? 0, 30, true);
    const ownershipRisk = ownershipEngagementRisk100(c);
    const interactionRisk = interactionQualityRisk100(antipatternBreakdown);
    const contextRisk = antipatternBreakdown?.contextSpread?.risk0To100 ?? 0;
    const rd = antipatternBreakdown?.responseDrill?.risk0To100 ?? 0;

    let lines = [
        `${modeLabel} · Risk: ${score}/100`,
        '',
        'Canonical meters:',
        `  Ownership & Engagement:  ${ownershipRisk}%`,
        `    Blind acceptance ${blindRisk}% · Review depth ${reviewRisk}% · Adaptation ${overDelegationRisk}%`,
        `  Silent Drift:            ${debtRisk}%`,
        `  Interaction Quality:    ${interactionRisk}%`,
        `    Flooding ${antipatternBreakdown?.flooding?.risk0To100 ?? 0}% · Response drill ${rd}%`,
        `  Context & Resource:      ${contextRisk}% (spread & duplication risk)`
    ];
    if (interactionRisk >= 50) {
        lines.push('  → High loop risk correlates with churn & duplication (GitClear 2025).');
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
 * Shows 4 canonical meters; sub-signals in breakdown.
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
    const ownershipRisk = ownershipEngagementRisk100(c);
    const interactionRisk = interactionQualityRisk100(antipatternBreakdown);
    const contextRisk = antipatternBreakdown?.contextSpread?.risk0To100 ?? 0;
    const dup = antipatternBreakdown?.duplication;
    const duplicationRisk = dup?.risk0To100 ?? 0;
    const contextOrDuplicationRisk = dup ? Math.max(contextRisk, duplicationRisk) : contextRisk;
    const fl = antipatternBreakdown?.flooding?.risk0To100 ?? 0;
    const rd = antipatternBreakdown?.responseDrill?.risk0To100 ?? 0;

    const meterBar = (pct) => {
        const n = Math.round((pct / 100) * 10);
        return '▰'.repeat(n) + '▱'.repeat(10 - n);
    };

    let md = `# VibeSwitch Dashboard

**Mode:** ${modeLabel}  
**Total risk score:** ${score}/100 (higher = worse)  
**Last activity:** ${(scoreData.debug && scoreData.debug.lastActivity) || '—'}

---

## Canonical meters

| Meter | Risk | Bar |
|-------|------|-------|
| Ownership & Engagement | ${ownershipRisk}% | \`${meterBar(ownershipRisk)}\` |
| Silent Drift | ${debtRisk}% | \`${meterBar(debtRisk)}\` |
| Interaction Quality | ${interactionRisk}% | \`${meterBar(interactionRisk)}\` |
| Context & Resource Discipline | ${contextOrDuplicationRisk}% | \`${meterBar(contextOrDuplicationRisk)}\` |

*Breakdown — Ownership: blind acceptance ${blindRisk}%, review depth ${reviewRisk}%, adaptation ${overDelegationRisk}%. Interaction: flooding ${fl}%, response drill ${rd}%. Context: spread ${contextRisk}%${dup ? `, duplication drift ${duplicationRisk}% (${dup.fileCountWithDuplicates ?? 0} file(s) with 5+ line duplicate blocks)` : ''}.*
${(reviewRisk >= 50 && rd >= 50) ? '\n*Comprehension debt risk: elevated (low review + high response drill; GitClear 2025).*' : ''}

*Raw scores: Review ${c.review ?? 0}/40, Blind Accept ${c.blindAcceptance ?? 0}/30, Adaptation ${c.adaptation ?? 0}/30, Debt ${c.debt ?? 0}/30.*

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

/**
 * Risk (0-100) to hex color for arc/gauge: green -> yellow -> orange -> red.
 */
function riskToArcColor(pct) {
    if (pct >= 80) return '#e53935';
    if (pct >= 60) return '#ff9800';
    if (pct >= 40) return '#fdd835';
    return '#4caf50';
}

/**
 * Build HTML for Webview dashboard with 4 canonical meters (circular gauges) and breakdown.
 * Optional future placeholders for Architecture & Responsibility and AI Mental Model.
 */
function buildDashboardWebviewHtml(scoreData, scoreBreakdown, currentMode, antipatternBreakdown) {
    const modeLabel = (currentMode || 'unknown').toUpperCase();
    const score = Math.max(0, Math.min(100, scoreData.total || 0));
    const c = scoreData.components || {};

    const blindRisk = componentToRisk100(c.blindAcceptance ?? 0, 30, false);
    const debtRisk = componentToRisk100(c.debt ?? 0, 30, false);
    const reviewRisk = componentToRisk100(c.review ?? 0, 40, true);
    const overDelegationRisk = componentToRisk100(c.adaptation ?? 0, 30, true);
    const ownershipRisk = ownershipEngagementRisk100(c);
    const interactionRisk = interactionQualityRisk100(antipatternBreakdown);
    const contextRisk = antipatternBreakdown?.contextSpread?.risk0To100 ?? 0;
    const dup = antipatternBreakdown?.duplication;
    const duplicationRisk = dup?.risk0To100 ?? 0;
    const contextOrDuplicationRisk = dup ? Math.max(contextRisk, duplicationRisk) : contextRisk;
    const fl = antipatternBreakdown?.flooding?.risk0To100 ?? 0;
    const rd = antipatternBreakdown?.responseDrill?.risk0To100 ?? 0;

    const meters = [
        { name: 'Ownership & Engagement', risk: ownershipRisk },
        { name: 'Silent Drift', risk: debtRisk },
        { name: 'Interaction Quality', risk: interactionRisk },
        { name: 'Context & Resource Discipline', risk: contextOrDuplicationRisk }
    ];

    const r = 26;
    const circumference = 2 * Math.PI * r;

    function svgGauge(pct, label) {
        const dash = (pct / 100) * circumference;
        const color = riskToArcColor(pct);
        return `
        <div class="gauge-cell">
          <svg class="gauge-svg" viewBox="0 0 60 60" aria-label="${escapeHtml(label)}: ${pct}%">
            <circle class="gauge-track" cx="30" cy="30" r="${r}" fill="none" stroke-width="6"/>
            <circle class="gauge-arc" cx="30" cy="30" r="${r}" fill="none" stroke="${color}" stroke-width="6"
              stroke-dasharray="${dash} ${circumference}" stroke-dashoffset="0" stroke-linecap="round"
              transform="rotate(-90 30 30)"/>
          </svg>
          <div class="gauge-label">${escapeHtml(label)}</div>
          <div class="gauge-pct">${pct}%</div>
        </div>`;
    }

    const gaugesHtml = meters.map(m => svgGauge(m.risk, m.name)).join('');

    const futureGaugesHtml = [
        { name: 'Architecture & Responsibility (future)', risk: null },
        { name: 'AI Mental Model (future)', risk: null }
    ].map(m => `
        <div class="gauge-cell gauge-future">
          <svg class="gauge-svg" viewBox="0 0 60 60" aria-label="${escapeHtml(m.name)}: not yet instrumented">
            <circle class="gauge-track" cx="30" cy="30" r="${26}" fill="none" stroke-width="6"/>
          </svg>
          <div class="gauge-label">${escapeHtml(m.name)}</div>
          <div class="gauge-pct">—</div>
        </div>`).join('');

    const comprehensionDebtElevated = reviewRisk >= 50 && rd >= 50;
    const dupFiles = dup?.fileCountWithDuplicates ?? 0;
    let breakdownHtml = `<p class="breakdown"><strong>Breakdown</strong> — Ownership: blind acceptance ${blindRisk}%, review depth ${reviewRisk}%, adaptation ${overDelegationRisk}%. Interaction: flooding ${fl}%, response drill ${rd}%. Context: spread ${contextRisk}%${dup ? `, duplication drift ${duplicationRisk}% (${dupFiles} file(s) with 5+ line duplicate blocks)` : ''}.</p>`;
    if (comprehensionDebtElevated) {
        breakdownHtml += '<p class="breakdown comprehension-hint">Comprehension debt risk: elevated (low review + high response drill; GitClear 2025).</p>';
    }

    const { unopened, unreviewedSuggestions } = getUnopenedAndUnreviewed(scoreData);
    let filesHtml = '<div class="file-lists"><h3>Unopened files (debt): ' + unopened.count + '</h3><ul>';
    (unopened.files || []).slice(0, 15).forEach(f => {
        const age = (f.ageMinutes || 0) < 60 ? (f.ageMinutes || 0) + 'm ago' : Math.round((f.ageMinutes || 0) / 60) + 'h ago';
        filesHtml += '<li><code>' + escapeHtml(f.path || f.fullPath || '') + '</code> (' + age + ')</li>';
    });
    filesHtml += '</ul><h3>Unreviewed suggestions: ' + unreviewedSuggestions.count + '</h3><ul>';
    (unreviewedSuggestions.files || []).slice(0, 15).forEach(f => {
        const age = (f.ageMinutes || 0) < 60 ? (f.ageMinutes || 0) + 'm ago' : Math.round((f.ageMinutes || 0) / 60) + 'h ago';
        filesHtml += '<li><code>' + escapeHtml(f.path || f.fullPath || '') + '</code> (' + age + ')</li>';
    });
    filesHtml += '</ul></div>';

    const rawScores = `Review ${c.review ?? 0}/40, Blind Accept ${c.blindAcceptance ?? 0}/30, Adaptation ${c.adaptation ?? 0}/30, Debt ${c.debt ?? 0}/30`;
    const lastActivity = (scoreData.debug && scoreData.debug.lastActivity) || '—';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 1rem; margin: 0; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem 0; }
    .header { margin-bottom: 1rem; }
    .header p { margin: 0.25rem 0; opacity: 0.9; }
    .gauges { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .gauge-cell { text-align: center; }
    .gauge-svg { width: 64px; height: 64px; display: block; margin: 0 auto; }
    .gauge-track { stroke: var(--vscode-widget-border); }
    .gauge-label { font-size: 0.7rem; margin-top: 0.25rem; max-width: 100px; word-break: break-word; }
    .gauge-pct { font-size: 0.75rem; font-weight: 600; margin-top: 0.15rem; }
    .file-lists { margin-top: 1.5rem; }
    .file-lists h3 { font-size: 0.9rem; margin: 1rem 0 0.5rem 0; }
    .file-lists ul { margin: 0; padding-left: 1.25rem; }
    .file-lists li { margin: 0.2rem 0; }
    .raw-scores { font-size: 0.85rem; opacity: 0.85; margin-top: 1rem; }
    .docs-note { font-size: 0.8rem; opacity: 0.8; margin-top: 0.5rem; }
    .breakdown { font-size: 0.85rem; opacity: 0.9; margin: 0.5rem 0 0 0; }
    .comprehension-hint { font-size: 0.8rem; opacity: 0.9; margin: 0.25rem 0 0 0; font-style: italic; }
    .gauge-future { opacity: 0.5; }
    .gauge-future .gauge-label { font-style: italic; }
  </style>
</head>
<body>
  <div class="header">
    <h1>VibeSwitch Dashboard</h1>
    <p><strong>Mode:</strong> ${escapeHtml(modeLabel)} &nbsp; <strong>Total risk:</strong> ${score}/100 &nbsp; <strong>Last activity:</strong> ${escapeHtml(lastActivity)}</p>
  </div>
  <h2>Canonical meters</h2>
  <div class="gauges">${gaugesHtml}${futureGaugesHtml}</div>
  ${breakdownHtml}
  <p class="raw-scores"><em>Raw scores: ${escapeHtml(rawScores)}</em></p>
  <p class="docs-note">Meters align with GitClear 2025 &amp; DORA 2024: churn, duplication, defect rate. See <code>docs/ANTIPATTERN-METERS-REVIEW.md</code> for applying research to the dashboard.</p>
  ${filesHtml}
</body>
</html>`;
}

function escapeHtml(s) {
    if (s == null) return '';
    const str = String(s);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
    getCircleState,
    buildSchematicTooltip,
    buildDashboardMarkdown,
    buildDashboardWebviewHtml,
    riskToArcColor,
    RISK_TO_BG,
    componentToRisk100
};
