import { useRef } from 'react';
import MediaCard from './MediaCard.jsx';

// A horizontally-scrolling Netflix row with prev/next controls.
export default function Row({ title, kicker, items, onOpen, onRemove, actions }) {
  const track = useRef(null);
  const scroll = (dir) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: 'smooth' });

  return (
    <section className="nrow">
      <div className="nrow-head">
        <div>
          {kicker && <div className="nrow-kicker">{kicker}</div>}
          <h2 className="nrow-title">{title}</h2>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {actions}
          {items.length > 0 && (
            <>
              <button className="nrow-arrow" onClick={() => scroll(-1)} aria-label="Scroll left">‹</button>
              <button className="nrow-arrow" onClick={() => scroll(1)} aria-label="Scroll right">›</button>
            </>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="nrow-empty muted">Nothing here yet.</div>
      ) : (
        <div className="nrow-track" ref={track}>
          {items.map((it) => (
            <MediaCard key={`${it.source}:${it.id}`} item={it} onOpen={onOpen} onRemove={onRemove} />
          ))}
        </div>
      )}
    </section>
  );
}
