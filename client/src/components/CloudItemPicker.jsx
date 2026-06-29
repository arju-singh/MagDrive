import { useEffect, useState, useCallback } from 'react';
import { api, srcThumbUrl } from '../api.js';
import { kindIconMarkup } from './kindIcon.js';

const KIND_TABS = [
  { key: '', label: 'All' },
  { key: 'image', label: 'Photos' },
  { key: 'video', label: 'Videos' },
  { key: 'pdf', label: 'PDFs' },
];
const SOURCE_LABEL = { local: 'My Library', demo: 'Demo Drive', google: 'Google Drive', dropbox: 'Dropbox' };

// Pick items from any source (local library or connected clouds) to add to a shelf.
export default function CloudItemPicker({ connections, onAdd, onClose }) {
  const sources = ['local', ...connections.map((c) => c.provider)];
  const [source, setSource] = useState(sources[0]);
  const [kind, setKind] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState({}); // key -> item

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (source === 'local') {
        const params = { limit: 60 };
        if (kind) params.kind = kind;
        const r = await api.listFiles(params);
        setItems(r.files.map((f) => ({ source: 'local', id: f.id, name: f.name, kind: f.kind })));
      } else {
        const r = await api.cloudFiles(source, kind ? { kind } : {});
        setItems(r.items);
      }
    } catch { setItems([]); } finally { setLoading(false); }
  }, [source, kind]);

  useEffect(() => { load(); }, [load]);

  const keyOf = (it) => `${it.source}:${it.id}`;
  const toggle = (it) => setSel((p) => { const k = keyOf(it); const n = { ...p }; if (n[k]) delete n[k]; else n[k] = it; return n; });
  const chosen = Object.values(sel);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860, height: '88vh' }}>
        <header>
          <div className="name" style={{ flex: 1 }}>Add to shelf</div>
          <button className="btn btn--sm btn--primary" disabled={!chosen.length} onClick={() => onAdd(chosen)}>Add {chosen.length || ''}</button>
          <button className="btn btn--sm btn--ghost" onClick={onClose}>✕</button>
        </header>
        <div className="body" style={{ display: 'block' }}>
          <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
            {sources.map((s) => (
              <button key={s} className={`chip ${source === s ? 'active' : ''}`} onClick={() => { setSource(s); setSel({}); }}>
                {SOURCE_LABEL[s] || s}
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
                <div key={keyOf(it)} className={`pick ${sel[keyOf(it)] ? 'sel' : ''}`} onClick={() => toggle(it)} title={it.name}>
                  <img src={srcThumbUrl(it)} alt={it.name} loading="lazy"
                    onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { className: 'docp', innerHTML: kindIconMarkup(it.kind) })); }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
