const React = require('react');

function TokenUsageSection(props) {
  const tokenUsage = (props.payload && props.payload.tokenUsage) || {};
  const available = tokenUsage.usageApiAvailable;
  return React.createElement('div', { className: 'token-usage-section' },
    available
      ? React.createElement('p', { className: 'token-usage-block' },
          'Input: ', tokenUsage.totalInput || 0,
          ' · Output: ', tokenUsage.totalOutput || 0,
          ' · Total: ', tokenUsage.totalTokens || 0
        )
      : React.createElement('p', { className: 'token-usage-block token-unavailable' },
          'Token usage unavailable (set session token via command palette).'
        )
  );
}

module.exports = { default: TokenUsageSection };
