import { useEffect } from 'react';
import { srcMediaUrl } from '../api.js';
import { KindIcon } from './kindIcon.js';

// Universal viewer for any-source item (local or cloud). Read-only (no rename/delete).
export default function MediaModal({ item, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const url = srcMediaUrl(item);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div className="name" style={{ flex: 1 }} title={item.name}>{item.name}</div>
          <a className="btn btn--sm" href={url} target="_blank" rel="noreferrer">Open original</a>
          <button className="btn btn--sm btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="body">
          {item.kind === 'image' && <img src={url} alt={item.name} />}
          {item.kind === 'video' && <video src={url} controls autoPlay style={{ maxHeight: '70vh' }} />}
          {item.kind === 'audio' && <audio src={url} controls style={{ width: '100%' }} />}
          {item.kind === 'pdf' && <iframe title={item.name} src={url} />}
          {(item.kind === 'doc' || item.kind === 'other') && (
            <div className="center" style={{ padding: 40 }}>
              <div><KindIcon kind={item.kind} size={64} /></div>
              <a className="btn btn--primary" href={url} target="_blank" rel="noreferrer">Open original</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
