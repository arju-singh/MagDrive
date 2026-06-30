import { useRef, useState } from 'react';
import { mediaUrl } from '../api.js';
import { CAROUSEL_VARIANTS } from '../templates.js';

const VARIANT_KEYS = new Set(CAROUSEL_VARIANTS.map((v) => v.key));

// Swipeable Gen-Z carousel. Works as both the live editor preview and the
// reader view — scroll-snap track + working dots/arrows, with placeholder
// slides when the user hasn't dropped media in yet.
export default function Carousel({ fileIds = [], variant = 'swipe', caption = '', size = 'l', resolveUrl = mediaUrl }) {
  const v = VARIANT_KEYS.has(variant) ? variant : 'swipe';
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  const hasMedia = fileIds.length > 0;
  const slides = hasMedia ? fileIds : [0, 1, 2]; // 3 placeholders read as a carousel
  const count = slides.length;

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || count < 2) return;
    const i = Math.round(el.scrollLeft / (el.scrollWidth / count));
    setActive(Math.max(0, Math.min(count - 1, i)));
  };

  const go = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.scrollWidth / count), behavior: 'smooth' });
  };

  return (
    <figure className={`carousel carousel--${v} carousel-size-${size}`} data-count={count}>
      {v === 'story' && (
        <div className="carousel-bars" aria-hidden="true">
          {slides.map((_, i) => <span key={i} className={i <= active ? 'on' : ''} />)}
        </div>
      )}

      <div className="carousel-track" ref={trackRef} onScroll={onScroll}>
        {slides.map((s, i) => (
          <div className="carousel-slide" key={hasMedia ? s : `ph-${i}`}>
            {hasMedia
              ? <img src={resolveUrl(s)} alt="" loading="lazy" />
              : <div className="carousel-ph"><span>{i + 1}</span></div>}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button type="button" className="carousel-nav prev" onClick={() => go(-1)} aria-label="Previous">‹</button>
          <button type="button" className="carousel-nav next" onClick={() => go(1)} aria-label="Next">›</button>
          <div className="carousel-dots" aria-hidden="true">
            {slides.map((_, i) => <span key={i} className={i === active ? 'on' : ''} />)}
          </div>
        </>
      )}

      {caption ? <figcaption className="carousel-cap">{caption}</figcaption> : null}
    </figure>
  );
}
