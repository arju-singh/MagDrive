import { useState } from 'react';
import { mediaUrl, thumbUrl, formatBytes } from '../api.js';
import { KindIcon } from './kindIcon.js';

// Thumbnail with graceful fallback: try the cached server thumbnail first; if it 404s
// (unsupported kind / generator missing), fall back to rendering the original.
function Thumb({ file }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const canThumb = ['image', 'video', 'pdf'].includes(file.kind);

  if (canThumb && !thumbFailed) {
    return (
      <div className={file.kind === 'video' ? 'video-thumb' : undefined}>
        <img src={thumbUrl(file.id)} alt={file.name} loading="lazy" onError={() => setThumbFailed(true)} />
        {file.kind === 'video' && <span className="play-badge">▶</span>}
      </div>
    );
  }

  // Fallbacks (thumbnail unavailable)
  if (file.kind === 'image') return <img src={mediaUrl(file.id)} alt={file.name} loading="lazy" />;
  if (file.kind === 'video') {
    return (
      <div className="video-thumb">
        <video src={mediaUrl(file.id)} preload="metadata" muted />
        <span className="play-badge">▶</span>
      </div>
    );
  }
  if (file.kind === 'pdf') {
    return (
      <div className="pdf-thumb">
        <iframe src={`${mediaUrl(file.id)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&page=1`} title={file.name} tabIndex={-1} loading="lazy" />
      </div>
    );
  }
  const ext = (file.name.split('.').pop() || file.kind).toUpperCase().slice(0, 5);
  return (
    <div className={`doc-thumb kind-${file.kind}`}>
      <KindIcon kind={file.kind} size={56} />
      <span className="doc-ext">{ext}</span>
    </div>
  );
}

// A single magazine-style media tile.
export default function FileTile({ file, onOpen, onToggleStar }) {
  return (
    <figure className="tile" onClick={() => onOpen(file)} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(file); }}>
      <span className="kind-flag">{file.kind}</span>
      <button className="star" title={file.starred ? 'Unstar' : 'Star'}
        onClick={(e) => { e.stopPropagation(); onToggleStar(file); }}>
        {file.starred ? '★' : '☆'}
      </button>

      <Thumb file={file} />

      <figcaption className="cap">
        <div className="name" title={file.name}>{file.name}</div>
        <div className="meta">{formatBytes(file.size)} · {new Date(file.createdAt).toLocaleDateString()}</div>
      </figcaption>
    </figure>
  );
}
