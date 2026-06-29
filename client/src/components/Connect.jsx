import { useState } from 'react';
import { api } from '../api.js';

const PROVIDER_META = {
  google: { emoji: '🟢', blurb: 'Browse your Google Drive photos, videos & PDFs.' },
  dropbox: { emoji: '🔵', blurb: 'Browse files from your Dropbox.' },
  demo: { emoji: '🎬', blurb: 'A sample drive with photos, clips & docs — no account needed.' },
};

// Connect / disconnect cloud accounts. OAuth providers navigate the browser to consent.
export default function Connect({ connections, available, onChanged, onClose }) {
  const [busy, setBusy] = useState('');
  const connected = new Set(connections.map((c) => c.provider));

  async function connect(p) {
    setBusy(p.key);
    try {
      const res = await api.connect(p.key);
      if (res.url) { window.location.href = res.url; return; } // OAuth bounce
      onChanged?.();
    } finally { setBusy(''); }
  }
  async function disconnect(key) {
    setBusy(key);
    try { await api.disconnect(key); onChanged?.(); } finally { setBusy(''); }
  }

  // Show configured providers; always include demo. Note any gated (unconfigured) ones.
  const offered = available;
  const offeredKeys = new Set(offered.map((p) => p.key));
  const gated = ['google', 'dropbox'].filter((k) => !offeredKeys.has(k));

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <header>
          <div className="name" style={{ flex: 1 }}>Connect a drive</div>
          <button className="btn btn--sm btn--ghost" onClick={onClose}>✕</button>
        </header>
        <div className="body" style={{ display: 'block' }}>
          <div className="stack">
            {offered.map((p) => {
              const meta = PROVIDER_META[p.key] || {};
              const isOn = connected.has(p.key);
              return (
                <div key={p.key} className="conn-row">
                  <div className="conn-emoji">{meta.emoji || '☁️'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{p.label}{isOn && <span className="conn-on"> connected</span>}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{meta.blurb}</div>
                  </div>
                  {isOn
                    ? <button className="btn btn--sm btn--danger" disabled={busy === p.key} onClick={() => disconnect(p.key)}>Disconnect</button>
                    : <button className="btn btn--sm btn--primary" disabled={busy === p.key} onClick={() => connect(p)}>{busy === p.key ? <span className="spinner" /> : 'Connect'}</button>}
                </div>
              );
            })}
          </div>

          {gated.length > 0 && (
            <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
              {gated.map((g) => g === 'google' ? 'Google Drive' : 'Dropbox').join(' & ')} need OAuth credentials in
              {' '}<code>server/.env</code> to appear here (see setup notes in <code>.env.example</code>).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
