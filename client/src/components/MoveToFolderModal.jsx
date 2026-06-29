import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';

// Drill-through folder picker. Browse into subfolders, then "Move here" moves the
// file to whatever folder is currently open (root = top of the library).
export default function MoveToFolderModal({ file, onMoved, onClose }) {
  const [trail, setTrail] = useState([]); // [{ id, name }]
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const current = trail.length ? trail[trail.length - 1] : { id: 'root', name: 'Library' };
  const alreadyHere = (file.folderId || 'root') === current.id;

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.listFolders(current.id).then((res) => { if (live) setFolders(res.folders); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [current.id]);

  async function move() {
    if (alreadyHere) return;
    setBusy(true);
    try {
      const { file: updated } = await api.patchFile(file.id, { folderId: current.id });
      onMoved?.(updated);
    } finally { setBusy(false); }
  }

  const crumbs = [{ id: 'root', name: 'Library' }, ...trail];

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal move-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div className="name" style={{ flex: 1 }}>Move “{file.name}”</div>
          <button className="btn btn--sm btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="move-path">
          {crumbs.map((c, i) => (
            <span key={c.id} className="crumb-wrap">
              {i > 0 && <span className="crumb-sep">/</span>}
              <button className={`crumb ${i === crumbs.length - 1 ? 'current' : ''}`}
                disabled={i === crumbs.length - 1}
                onClick={() => setTrail(trail.slice(0, i))}>
                {c.name}
              </button>
            </span>
          ))}
        </div>

        <div className="move-list">
          {loading ? (
            <div className="center" style={{ padding: 24 }}><span className="spinner" /></div>
          ) : folders.length === 0 ? (
            <p className="muted" style={{ padding: '12px 4px' }}>No subfolders here.</p>
          ) : (
            folders.map((f) => (
              <button key={f.id} className="move-row" onClick={() => setTrail([...trail, { id: f.id, name: f.name }])}>
                <Icon name="folder" size={20} /> <span>{f.name}</span>
                <span className="move-row-go">›</span>
              </button>
            ))
          )}
        </div>

        <footer className="move-foot">
          <span className="muted">Destination: <strong>{current.name}</strong></span>
          <button className="btn btn--primary" onClick={move} disabled={busy || alreadyHere}>
            {alreadyHere ? 'Already here' : busy ? 'Moving…' : 'Move here'}
          </button>
        </footer>
      </div>
    </div>
  );
}
