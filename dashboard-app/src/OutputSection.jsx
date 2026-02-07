const React = require('react');
function OutputSection(props) {
  const events = (props.payload && props.payload.events) || [];
  const tokenUsage = (props.payload && props.payload.tokenUsage) || {};
  const capabilities = (props.payload && props.payload.capabilities) || {};
  const available = tokenUsage.usageApiAvailable;
  return React.createElement('div', { className: 'output-section' },
    React.createElement('div', { className: 'token-usage-block' },
      available
        ? React.createElement('span', null, 'Token usage — Input: ', tokenUsage.totalInput || 0, ', Output: ', tokenUsage.totalOutput || 0, ', Total: ', tokenUsage.totalTokens || 0)
        : React.createElement('span', { className: 'token-unavailable' }, 'Token usage unavailable (set session token via command palette).')
    ),
    React.createElement('h3', null, 'Events'),
    React.createElement('ul', { className: 'events-list' },
      events.length === 0 ? React.createElement('li', null, React.createElement('em', null, 'No events')) : events.slice(0, 30).map(function (e, i) {
        return React.createElement('li', { key: i, className: 'event-sev-' + (e.severity || 'info') },
          React.createElement('code', null, e.ts ? new Date(e.ts).toLocaleTimeString() : ''),
          ' ', e.label || e.type || '', e.detail ? ' — ' + e.detail : ''
        );
      })
    ),
    React.createElement('p', { className: 'capabilities-note' }, 'Capabilities: git ' + (capabilities.git ? 'on' : 'off') + ', ast ' + (capabilities.ast ? 'on' : 'off') + ', usage API ' + (capabilities.usageApiAvailable ? 'on' : 'off'))
  );
}
module.exports = { default: OutputSection };
