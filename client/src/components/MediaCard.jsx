import { useState } from 'react';
import { srcThumbUrl } from '../api.js';
import { KindIcon } from './kindIcon.js';

const SOURCE_BADGE = { local: 'Library', demo: 'Demo', google: 'Drive', dropbox: 'Dropbox' };

// A Netflix-style landscape card for any normalized item ({source,id,name,kind}).
export default function MediaCard({ item, onOpen, onRemove }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="ncard" onClick={() => onOpen?.(item)} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(item); }}>
      {!failed
        ? <img className="ncard-img" src={srcThumbUrl(item)} alt={item.name} loading="lazy" onError={() => setFailed(true)} />
        : <div className="ncard-fallback"><KindIcon kind={item.kind} size={42} /></div>}
      {item.kind === 'video' && <span className="ncard-play">▶</span>}
      <span className="ncard-source">{SOURCE_BADGE[item.source] || item.source}</span>
      {onRemove && (
        <button className="ncard-remove" title="Remove from shelf"
          onClick={(e) => { e.stopPropagation(); onRemove(item); }}>✕</button>
      )}
      <div className="ncard-cap"><span className="ncard-name" title={item.name}>{item.name}</span></div>
    </div>
  );
}
