'use client';

import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  attachments?: string[];
}

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!input.trim() || sending) return;
    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, attachments: data.attachments }]);
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error de conexión: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh', maxWidth: 700 }}>
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, textAlign: m.role === 'user' ? 'right' : 'left' }}>
            <div
              style={{
                display: 'inline-block',
                background: m.role === 'user' ? '#1d4ed8' : '#222',
                color: 'white',
                padding: '8px 12px',
                borderRadius: 8,
                maxWidth: '80%',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
            {m.attachments?.map((url) => (
              <img key={url} src={url} alt="creativo" style={{ display: 'block', marginTop: 6, maxWidth: 200, borderRadius: 6 }} />
            ))}
          </div>
        ))}
        {sending && <p style={{ opacity: 0.6 }}>ALFA está pensando...</p>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Pedile algo a ALFA..."
          style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #2a2a2a', background: '#111', color: 'white' }}
        />
        <button onClick={send} disabled={sending} style={{ padding: '10px 16px', borderRadius: 6 }}>
          Enviar
        </button>
      </div>
    </div>
  );
}
