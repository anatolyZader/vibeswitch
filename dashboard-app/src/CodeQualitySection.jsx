const React = require('react');

function MetricRow(_ref) {
  const label = _ref.label;
  const value = _ref.value;
  const unit = _ref.unit || '';
  const highlight = _ref.highlight;
  return React.createElement('div', { className: 'code-quality-row' + (highlight ? ' code-quality-row-highlight' : '') },
    React.createElement('span', { className: 'code-quality-label' }, label),
    React.createElement('span', { className: 'code-quality-value' }, value != null ? String(value) : '—', unit)
  );
}

function CodeQualitySection(props) {
  const payload = props.payload || {};
  const sonar = payload.sonarMeasures || {};
  const eslint = payload.eslintMeasures || {};
  const sonarAvailable = sonar.sonarApiAvailable === true;
  const eslintAvailable = eslint.eslintApiAvailable === true;

  if (!sonarAvailable && !eslintAvailable) {
    return React.createElement('div', { className: 'code-quality-section' },
      React.createElement('p', { className: 'code-quality-unavailable' },
        'Code quality metrics will appear here when SonarCloud or ESLint is configured. ',
        'Set SonarCloud token and project key for Sonar; enable ESLint (vibeswitch.eslint.enabled) for workspace lint.'
      )
    );
  }

  return React.createElement('div', { className: 'code-quality-section' },
    sonarAvailable && React.createElement('div', { className: 'code-quality-block' },
      React.createElement('h3', { className: 'code-quality-block-title' }, 'SonarCloud'),
      React.createElement('div', { className: 'code-quality-grid' },
        React.createElement(MetricRow, { label: 'Bugs', value: sonar.bugs != null ? sonar.bugs : 0 }),
        React.createElement(MetricRow, { label: 'Vulnerabilities', value: sonar.vulnerabilities != null ? sonar.vulnerabilities : 0 }),
        React.createElement(MetricRow, { label: 'Code smells', value: sonar.code_smells != null ? sonar.code_smells : 0 }),
        React.createElement(MetricRow, {
          label: 'Duplication',
          value: sonar.duplicated_lines_density != null ? Number(sonar.duplicated_lines_density).toFixed(1) : '0',
          unit: '%'
        }),
        React.createElement(MetricRow, {
          label: 'Coverage',
          value: sonar.coverage != null ? Number(sonar.coverage).toFixed(1) : '—',
          unit: '%'
        }),
        React.createElement(MetricRow, {
          label: 'Lines (ncloc)',
          value: sonar.ncloc != null && sonar.ncloc > 0 ? sonar.ncloc.toLocaleString() : '—'
        })
      )
    ),
    eslintAvailable && React.createElement('div', { className: 'code-quality-block' },
      React.createElement('h3', { className: 'code-quality-block-title' }, 'ESLint'),
      React.createElement('div', { className: 'code-quality-grid' },
        React.createElement(MetricRow, {
          label: 'Errors',
          value: eslint.errorCount != null ? eslint.errorCount : 0,
          highlight: (eslint.errorCount || 0) > 0
        }),
        React.createElement(MetricRow, {
          label: 'Warnings',
          value: eslint.warningCount != null ? eslint.warningCount : 0
        }),
        React.createElement(MetricRow, {
          label: 'Fixable',
          value: (eslint.fixableErrorCount || 0) + (eslint.fixableWarningCount || 0)
        })
      )
    )
  );
}

module.exports = { default: CodeQualitySection };
