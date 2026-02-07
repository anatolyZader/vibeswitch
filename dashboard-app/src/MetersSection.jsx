const React = require('react');
function riskToColor(pct) {
  if (pct >= 80) return '#e53935';
  if (pct >= 60) return '#ff9800';
  if (pct >= 40) return '#fdd835';
  return '#4caf50';
}
function Gauge(props) {
  const pct = Math.max(0, Math.min(100, props.risk ?? 0));
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  return React.createElement('div', { className: 'gauge-cell' },
    React.createElement('svg', { className: 'gauge-svg', viewBox: '0 0 60 60' },
      React.createElement('circle', { className: 'gauge-track', cx: 30, cy: 30, r, fill: 'none', strokeWidth: 6 }),
      React.createElement('circle', { className: 'gauge-arc', cx: 30, cy: 30, r, fill: 'none', stroke: riskToColor(pct), strokeWidth: 6, strokeDasharray: dash + ' ' + circumference, strokeDashoffset: 0, transform: 'rotate(-90 30 30)' })
    ),
    React.createElement('div', { className: 'gauge-label' }, props.name),
    React.createElement('div', { className: 'gauge-pct' }, pct + '%')
  );
}
function compRisk(value, max, invert) {
  if (typeof value !== 'number' || typeof max !== 'number' || max <= 0) return 0;
  const pct = Math.max(0, Math.min(max, value)) / max;
  return Math.round((invert ? (1 - pct) : pct) * 100);
}
function MetersSection(props) {
  const c = (props.payload && props.payload.scoreData && props.payload.scoreData.components) || {};
  const b = props.payload && props.payload.antipatternBreakdown ? props.payload.antipatternBreakdown : {};
  const ownershipRisk = Math.round((compRisk(c.blindAcceptance ?? 0, 30, false) * 30 + compRisk(c.review ?? 0, 40, true) * 40 + compRisk(c.adaptation ?? 0, 30, true) * 30) / 100);
  const debtRisk = compRisk(c.debt ?? 0, 30, false);
  const interactionRisk = Math.max(b.flooding && b.flooding.risk0To100 || 0, b.responseDrill && b.responseDrill.risk0To100 || 0, b.diffFlooding && b.diffFlooding.risk0To100 || 0);
  const contextOrDup = Math.max(b.contextSpread && b.contextSpread.risk0To100 || 0, b.duplication && b.duplication.risk0To100 || 0);
  const gauges = [
    { name: 'Ownership & Engagement', risk: ownershipRisk },
    { name: 'Silent Drift', risk: debtRisk },
    { name: 'Interaction Quality', risk: interactionRisk },
    { name: 'Context & Resource', risk: contextOrDup }
  ];
  return React.createElement('div', { className: 'gauges' }, gauges.map(function (g) { return React.createElement(Gauge, { key: g.name, name: g.name, risk: g.risk }); }));
}
module.exports = { default: MetersSection };
