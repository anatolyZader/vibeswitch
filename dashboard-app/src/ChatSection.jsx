const React = require('react');
function ChatSection(props) {
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [pendingId, setPendingId] = React.useState(null);
  const listRef = React.useRef(null);
  const vscode = props.vscode;
  React.useEffect(function () {
    if (!vscode) return;
    function onMessage(event) {
      const msg = event.data;
      if (msg && msg.command === 'chatReply') {
        setMessages(function (prev) {
          const next = prev.map(function (m) { return m.id === msg.id ? Object.assign({}, m, { reply: msg.text, error: msg.error }) : m; });
          if (next.every(function (m) { return m.id !== msg.id; })) next.push({ id: msg.id, text: '', reply: msg.text, error: msg.error });
          return next;
        });
        setPendingId(function (id) { return id === msg.id ? null : id; });
      }
    }
    window.addEventListener('message', onMessage);
    return function () { return window.removeEventListener('message', onMessage); };
  }, [vscode]);
  React.useEffect(function () {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);
  function onSend() {
    if (!input.trim()) return;
    const id = Date.now().toString();
    setMessages(function (prev) { return prev.concat([{ id: id, text: input.trim(), reply: null, error: null }]); });
    setInput('');
    setPendingId(id);
    props.sendChat(id, input.trim());
  }
  return React.createElement('div', { className: 'chat-section' },
    React.createElement('p', { className: 'chat-hint' }, 'Discuss the dashboard with the read-only subagent (no file edits or commands).'),
    React.createElement('div', { className: 'chat-messages', ref: listRef },
      messages.length === 0 && React.createElement('div', { className: 'chat-placeholder' }, 'No messages yet.'),
      messages.map(function (m) {
        return React.createElement('div', { key: m.id, className: 'chat-message' },
          React.createElement('div', { className: 'chat-user' }, React.createElement('strong', null, 'You:'), ' ', m.text),
          m.reply != null && React.createElement('div', { className: 'chat-assistant' }, React.createElement('strong', null, 'Assistant:'), ' ', m.reply),
          m.error && React.createElement('div', { className: 'chat-error' }, m.error),
          pendingId === m.id && React.createElement('div', { className: 'chat-assistant chat-typing' }, '…')
        );
      })
    ),
    React.createElement('div', { className: 'chat-input-row' },
      React.createElement('input', {
        type: 'text',
        className: 'chat-input',
        placeholder: 'Ask about metrics or events…',
        value: input,
        onChange: function (e) { return setInput(e.target.value); },
        onKeyDown: function (e) { if (e.key === 'Enter' && !e.shiftKey) onSend(); }
      }),
      React.createElement('button', { type: 'button', className: 'chat-send', onClick: onSend, disabled: !input.trim() }, 'Send')
    )
  );
}
module.exports = { default: ChatSection };
