const React = require('react');
const MetersSection = require('./MetersSection').default;
const TokenUsageSection = require('./TokenUsageSection').default;
const FilesSection = require('./FilesSection').default;
const OutputSection = require('./OutputSection').default;
const ChatSection = require('./ChatSection').default;
const ResearchSection = require('./ResearchSection').default;

const defaultPayload = {
  currentMode: 'dev',
  scoreData: { total: 0, components: {} },
  scoreBreakdown: null,
  antipatternBreakdown: {},
  events: [],
  tokenUsage: { totalInput: 0, totalOutput: 0, totalTokens: 0, usageApiAvailable: false },
  capabilities: { git: false, ast: false, tasksObserved: false, usageApiAvailable: false },
  sessionView: [],
  moduleView: { modules: {} }
};

function getInitialPayload() {
  try {
    if (typeof document === 'undefined') return defaultPayload;
    var raw = null;
    var root = document.getElementById('root');
    if (root && root.getAttribute) raw = root.getAttribute('data-initial-payload');
    if (!raw && typeof window !== 'undefined' && window.__VIBESWITCH_INITIAL_PAYLOAD__) raw = window.__VIBESWITCH_INITIAL_PAYLOAD__;
    if (raw && typeof raw === 'string') {
      var parsed = JSON.parse(raw);
      return { ...defaultPayload, ...parsed };
    }
  } catch (_) {}
  return defaultPayload;
}

function App({ vscode }) {
  const [payload, setPayload] = React.useState(getInitialPayload);

  React.useEffect(() => {
    if (!vscode) return;
    const onMessage = (event) => {
      const msg = event.data;
        if (msg && (msg.type === 'init' || msg.type === 'update') && msg.payload) {
        const next = msg.payload;
        setPayload((prev) => {
          const merged = { ...prev, ...next };
          if (next.scoreData && typeof next.scoreData === 'object') {
            merged.scoreData = typeof prev.scoreData === 'object'
              ? { ...prev.scoreData, ...next.scoreData }
              : { ...next.scoreData };
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
      <section className="dashboard-section dashboard-research">
        <ResearchSection payload={payload} />
      </section>
      <section className="dashboard-section dashboard-chat">
        <h2>Chat</h2>
        <ChatSection payload={payload} sendChat={sendChat} vscode={vscode} />
      </section>
    </div>
  );
}

module.exports = { default: App };
