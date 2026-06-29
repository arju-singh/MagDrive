import { useEffect, useState, useCallback } from 'react';
import { api, srcThumbUrl } from '../api.js';
import { kindIconMarkup } from './kindIcon.js';
import Icon from './Icon.jsx';

const KIND_TABS = [
  { key: '', label: 'All' },
  { key: 'image', label: 'Photos' },
  { key: 'video', label: 'Videos' },
  { key: 'pdf', label: 'PDFs' },
];
const SOURCE_LABEL = { demo: 'Demo Drive', google: 'Google Drive', dropbox: 'Dropbox' };
const PROVIDER_BLURB = {
  google: 'Browse your Google Drive photos, videos & PDFs.',
  dropbox: 'Browse files from your Dropbox.',
  demo: 'A sample drive with photos, clips & docs — no account needed.',
};

// Connect a drive, browse its gallery, and IMPORT the selected photos/videos/PDFs
// into the local library. Imported copies are permanent and independent of the source.
export default function ImportDrive({ onImported, onClose }) {
  const [conns, setConns] = useState([]);
  const [available, setAvailable] = useState([]);
  const [source, setSource] = useState('');      // active connected cloud provider
  const [kind, setKind] = useState('');
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState({});            // id -> item
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');          // provider key being connected
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(null);        // { imported, failed }
  const [err, setErr] = useState('');

  const cloudConns = conns.filter((c) => c.provider !== 'local');

  const loadConns = useCallback(async () => {
    const { connections, available: avail } = await api.connections();
    setConns(connections);
    setAvailable(avail);
    const cloud = connections.filter((c) => c.provider !== 'local');
    setSource((s) => s || (cloud[0]?.provider ?? ''));
    return cloud;
  }, []);

  useEffect(() => { loadConns().finally(() => setLoading(false)); }, [loadConns]);

  // Load gallery whenever the active source/kind changes.
  const loadGallery = useCallback(async () => {
    if (!source) { setItems([]); return; }
    setLoading(true);
    try {
      const r = await api.cloudFiles(source, kind ? { kind } : {});
      setItems(r.items || []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [source, kind]);

  useEffect(() => { setSel({}); loadGallery(); }, [loadGallery]);

  async function connect(p) {
    setBusy(p.key); setErr('');
    try {
      const res = await api.connect(p.key);
      if (res.url) { window.location.href = res.url; return; } // OAuth bounce (Google/Dropbox)
      const cloud = await loadConns();                          // Demo connects instantly
      setSource(p.key);
      if (!cloud.length) setErr('Could not connect.');
    } catch { setErr('Could not connect.'); } finally { setBusy(''); }
  }

  const toggle = (it) => setSel((p) => { const n = { ...p }; if (n[it.id]) delete n[it.id]; else n[it.id] = it; return n; });
  const chosen = Object.values(sel);

  async function runImport() {
    if (!chosen.length) return;
    setImporting(true); setErr('');
    try {
      const r = await api.cloudImport(source, chosen.map(({ id, name, mime, kind: k }) => ({ id, name, mime, kind: k })));
      onImported?.(r.files || []);
      setDone({ imported: r.imported || 0, failed: (r.failed || []).length });
      setSel({});
    } catch (ex) {
      setErr(ex.status === 409 ? 'Drive not connected.' : 'Import failed. Please try again.');
    } finally { setImporting(false); }
  }

  // Providers offered to connect that aren't connected yet.
  const connectable = available.filter((p) => !conns.some((c) => c.provider === p.key));
  const gated = ['google', 'dropbox'].filter((k) => !available.some((p) => p.key === k));

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 880, height: '88vh' }}>
        <header>
          <span style={{ display: 'inline-flex' }}><Icon name="upload" size={18} /></span>
          <div className="name" style={{ flex: 1 }}>Import from a drive</div>
          {source && (
            <button className="btn btn--sm btn--primary" disabled={!chosen.length || importing} onClick={runImport}>
              {importing ? <span className="spinner" /> : `Import ${chosen.length || ''} to Library`}
            </button>
          )}
          <button className="btn btn--sm btn--ghost" onClick={onClose}>✕</button>
        </header>

        <div className="body" style={{ display: 'block' }}>
          {done && (
            <div className="verify-banner verify-banner--ok" style={{ marginBottom: 14 }}>
              ✓ Imported {done.imported} file{done.imported === 1 ? '' : 's'} into your library
              {done.failed ? ` · ${done.failed} failed` : ''}.
            </div>
          )}
          {err && <div className="err" style={{ marginBottom: 14 }}>{err}</div>}

          {/* No cloud connected yet → show connect cards */}
          {!cloudConns.length ? (
            loading ? (
              <div className="empty"><span className="spinner" /></div>
            ) : (
              <div className="stack">
                <p className="muted">Connect a drive to import your photos, videos and PDFs into MagDrive. Your files are <strong>copied</strong> in — nothing in the source drive is changed or deleted.</p>
                {connectable.map((p) => (
                  <div key={p.key} className="conn-row">
                    <div className="conn-emoji"><Icon name={p.key === 'google' ? 'library' : p.key === 'dropbox' ? 'other' : 'browse'} size={26} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800 }}>{p.label}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{PROVIDER_BLURB[p.key]}</div>
                    </div>
                    <button className="btn btn--sm btn--primary" disabled={busy === p.key} onClick={() => connect(p)}>
                      {busy === p.key ? <span className="spinner" /> : 'Connect'}
                    </button>
                  </div>
                ))}
                {gated.length > 0 && (
                  <p className="muted" style={{ fontSize: 12 }}>
                    {gated.map((g) => (g === 'google' ? 'Google Drive' : 'Dropbox')).join(' & ')} need OAuth credentials in <code>server/.env</code> to appear here.
                  </p>
                )}
              </div>
            )
          ) : (
            <>
              {/* Source + kind filters */}
              <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
                {cloudConns.map((c) => (
                  <button key={c.provider} className={`chip ${source === c.provider ? 'active' : ''}`} onClick={() => setSource(c.provider)}>
                    {SOURCE_LABEL[c.provider] || c.provider}
                  </button>
                ))}
              </div>
              <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
                {KIND_TABS.map((t) => (
                  <button key={t.key} className={`chip ${kind === t.key ? 'active' : ''}`} onClick={() => setKind(t.key)}>{t.label}</button>
                ))}
              </div>

              {loading ? (
                <div className="empty"><span className="spinner" /></div>
              ) : items.length === 0 ? (
                <div className="empty"><p className="muted">No items here.</p></div>
              ) : (
                <div className="picker-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', maxHeight: 'none' }}>
                  {items.map((it) => (
                    <div key={it.id} className={`pick ${sel[it.id] ? 'sel' : ''}`} onClick={() => toggle(it)} title={it.name}>
                      <img src={srcThumbUrl(it)} alt={it.name} loading="lazy"
                        onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { className: 'docp', innerHTML: kindIconMarkup(it.kind) })); }} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
