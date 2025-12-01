import { useEffect, useRef, useState } from 'react';
import './App.css';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5175';

function App() {
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | waiting | paired
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [partnerStatus, setPartnerStatus] = useState(null); // null | 'left'
  const [partnerDraft, setPartnerDraft] = useState('');
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      setStatus('waiting');
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'waiting') {
        setStatus('waiting');
      }

      if (msg.type === 'paired') {
        setStatus('paired');
        setPartnerStatus(null);
        setPartnerDraft('');
        setMessages([]);
      }

      if (msg.type === 'message') {
        setMessages((prev) => [...prev, { from: 'them', text: msg.text }]);
        setPartnerDraft('');
      }

      if (msg.type === 'partner_left') {
        setPartnerStatus('left');
        setStatus('waiting');
        setPartnerDraft('');
      }

      if (msg.type === 'typing') {
        setPartnerDraft(msg.text || '');
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || status !== 'paired') return;
    wsRef.current.send(JSON.stringify({ type: 'message', text: input.trim() }));
    setMessages((prev) => [...prev, { from: 'me', text: input.trim() }]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);
    if (wsRef.current && status === 'paired') {
      wsRef.current.send(
        JSON.stringify({ type: 'typing', text: value })
      );
    }
  };

  const nextPartner = () => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'next' }));
    setMessages([]);
    setPartnerStatus(null);
    setStatus('waiting');
  };

  const statusLabel = {
    disconnected: 'offline',
    connecting: 'dialing...',
    waiting: 'waiting for someone...',
    paired: 'connected to a stranger',
  }[status];

  return (
    <div className="app">
      <div className="frame">
        <header className="top-bar">
          <div className="brand">STANFORD CHAT</div>
          <div className="status">
            <span className={`status-dot status-${status}`} />
            <span className="status-text">{statusLabel}</span>
          </div>
        </header>

        <main className="chat-area">
          <div className="messages">
            {messages.length === 0 && (
              <div className="system-line">
                {status === 'waiting'
                  ? 'you are in the lobby. waiting to be paired.'
                  : status === 'paired'
                  ? 'say hi. they do not know who you are.'
                  : 'press connect in another window to start talking.'}
              </div>
            )}
            {messages.map((m, index) => (
              <div
                key={index}
                className={`msg-row ${m.from === 'me' ? 'msg-me' : 'msg-them'}`}
              >
                <div className="msg-badge">
                  {m.from === 'me' ? 'you' : 'them'}
                </div>
                <div className="msg-bubble">{m.text}</div>
              </div>
            ))}
            {partnerStatus === 'left' && (
              <div className="system-line">
                stranger disconnected. press NEXT to find someone else.
              </div>
            )}
            {partnerDraft && status === 'paired' && (
              <div className="system-line">
                them is typing: <span className="ghost-text">{partnerDraft}</span>
              </div>
            )}
          </div>
        </main>

        <footer className="bottom-bar">
          <div className="input-row">
            <textarea
              className="input"
              placeholder={
                status === 'paired'
                  ? 'type to the stranger. enter sends.'
                  : 'waiting for connection...'
              }
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={status !== 'paired'}
              rows={2}
            />
            <div className="controls">
              <button
                className="button"
                onClick={sendMessage}
                disabled={status !== 'paired' || !input.trim()}
              >
                SEND
              </button>
              <button
                className="button secondary"
                onClick={nextPartner}
                disabled={status === 'disconnected' || status === 'connecting'}
              >
                NEXT
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
