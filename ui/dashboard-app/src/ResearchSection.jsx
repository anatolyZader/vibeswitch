const React = require('react');

/**
 * Simple SVG line chart. series[i].values length must match labels.length.
 * @param {{ labels: string[], series: Array<{ name: string, values: number[], color?: string }>, height?: number, width?: number }}
 */
function LineChart(_ref) {
  const labels = _ref.labels || [];
  const series = _ref.series || [];
  const height = _ref.height != null ? _ref.height : 160;
  const width = _ref.width != null ? _ref.width : 320;
  const padding = { top: 12, right: 12, bottom: 24, left: 36 };
  const innerW = Math.max(0, width - padding.left - padding.right);
  const innerH = Math.max(0, height - padding.top - padding.bottom);
  const allValues = series.reduce(function (acc, s) { return acc.concat(s.values || []); }, []);
  const minV = allValues.length ? Math.min.apply(null, allValues) : 0;
  const maxV = allValues.length ? Math.max.apply(null, allValues) : 1;
  const range = maxV - minV || 1;
  const scaleY = function (v) { return padding.top + innerH - (Number(v) - minV) / range * innerH; };
  const n = labels.length;
  const stepX = n > 1 ? innerW / (n - 1) : 0;

  return React.createElement('div', { className: 'research-chart-wrap' },
    React.createElement('svg', {
      className: 'research-chart-svg',
      viewBox: '0 0 ' + width + ' ' + height,
      preserveAspectRatio: 'xMidYMid meet'
    },
      series.map(function (s, idx) {
        const values = s.values || [];
        const color = s.color || (idx === 0 ? 'var(--vscode-charts-blue)' : idx === 1 ? 'var(--vscode-charts-green)' : 'var(--vscode-charts-yellow)');
        const points = values.map(function (v, i) {
          const x = padding.left + i * stepX;
          const y = scaleY(v);
          return x + ',' + y;
        }).join(' ');
        return React.createElement('g', { key: s.name || idx },
          React.createElement('polyline', {
            fill: 'none',
            stroke: color,
            strokeWidth: 2,
            points: points
          })
        );
      }),
      labels.map(function (label, i) {
        const x = padding.left + i * stepX;
        return React.createElement('text', {
          key: i,
          x: x,
          y: height - 6,
          textAnchor: 'middle',
          className: 'research-chart-label',
          fontSize: 9
        }, label);
      })
    )
  );
}

/**
 * Aggregate sessionView by calendar day for charts.
 */
function aggregateSessionsByDay(sessionView) {
  const byDay = {};
  const dayMs = 24 * 60 * 60 * 1000;
  (sessionView || []).forEach(function (s) {
    const startTs = s.startTs != null ? Number(s.startTs) : 0;
    const dateKey = new Date(startTs).toISOString().slice(0, 10);
    if (!byDay[dateKey]) {
      byDay[dateKey] = { sessions: 0, blindAccept: 0, aiEvents: 0, humanEvents: 0 };
    }
    byDay[dateKey].sessions += 1;
    var ai = s.aiEventCount != null ? Number(s.aiEventCount) : 0;
    var human = s.humanEditCount != null ? Number(s.humanEditCount) : 0;
    byDay[dateKey].aiEvents += ai;
    byDay[dateKey].humanEvents += human;
    if (ai >= 2 && human < 1) byDay[dateKey].blindAccept += 1;
  });
  const sortedDays = Object.keys(byDay).sort();
  return sortedDays.map(function (d) {
    return { date: d, display: d.slice(5), ...byDay[d] };
  });
}

