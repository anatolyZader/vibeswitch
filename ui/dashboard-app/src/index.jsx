const React = require('react');
const ReactDOM = require('react-dom/client');
const App = require('./App').default;
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;
const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(App, { vscode }));
}
