const React = require('react');
function OutputSection(props) {
  const messages = (props.payload && props.payload.events) || [];
  const capabilities = (props.payload && props.payload.capabilities) || {};
  return React.createElement('div', { className: 'output-section' },
    messages.length === 0
      ? React.createElement('p', { className: 'output-empty' }, 'No antipattern messages.')
      : React.createElement('ul', { className: 'output-messages' },
          messages.slice(0, 30).map(function (e, i) {
            const text = [e.label || e.type, e.detail].filter(Boolean).join(' — ') || 'Antipattern reported';
            return React.createElement('li', { key: i, className: 'output-entry event-sev-' + (e.severity || 'info') }, text);
          })
        ),
    React.createElement('p', { className: 'capabilities-note' }, 'Capabilities: git ' + (capabilities.git ? 'on' : 'off') + ', ast ' + (capabilities.ast ? 'on' : 'off') + ', usage API ' + (capabilities.usageApiAvailable ? 'on' : 'off'))
  );
}
module.exports = { default: OutputSection };
