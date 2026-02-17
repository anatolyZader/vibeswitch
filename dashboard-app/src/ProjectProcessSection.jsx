const React = require('react');

function deviationToColor(pct) {
  if (pct >= 80) return '#e53935';
  if (pct >= 60) return '#ff9800';
  if (pct >= 40) return '#fdd835';
  return '#4caf50';
}

function DeviationGauge(props) {
  const value = props.deviation;
  const isNa = value == null || typeof value !== 'number';
  const pct = isNa ? 0 : Math.max(0, Math.min(100, value));
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  return React.createElement('div', { className: 'gauge-cell' },
    React.createElement('svg', { className: 'gauge-svg', viewBox: '0 0 60 60' },
      React.createElement('circle', { className: 'gauge-track', cx: 30, cy: 30, r, fill: 'none', strokeWidth: 6 }),
      isNa ? null : React.createElement('circle', {
        className: 'gauge-arc',
        cx: 30,
        cy: 30,
        r,
        fill: 'none',
        stroke: deviationToColor(pct),
        strokeWidth: 6,
        strokeDasharray: dash + ' ' + circumference,
        strokeDashoffset: 0,
        transform: 'rotate(-90 30 30)'
      })
    ),
    React.createElement('div', { className: 'gauge-label' }, props.name),
    React.createElement('div', { className: 'gauge-pct' }, isNa ? 'N/A' : pct + '%')
  );
}

function ProjectProcessSection(props) {
  const m = (props.payload && props.payload.projectProgressMeasures) || {};
  const gauges = [
    { name: 'Plan (scope & order)', deviation: m.planDeviation },
    { name: 'Schedule (dates & terms)', deviation: m.scheduleDeviation },
    { name: 'Acceptance tests', deviation: m.acceptanceTestsDeviation }
  ];
  return React.createElement(
    'div',
    { className: 'project-process-section' },
    React.createElement('div', { className: 'gauges' }, gauges.map(function (g) {
      return React.createElement(DeviationGauge, { key: g.name, name: g.name, deviation: g.deviation });
    }))
  );
}

module.exports = { default: ProjectProcessSection };
