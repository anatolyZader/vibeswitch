/**
 * Dashboard content builder: schematic tooltip and full dashboard markdown.
 * Shared between status bar hover popup and dashboard tab.
 * Uses existing getScore() / getScoreBreakdown() and unopened/unreviewed file data.
 */

function getUnopenedAndUnreviewed(scoreData) {
    const unopened = (scoreData && scoreData.unopenedFiles) ? scoreData.unopenedFiles : { count: 0, files: [] };
    const unreviewedSuggestions = (scoreData && scoreData.unreviewedSuggestions) ? scoreData.unreviewedSuggestions : { count: 0, files: [] };
    const debt = scoreData && scoreData.debt;
    const debtFiles = (debt && (debt.allFiles || debt.files)) || [];
    const debtTotal = (debt && debt.unreviewedFiles != null) ? debt.unreviewedFiles : debtFiles.length;
    const pendingFiles = (scoreData && scoreData.suggestions && scoreData.suggestions.pendingFiles) ? scoreData.suggestions.pendingFiles : [];
    const pendingCount = (scoreData && scoreData.suggestions && scoreData.suggestions.pending != null) ? scoreData.suggestions.pending : pendingFiles.length;
    const useFallback = (unopened.count === 0 && unreviewedSuggestions.count === 0) && (debtTotal > 0 || pendingCount > 0);
    if (useFallback && scoreData) {
        const list = (debt.files || debt.allFiles || []).slice(0, 15).map(f => ({ path: f.path || f.fullPath, fullPath: f.fullPath || f.path, ageMinutes: f.ageMinutes || 0 }));
        return {
            unopened: { count: debtTotal, files: list },
            unreviewedSuggestions: { count: pendingCount, files: pendingFiles }
        };
    }
    return {
        unopened: { count: unopened.count != null ? unopened.count : debtTotal, files: unopened.files || [] },
        unreviewedSuggestions: { count: unreviewedSuggestions.count != null ? unreviewedSuggestions.count : pendingCount, files: unreviewedSuggestions.files || [] }
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

/** Contract A: breakdown may be envelope { value, meta, updatedTs } per key. Normalize to flat value for display. */
function normalizeBreakdownForDisplay(breakdown) {
    if (!breakdown || typeof breakdown !== 'object') return breakdown;
    const out = {};
    for (const key of Object.keys(breakdown)) {
        const entry = breakdown[key];
        out[key] = entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry;
    }
    return out;
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
 * Canonical "Interaction Quality" risk (0-100): max of flooding, response-drill, and diff flooding (burst).
 */
function interactionQualityRisk100(antipatternBreakdown) {
    const b = normalizeBreakdownForDisplay(antipatternBreakdown);
    if (!b) return 0;
    const fl = b.flooding?.risk0To100 ?? 0;
    const rd = b.responseDrill?.risk0To100 ?? 0;
    const df = b.diffFlooding?.risk0To100 ?? 0;
    return Math.max(fl, rd, df);
}

/**
 * Build concise schematic tooltip: risk score, 4 canonical meters (with sub-signals on hover), then files.
 * @param {Object} [antipatternBreakdown] - Result of awarenessEngine.getAntipatternBreakdown()
 */
function buildSchematicTooltip(scoreData, scoreBreakdown, currentMode, antipatternBreakdown) {
    antipatternBreakdown = normalizeBreakdownForDisplay(antipatternBreakdown);
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
        `    Flooding ${antipatternBreakdown?.flooding?.risk0To100 ?? 0}% · Response drill ${rd}% · Diff flood ${antipatternBreakdown?.diffFlooding?.risk0To100 ?? 0}%`,
        `  Context & Resource:      ${contextRisk}% (spread & duplication risk)`
    ];
    if (interactionRisk >= 50) {
        lines.push('  → High loop risk correlates with churn & duplication (GitClear 2025).');
    }
    const compRisk = antipatternBreakdown?.comprehensionDebt?.risk0To100 ?? 0;
    const verRisk = antipatternBreakdown?.verificationDebt?.risk0To100 ?? 0;
    const diffFloodRisk = antipatternBreakdown?.diffFlooding?.risk0To100 ?? 0;
    const testTheaterRisk = antipatternBreakdown?.testTheater?.risk0To100 ?? 0;
    if (compRisk > 0) lines.push(`  Comprehension debt: ${compRisk}% (research-backed).`);
    if (verRisk > 0) lines.push(`  Verification debt: ${verRisk}% (accepted without test/save/navigate).`);
    if (diffFloodRisk > 0) lines.push(`  Diff flooding: ${diffFloodRisk}% (large-burst risk).`);
    if (testTheaterRisk > 0) lines.push(`  Test theater: ${testTheaterRisk}% (shallow/snapshot-heavy tests as merge token; experimental).`);

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
    antipatternBreakdown = normalizeBreakdownForDisplay(antipatternBreakdown);
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

*Breakdown — Ownership: blind acceptance ${blindRisk}%, review depth ${reviewRisk}%, adaptation ${overDelegationRisk}%. Interaction: flooding ${fl}%, response drill ${rd}%, diff flood ${antipatternBreakdown?.diffFlooding?.risk0To100 ?? 0}%. Context: spread ${contextRisk}%${dup ? `, duplication drift ${duplicationRisk}% (${dup.fileCountWithDuplicates ?? 0} file(s) with 5+ line duplicate blocks)` : ''}${(antipatternBreakdown?.testTheater?.risk0To100 ?? 0) > 0 ? `, test theater ${antipatternBreakdown.testTheater.risk0To100}%` : ''}.*
${(antipatternBreakdown?.comprehensionDebt?.risk0To100 ?? 0) > 0 ? `\n*Comprehension debt risk: ${antipatternBreakdown.comprehensionDebt.risk0To100}% (low review + high response drill; research-backed).*` : ''}
${(antipatternBreakdown?.verificationDebt?.risk0To100 ?? 0) > 0 ? `\n*Verification debt risk: ${antipatternBreakdown.verificationDebt.risk0To100}% (${antipatternBreakdown.verificationDebt.acceptedWithoutVerification ?? 0}/${antipatternBreakdown.verificationDebt.acceptedTotal ?? 0} accepted without test/save/navigate signal).*` : ''}
${(antipatternBreakdown?.testTheater?.risk0To100 ?? 0) > 0 ? `\n*Test theater risk: ${antipatternBreakdown.testTheater.risk0To100}% (shallow/snapshot-heavy tests as merge token; research-backed, experimental).*` : ''}

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
 * Build HTML for Webview dashboard with 4 canonical meters (circular gauges), breakdown, Output (token usage + events), Session/Module/Integration views.
 */
function buildDashboardWebviewHtml(scoreData, scoreBreakdown, currentMode, antipatternBreakdown, events, tokenUsage, capabilities, sessionView, moduleView) {
    antipatternBreakdown = normalizeBreakdownForDisplay(antipatternBreakdown);
    events = Array.isArray(events) ? events : [];
    tokenUsage = tokenUsage || { totalInput: 0, totalOutput: 0, totalTokens: 0, lastUpdatedTs: 0, usageApiAvailable: false };
    capabilities = capabilities || { git: false, ast: false, tasksObserved: false, usageApiAvailable: false };
    sessionView = Array.isArray(sessionView) ? sessionView : [];
    moduleView = moduleView && moduleView.modules ? moduleView : { modules: {} };
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

    const comprehensionRisk = antipatternBreakdown?.comprehensionDebt?.risk0To100 ?? 0;
    const verificationRisk = antipatternBreakdown?.verificationDebt?.risk0To100 ?? 0;
    const verificationCount = antipatternBreakdown?.verificationDebt?.acceptedWithoutVerification ?? 0;
    const verificationTotal = antipatternBreakdown?.verificationDebt?.acceptedTotal ?? 0;
    const dupFiles = dup?.fileCountWithDuplicates ?? 0;
    const diffFloodRisk = antipatternBreakdown?.diffFlooding?.risk0To100 ?? 0;
    const testTheaterRisk = antipatternBreakdown?.testTheater?.risk0To100 ?? 0;
    let breakdownHtml = `<p class="breakdown"><strong>Breakdown</strong> — Ownership: blind acceptance ${blindRisk}%, review depth ${reviewRisk}%, adaptation ${overDelegationRisk}%. Interaction: flooding ${fl}%, response drill ${rd}%, diff flood ${diffFloodRisk}%. Context: spread ${contextRisk}%${dup ? `, duplication drift ${duplicationRisk}% (${dupFiles} file(s) with 5+ line duplicate blocks)` : ''}${testTheaterRisk > 0 ? `, test theater ${testTheaterRisk}%` : ''}.</p>`;
    if (comprehensionRisk > 0) {
        breakdownHtml += `<p class="breakdown comprehension-hint">Comprehension debt risk: ${comprehensionRisk}% (low review + high response drill; research-backed).</p>`;
    }
    if (verificationRisk > 0) {
        breakdownHtml += `<p class="breakdown verification-hint">Verification debt risk: ${verificationRisk}% (${verificationCount}/${verificationTotal} accepted without test/save/navigate signal).</p>`;
    }
    if (testTheaterRisk > 0) {
        breakdownHtml += `<p class="breakdown test-theater-hint">Test theater risk: ${testTheaterRisk}% (shallow/snapshot-heavy tests as merge token; research-backed, experimental).</p>`;
    }

    const riskKeys = ['cargoCultRisk', 'refactorAtrophy', 'additiveBias', 'iterativeChurn', 'semanticClones', 'promptThrash', 'observabilityNeglect', 'verificationDebt', 'comprehensionDebt', 'testTheater', 'boundaryViolations', 'silentDrift'];
    const riskLabels = { cargoCultRisk: 'Cargo cult', refactorAtrophy: 'Refactor atrophy', additiveBias: 'Additive bias', iterativeChurn: 'Iterative churn', semanticClones: 'Semantic clones', promptThrash: 'Prompt thrash', observabilityNeglect: 'Observability neglect', verificationDebt: 'Verification debt', comprehensionDebt: 'Comprehension debt', testTheater: 'Test theater', boundaryViolations: 'Boundary violations', silentDrift: 'Silent drift' };
    const getRisk = (key) => {
        const v = antipatternBreakdown && antipatternBreakdown[key];
        if (v == null) return 0;
        return (typeof v === 'object' && typeof v.risk0To100 === 'number') ? v.risk0To100 : (typeof v === 'number' ? v : 0);
    };
    const topRisks = riskKeys
        .map(k => ({ key: k, risk: getRisk(k) }))
        .filter(r => r.risk > 0)
        .sort((a, b) => b.risk - a.risk)
        .slice(0, 3);
    const top3Html = topRisks.length > 0
        ? '<p class="breakdown top3-risks"><strong>Top 3 active anti-patterns this week:</strong> ' + topRisks.map(r => escapeHtml(riskLabels[r.key] || r.key) + ' ' + r.risk + '%').join(', ') + '</p>'
        : '';

    const drift = antipatternBreakdown && antipatternBreakdown.silentDrift;
    const driftTimeline = drift && drift.driftTimeline && drift.driftTimeline.length ? drift.driftTimeline : [];
    const driftSparklineHtml = driftTimeline.length > 0
        ? '<p class="breakdown drift-sparkline"><strong>Drift trend</strong> <span class="sparkline" aria-label="Drift score over time">' + driftTimeline.map((d, i) => '<span class="spark-dot" style="height:' + Math.max(4, (d.score || 0) / 5) + 'px" title="' + (d.score || 0) + '%"></span>').join('') + '</span> ' + (drift.risk0To100 != null ? drift.risk0To100 + '%' : '') + '</p>'
        : '';

    const llmSmells = antipatternBreakdown && antipatternBreakdown.llmSmells;
    const aiSafetyHtml = llmSmells
        ? '<div class="integration-section"><h3>AI Safety Posture</h3><ul class="checklist"><li>Model reproducibility: ' + escapeHtml(llmSmells.reproducibilityStatus || 'unknown') + '</li><li>Runtime safety: ' + escapeHtml(llmSmells.runtimeSafetyPosture || 'unknown') + '</li><li>Schema safety: ' + escapeHtml(llmSmells.schemaSafety || 'unknown') + '</li><li>Prompt governance: ' + escapeHtml(llmSmells.promptGovernance || 'unknown') + '</li></ul></div>'
        : '';

    let sessionViewHtml = '<div class="session-view-section"><h2>Session view</h2>';
    if (sessionView.length === 0) {
        sessionViewHtml += '<p><em>No sessions in the last 7 days.</em></p>';
    } else {
        sessionViewHtml += '<ul class="sessions-list">';
        sessionView.slice(0, 15).forEach(s => {
            const start = s.startTs ? new Date(s.startTs).toLocaleString() : '';
            const end = s.endTs ? new Date(s.endTs).toLocaleString() : '';
            const badges = [];
            if ((s.aiEventCount || 0) >= 2 && (s.humanEditCount || 0) < 1) badges.push('High blind accept');
            sessionViewHtml += '<li><code>' + escapeHtml(start) + '</code> – <code>' + escapeHtml(end) + '</code> AI: ' + (s.aiEventCount || 0) + ', Human: ' + (s.humanEditCount || 0) + (badges.length ? ' <span class="badge">' + escapeHtml(badges.join(', ')) + '</span>' : '') + '</li>';
        });
        sessionViewHtml += '</ul>';
    }
    sessionViewHtml += '</div>';

    let moduleViewHtml = '<div class="module-view-section"><h2>Module view</h2>';
    const mods = Object.keys(moduleView.modules || {});
    if (mods.length === 0) {
        moduleViewHtml += '<p><em>No module data.</em></p>';
    } else {
        moduleViewHtml += '<ul class="modules-list">';
        mods.slice(0, 20).forEach(modName => {
            const m = moduleView.modules[modName];
            const violations = (m.boundaryViolations && m.boundaryViolations.length) || 0;
            const actions = (m.actionQueue && m.actionQueue.length) ? m.actionQueue.join('; ') : '';
            moduleViewHtml += '<li><strong>' + escapeHtml(modName) + '</strong> Boundary violations: ' + violations + (m.driftScore != null ? ', Drift: ' + m.driftScore + '%' : '') + (actions ? ' — ' + escapeHtml(actions) : '') + '</li>';
        });
        moduleViewHtml += '</ul>';
    }
    moduleViewHtml += '</div>';

    let outputHtml = '<div class="output-section"><h2>Output</h2>';
    if (capabilities.usageApiAvailable && tokenUsage.totalTokens >= 0) {
        outputHtml += '<div class="token-usage-block"><strong>Token usage</strong> — Input: ' + (tokenUsage.totalInput || 0) + ', Output: ' + (tokenUsage.totalOutput || 0) + ', Total: ' + (tokenUsage.totalTokens || 0);
        if (tokenUsage.costCents != null) outputHtml += ', Cost: ' + (tokenUsage.costCents / 100).toFixed(2) + ' USD';
        outputHtml += '</div>';
    } else {
        outputHtml += '<div class="token-usage-block token-unavailable">Token usage unavailable (set session token in extension state or use Cursor usage API).</div>';
    }
    outputHtml += '<h3>Events</h3><ul class="events-list">';
    if (events.length === 0) {
        outputHtml += '<li><em>No events</em></li>';
    } else {
        events.slice(0, 30).forEach((e) => {
            const ts = e.ts ? new Date(e.ts).toLocaleTimeString() : '';
            const sev = e.severity || 'info';
            outputHtml += '<li class="event-sev-' + escapeHtml(sev) + '"><code>' + escapeHtml(ts) + '</code> ' + escapeHtml(e.label || e.type || '') + (e.detail ? ' — ' + escapeHtml(e.detail) : '') + '</li>';
        });
    }
    outputHtml += '</ul><p class="capabilities-note">Capabilities: git ' + (capabilities.git ? 'on' : 'off') + ', ast ' + (capabilities.ast ? 'on' : 'off') + ', usage API ' + (capabilities.usageApiAvailable ? 'on' : 'off') + '</p></div>';

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
    .verification-hint { font-size: 0.8rem; opacity: 0.9; margin: 0.25rem 0 0 0; font-style: italic; }
    .test-theater-hint { font-size: 0.8rem; opacity: 0.9; margin: 0.25rem 0 0 0; font-style: italic; }
    .gauge-future { opacity: 0.5; }
    .gauge-future .gauge-label { font-style: italic; }
    .output-section { margin-top: 1.5rem; }
    .output-section h2 { font-size: 1rem; margin: 1rem 0 0.5rem 0; }
    .token-usage-block { font-size: 0.85rem; margin: 0.25rem 0; }
    .token-unavailable { opacity: 0.8; font-style: italic; }
    .events-list { margin: 0.25rem 0; padding-left: 1.25rem; font-size: 0.85rem; }
    .event-sev-high { color: var(--vscode-errorForeground, #e53935); }
    .event-sev-warn { opacity: 0.95; }
    .capabilities-note { font-size: 0.75rem; opacity: 0.7; margin-top: 0.5rem; }
    .top3-risks { margin-top: 0.5rem; }
    .drift-sparkline { margin-top: 0.25rem; }
    .sparkline { display: inline-flex; align-items: flex-end; gap: 2px; vertical-align: middle; }
    .spark-dot { display: inline-block; width: 4px; min-width: 4px; background: var(--vscode-charts-blue); border-radius: 1px; }
    .integration-section { margin-top: 1rem; }
    .integration-section h3 { font-size: 0.95rem; margin: 0 0 0.5rem 0; }
    .checklist { margin: 0; padding-left: 1.25rem; font-size: 0.85rem; }
    .session-view-section, .module-view-section { margin-top: 1.5rem; }
    .session-view-section h2, .module-view-section h2 { font-size: 1rem; margin: 0 0 0.5rem 0; }
    .sessions-list, .modules-list { margin: 0.25rem 0; padding-left: 1.25rem; font-size: 0.85rem; }
    .badge { font-size: 0.75rem; opacity: 0.9; margin-left: 0.25rem; }
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
  ${top3Html}
  ${driftSparklineHtml}
  ${aiSafetyHtml}
  ${sessionViewHtml}
  ${moduleViewHtml}
  ${outputHtml}
  <p class="raw-scores"><em>Raw scores: ${escapeHtml(rawScores)}</em></p>
  <p class="docs-note">Meters align with research-backed antipatterns: blind acceptance, verification debt, silent drift, context dilution, over-delegation, prompt thrash, test theater, diff flooding (see <code>docs/2026-02-03_17-41-ai-agent-antipatterns-research-taxonomy.md</code>). GitClear 2025 &amp; DORA 2024: churn, duplication, defect rate. Details: <code>docs/ANTIPATTERN-METERS-REVIEW.md</code>.</p>
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
    normalizeBreakdownForDisplay,
    riskToArcColor,
    RISK_TO_BG,
    componentToRisk100
};
