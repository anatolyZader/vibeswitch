const React = require('react');
const MetersSection = require('./MetersSection').default;
const TokenUsageSection = require('./TokenUsageSection').default;
const FilesSection = require('./FilesSection').default;
const OutputSection = require('./OutputSection').default;
const ChatSection = require('./ChatSection').default;

const defaultPayload = {
  currentMode: 'dev',
  scoreData: { total: 0, components: {} },
  scoreBreakdown: null,
  antipatternBreakdown: {},
  events: [],
  tokenUsage: { totalInput: 0, totalOutput: 0, totalTokens: 0, usageApiAvailable: false },
  capabilities: { git: false, ast: false, tasksObserved: false, usageApiAvailable: false }
};

function App({ vscode }) {
  const [payload, setPayload] = React.useState(defaultPayload);

  React.useEffect(() => {
    if (!vscode) return;
    const onMessage = (event) => {
      const msg = event.data;
      if (msg && (msg.type === 'init' || msg.type === 'update') && msg.payload) {
        const next = msg.payload;
        setPayload((prev) => {
          const merged = { ...prev, ...next };
          if (next.scoreData && typeof next.scoreData === 'object' && typeof prev.scoreData === 'object') {
            merged.scoreData = {
              ...prev.scoreData,
              ...next.scoreData,
              unopenedFiles: next.scoreData.unopenedFiles != null ? next.scoreData.unopenedFiles : prev.scoreData.unopenedFiles,
              unreviewedSuggestions: next.scoreData.unreviewedSuggestions != null ? next.scoreData.unreviewedSuggestions : prev.scoreData.unreviewedSuggestions
            };
          }
          return merged;
        });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [vscode]);

  const sendChat = React.useCallback((id, text) => {
    if (vscode && id && text && text.trim()) {
      vscode.postMessage({ command: 'chat', id, text: text.trim() });
    }
  }, [vscode]);

  return (
    <div className="vibeswitch-dashboard">
      <header className="dashboard-header">
        <h1>VibeSwitch Dashboard</h1>
        <p className="dashboard-meta">
          Mode: {(payload.currentMode || 'unknown').toUpperCase()} &middot; Risk: {Math.max(0, Math.min(100, payload.scoreData?.total ?? 0))}/100
        </p>
      </header>
      <section className="dashboard-section dashboard-meters">
        <h2>Meters</h2>
        <MetersSection payload={payload} />
      </section>
      <section className="dashboard-section dashboard-token-usage">
        <h2>Token usage</h2>
        <TokenUsageSection payload={payload} />
      </section>
      <section className="dashboard-section dashboard-files">
        <h2>Unopened files and unreviewed changes</h2>
        <FilesSection payload={payload} />
      </section>
      <section className="dashboard-section dashboard-output">
        <h2>Output</h2>
        <OutputSection payload={payload} />
      </section>
      <section className="dashboard-section dashboard-chat">
        <h2>Chat</h2>
        <ChatSection payload={payload} sendChat={sendChat} vscode={vscode} />
      </section>
    </div>
  );
}

module.exports = { default: App };
