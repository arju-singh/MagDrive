import { useEffect, useState } from 'react';
import { api, mediaUrl, thumbUrl } from '../api.js';
import { icon } from './kindIcon.js';

// Modal to pick file(s) from the user's library. multiple=false returns one id.
export default function FilePicker({ multiple = false, kind = '', onPick, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState([]);

  useEffect(() => {
    const params = { limit: 200 };
    if (kind) params.kind = kind;
    api.listFiles(params).then((r) => setFiles(r.files)).finally(() => setLoading(false));
  }, [kind]);

  function toggle(id) {
    if (!multiple) { onPick(id); return; }
    setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <header>
          <div className="name" style={{ flex: 1 }}>Choose {multiple ? 'files' : 'a file'} {kind ? `(${kind})` : ''}</div>
          {multiple && <button className="btn btn--sm btn--primary" disabled={!sel.length} onClick={() => onPick(sel)}>Add {sel.length || ''}</button>}
          <button className="btn btn--sm btn--ghost" onClick={onClose}>✕</button>
        </header>
        <div className="body" style={{ display: 'block' }}>
          {loading ? (
            <div className="empty"><span className="spinner" /></div>
          ) : files.length === 0 ? (
            <div className="empty"><p className="muted">No files yet — upload some from The Library first.</p></div>
          ) : (
            <div className="picker-grid">
              {files.map((f) => (
                <div key={f.id} className={`pick ${sel.includes(f.id) ? 'sel' : ''}`} onClick={() => toggle(f.id)} title={f.name}>
                  {f.kind === 'image' || f.kind === 'video'
                    ? <img src={thumbUrl(f.id)} alt={f.name} loading="lazy" onError={(e) => { e.currentTarget.src = mediaUrl(f.id); }} />
                    : <div className="docp">{icon(f.kind)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
