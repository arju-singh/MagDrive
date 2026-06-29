import { useEffect, useState } from 'react';
import { mediaUrl, formatBytes, api } from '../api.js';
import { KindIcon } from './kindIcon.js';

// Full-screen viewer for a file. Handles image / video / audio / pdf / fallback download.
export default function Viewer({ file, onClose, onChanged, onDeleted }) {
  const [name, setName] = useState(file.name);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function saveName() {
    const next = name.trim();
    if (!next || next === file.name) { setRenaming(false); return; }
    setBusy(true);
    try {
      const { file: updated } = await api.patchFile(file.id, { name: next });
      onChanged?.(updated);
      setRenaming(false);
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm(`Delete "${file.name}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteFile(file.id);
      onDeleted?.(file.id);
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          {renaming ? (
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }} style={{ flex: 1 }} />
          ) : (
            <div className="name" style={{ flex: 1 }} title={file.name}>{file.name}</div>
          )}
          {renaming ? (
            <button className="btn btn--sm btn--primary" onClick={saveName} disabled={busy}>Save</button>
          ) : (
            <button className="btn btn--sm" onClick={() => setRenaming(true)}>Rename</button>
          )}
          <a className="btn btn--sm" href={mediaUrl(file.id, { download: true })} download>Download</a>
          <button className="btn btn--sm btn--danger" onClick={remove} disabled={busy}>Delete</button>
          <button className="btn btn--sm btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="body">
          {file.kind === 'image' && <img src={mediaUrl(file.id)} alt={file.name} />}
          {file.kind === 'video' && <video src={mediaUrl(file.id)} controls autoPlay style={{ maxHeight: '70vh' }} />}
          {file.kind === 'audio' && <audio src={mediaUrl(file.id)} controls style={{ width: '100%' }} />}
          {file.kind === 'pdf' && <iframe title={file.name} src={mediaUrl(file.id)} />}
          {(file.kind === 'doc' || file.kind === 'other') && (
            <div className="center" style={{ padding: 40 }}>
              <div><KindIcon kind={file.kind} size={64} /></div>
              <p className="muted">{formatBytes(file.size)} · {file.mime}</p>
              <a className="btn btn--primary" href={mediaUrl(file.id, { download: true })} download>Download to view</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
