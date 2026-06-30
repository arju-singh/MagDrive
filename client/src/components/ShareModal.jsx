import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';

// Create / show / revoke a public link for a file or magazine.
// `target` = { type: 'file' | 'magazine', id, title }.
export default function ShareModal({ target, onClose }) {
  const [share, setShare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    api.getShare(target.type, target.id)
      .then((r) => { if (live) setShare(r.share); })
      .catch(() => { if (live) setErr('Could not load sharing status.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [target.type, target.id]);

  const link = share ? `${window.location.origin}/s/${share.token}` : '';

  async function create() {
    setBusy(true); setErr('');
    try { setShare((await api.createShare(target.type, target.id)).share); }
    catch { setErr('Could not create a link.'); }
    finally { setBusy(false); }
  }
  async function revoke() {
    setBusy(true); setErr('');
    try { await api.deleteShare(share.id); setShare(null); setCopied(false); }
    catch { setErr('Could not stop sharing.'); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* clipboard blocked — the field is selectable as a fallback */ }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <span style={{ display: 'inline-flex' }}><Icon name="share" size={18} /></span>
          <div className="name" style={{ flex: 1 }}>Share “{target.title}”</div>
          <button className="btn btn--sm btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="share-body">
          {loading ? (
            <div className="center" style={{ padding: 24 }}><span className="spinner" /></div>
          ) : share ? (
            <>
              <p className="muted">Anyone with this link can view {target.type === 'magazine' ? 'this magazine' : 'this file'} — no account needed.</p>
              <div className="share-link">
                <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} />
                <button className="btn btn--primary" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 'var(--sp-3)' }}>
                <a className="btn btn--sm btn--ghost" href={link} target="_blank" rel="noreferrer">Open link ↗</a>
                <button className="btn btn--sm btn--danger" onClick={revoke} disabled={busy}>Stop sharing</button>
              </div>
            </>
          ) : (
            <>
              <p className="muted">Create a public link anyone can open — no sign-in required. You can revoke it anytime.</p>
              <button className="btn btn--primary" onClick={create} disabled={busy}>
                {busy ? <span className="spinner" /> : <><Icon name="share" size={15} /> Create public link</>}
              </button>
            </>
          )}
          {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}
