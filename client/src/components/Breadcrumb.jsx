import { useState } from 'react';
import Icon from './Icon.jsx';

// Folder breadcrumb. `trail` is [{ id, name }] from root → current.
// Each crumb navigates on click and accepts a dropped file (move to that level).
export default function Breadcrumb({ trail, onNavigate, onDropFile }) {
  const crumbs = [{ id: 'root', name: 'Library' }, ...trail];

  return (
    <nav className="breadcrumb" aria-label="Folder path">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.id} className="crumb-wrap">
            {i > 0 && <span className="crumb-sep">/</span>}
            <Crumb crumb={c} index={i} last={last} onNavigate={onNavigate} onDropFile={onDropFile} />
          </span>
        );
      })}
    </nav>
  );
}

function Crumb({ crumb, index, last, onNavigate, onDropFile }) {
  const [over, setOver] = useState(false);
  return (
    <button
      className={`crumb ${last ? 'current' : ''} ${over ? 'drop-over' : ''}`}
      onClick={() => !last && onNavigate?.(index)}
      disabled={last}
      onDragOver={(e) => { if (!last && e.dataTransfer.types.includes('text/magdrive-file')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (last) return;
        const fileId = e.dataTransfer.getData('text/magdrive-file');
        if (fileId) { e.preventDefault(); onDropFile?.(fileId, crumb.id); }
      }}
    >
      {index === 0 && <Icon name="library" size={14} />}
      {crumb.name}
    </button>
  );
}