function ResearchSection(props) {
  const payload = props.payload || {};
  const sessionView = Array.isArray(payload.sessionView) ? payload.sessionView : [];
  const moduleView = payload.moduleView && payload.moduleView.modules ? payload.moduleView : { modules: {} };
  const scoreData = payload.scoreData || {};
  const antipatternBreakdown = payload.antipatternBreakdown || {};
  const tokenUsage = payload.tokenUsage || {};
  const sonarMeasures = payload.sonarMeasures || {};
  const eslintMeasures = payload.eslintMeasures || {};
  const researchFindings = Array.isArray(payload.researchFindings) ? payload.researchFindings : [];

  const byDay = aggregateSessionsByDay(sessionView);
  const totalSessions = sessionView.length;
  const blindAcceptSessions = sessionView.filter(function (s) {
    var ai = s.aiEventCount != null ? Number(s.aiEventCount) : 0;
    var human = s.humanEditCount != null ? Number(s.humanEditCount) : 0;
    return ai >= 2 && human < 1;
  }).length;
  const blindAcceptPct = totalSessions ? Math.round(100 * blindAcceptSessions / totalSessions) : 0;
  const totalRisk = scoreData.total != null ? Number(scoreData.total) : 0;
  const unopenedFiles = scoreData.unopenedFiles != null ? Number(scoreData.unopenedFiles) : 0;
  const totalInput = tokenUsage.totalInput != null ? Number(tokenUsage.totalInput) : 0;
  const totalOutput = tokenUsage.totalOutput != null ? Number(tokenUsage.totalOutput) : 0;
  const totalTokens = tokenUsage.totalTokens != null ? Number(tokenUsage.totalTokens) : totalInput + totalOutput;

  var chartLabels = byDay.map(function (d) { return d.display; });
  var chartSeries = [];
  if (byDay.length > 0) {
    chartSeries.push({ name: 'Sessions', values: byDay.map(function (d) { return d.sessions; }), color: 'var(--vscode-charts-blue)' });
    chartSeries.push({ name: 'High blind-accept', values: byDay.map(function (d) { return d.blindAccept; }), color: 'var(--vscode-charts-orange)' });
  }

  var antipatternNums = [];
  try {
    var flat = antipatternBreakdown;
    var labels = { flooding: 'Flooding', responseDrill: 'Response drill', diffFlooding: 'Diff flooding', contextSpread: 'Context spread', duplication: 'Duplication', verificationDebt: 'Verification debt', comprehensionDebt: 'Comprehension debt', silentDrift: 'Silent drift', boundaryViolations: 'Boundary violations' };
    Object.keys(flat || {}).forEach(function (key) {
      var v = flat[key];
      if (v != null && typeof v === 'object' && typeof v.risk0To100 === 'number') {
        antipatternNums.push({ name: labels[key] || key, value: v.risk0To100 });
      }
    });
  } catch (_) {}

  return React.createElement('div', { className: 'research-section dashboard-section' },
    React.createElement('h2', null, 'Research'),
    React.createElement('p', { className: 'research-intro' },
      'Relationships between AI-assisted coding antipatterns (VibeSwitch) and objective quality measures (token usage; Sonar and ESLint when configured).'
    ),

    byDay.length > 0 && React.createElement('div', { className: 'research-chart-block' },
      React.createElement('h3', null, 'Activity and blind-accept by day'),
      React.createElement(LineChart, { labels: chartLabels, series: chartSeries, height: 180, width: 340 })
    ),

    React.createElement('div', { className: 'research-article-block' },
      React.createElement('h3', null, 'Findings (last 7 days)'),
      React.createElement('div', { className: 'research-article-body' },
        React.createElement('p', null,
          'Over the observed period, ', React.createElement('strong', null, totalSessions), ' coding sessions were recorded. ',
          React.createElement('strong', null, blindAcceptSessions), ' sessions (', blindAcceptPct, '%) showed high blind-accept behavior ',
          '(≥2 AI events and &lt;1 human edit). Current aggregate risk score is ', React.createElement('strong', null, totalRisk), '/100. ',
          'Unopened files (verification debt) count: ', React.createElement('strong', null, unopenedFiles), '.'
        ),
        React.createElement('p', null,
          'Token usage in the current period: ', React.createElement('strong', null, totalInput.toLocaleString()), ' input, ',
          React.createElement('strong', null, totalOutput.toLocaleString()), ' output ',
          (totalTokens > 0 ? React.createElement('span', null, '(', React.createElement('strong', null, totalTokens.toLocaleString()), ' total)') : null), '. ',
          tokenUsage.usageApiAvailable ? 'Source: session token API.' : 'Set session token for usage data.'
        ),
        antipatternNums.length > 0 && React.createElement('p', null,
          'Antipattern meter contributions (0–100): ',
          antipatternNums.map(function (a) { return a.name + ' ' + a.value + '%'; }).join('; '), '.'
        ),
        sonarMeasures.sonarApiAvailable
          ? React.createElement('p', { className: 'research-objective' },
              'SonarCloud: ',
              React.createElement('strong', null, sonarMeasures.bugs != null ? sonarMeasures.bugs : 0), ' bugs, ',
              React.createElement('strong', null, sonarMeasures.vulnerabilities != null ? sonarMeasures.vulnerabilities : 0), ' vulnerabilities, ',
              React.createElement('strong', null, sonarMeasures.code_smells != null ? sonarMeasures.code_smells : 0), ' code smells. ',
              'Duplication: ', React.createElement('strong', null, (sonarMeasures.duplicated_lines_density != null ? Number(sonarMeasures.duplicated_lines_density).toFixed(1) : '0')), '%. ',
              'Coverage: ', React.createElement('strong', null, (sonarMeasures.coverage != null ? Number(sonarMeasures.coverage).toFixed(1) : '—')), '%. ',
              (sonarMeasures.ncloc != null && sonarMeasures.ncloc > 0 ? React.createElement('span', null, 'Lines (ncloc): ', React.createElement('strong', null, sonarMeasures.ncloc.toLocaleString()), '. ') : null),
              'These metrics are correlated with antipattern intensity in the research pipeline.'
            )
          : null,
        eslintMeasures.eslintApiAvailable
          ? React.createElement('p', { className: 'research-objective' },
              'ESLint: ',
              React.createElement('strong', null, eslintMeasures.errorCount != null ? eslintMeasures.errorCount : 0), ' errors, ',
              React.createElement('strong', null, eslintMeasures.warningCount != null ? eslintMeasures.warningCount : 0), ' warnings.',
              (((eslintMeasures.fixableErrorCount || 0) + (eslintMeasures.fixableWarningCount || 0)) > 0
                ? React.createElement('span', null, ' ', (eslintMeasures.fixableErrorCount || 0) + (eslintMeasures.fixableWarningCount || 0), ' fixable.')
                : null)
            )
          : null,
        !sonarMeasures.sonarApiAvailable && !eslintMeasures.eslintApiAvailable
          ? React.createElement('p', { className: 'research-objective' },
              'Objective code quality (Sonar, ESLint) will be correlated here when configured. Set SonarCloud token and project key for Sonar. ESLint runs on workspace when enabled (vibeswitch.eslint.enabled).'
            )
          : null
      )
    ),

    researchFindings.length > 0 && React.createElement('div', { className: 'research-analysis-block' },
      React.createElement('h3', null, 'Latest statistical analysis'),
      researchFindings.map(function (r, i) {
        return React.createElement('div', { key: i, className: 'research-finding' },
          r.design && React.createElement('strong', null, r.design),
          React.createElement('p', null, r.findings || 'No findings.')
        );
      })
    ),

    React.createElement('div', { className: 'research-module-summary' },
      React.createElement('h3', null, 'Module view (boundary risk)'),
      Object.keys(moduleView.modules || {}).length === 0
        ? React.createElement('p', null, React.createElement('em', null, 'No module data.'))
        : React.createElement('ul', { className: 'modules-list compact' },
            Object.keys(moduleView.modules).slice(0, 12).map(function (modName) {
              var m = moduleView.modules[modName];
              var violations = (m.boundaryViolations && m.boundaryViolations.length) || 0;
              var drift = m.driftScore != null ? m.driftScore + '% drift' : '';
              return React.createElement('li', { key: modName },
                React.createElement('strong', null, modName), ': ', violations, ' boundary violations', drift ? ' · ' + drift : ''
              );
            })
          )
    )
  );
}

module.exports = { default: ResearchSection };
