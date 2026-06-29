import { useState } from 'react';
import Icon from './Icon.jsx';

// A folder card in the library. Click to open; rename/delete inline.
// Acts as a drop target — drop a file tile onto it to move that file in.
export default function FolderTile({ folder, onOpen, onRename, onDelete, onDropFile }) {
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(folder.name);
  const [over, setOver] = useState(false);

  function saveName() {
    const next = name.trim();
    setRenaming(false);
    if (!next || next === folder.name) { setName(folder.name); return; }
    onRename?.(folder, next);
  }

  return (
    <div
      className={`folder-tile ${over ? 'drop-over' : ''}`}
      onClick={() => !renaming && onOpen?.(folder)}
      onKeyDown={(e) => { if (e.key === 'Enter' && !renaming) onOpen?.(folder); }}
      tabIndex={0}
      role="button"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('text/magdrive-file')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const fileId = e.dataTransfer.getData('text/magdrive-file');
        if (fileId) { e.preventDefault(); onDropFile?.(fileId, folder.id); }
      }}
      title={folder.name}
    >
      <span className="folder-ico"><Icon name="folder" size={26} /></span>

      {renaming ? (
        <input
          className="input folder-rename"
          autoFocus
          value={name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setName(folder.name); setRenaming(false); } }}
        />
      ) : (
        <span className="folder-name">{folder.name}</span>
      )}

      <span className="folder-actions" onClick={(e) => e.stopPropagation()}>
        {confirming ? (
          <>
            <button className="folder-act danger" title="Confirm delete" onClick={() => { setConfirming(false); onDelete?.(folder); }} aria-label="Confirm delete">✓</button>
            <button className="folder-act" title="Cancel" onClick={() => setConfirming(false)} aria-label="Cancel delete">✕</button>
          </>
        ) : (
          <>
            <button className="folder-act" title="Rename" onClick={() => setRenaming(true)} aria-label="Rename folder">✎</button>
            <button className="folder-act" title="Delete" onClick={() => setConfirming(true)} aria-label="Delete folder">🗑</button>
          </>
        )}
      </span>
    </div>
  );
}
