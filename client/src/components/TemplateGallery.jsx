import { useMemo, useState } from 'react';
import { TEMPLATES, CATEGORY_FILTERS, THEME_BG, THEME_INK, sampleUrl } from '../templates.js';

// Cover image with graceful fallback to a themed gradient if the network image fails.
function Cover({ tpl }) {
  const [failed, setFailed] = useState(false);
  const bg = THEME_BG[tpl.theme] || '#222';
  const ink = THEME_INK[tpl.theme] || '#fff';

  const isBlank = !tpl.blocks.length;
  if (isBlank) {
    return (
      <div className="tpl-cover blank" style={{ background: bg, color: ink }}>
        <span className="plus">＋</span>
        <span className="blank-label">Blank canvas</span>
      </div>
    );
  }

  return (
    <div className="tpl-cover">
      {!failed ? (
        <img src={sampleUrl(tpl.seed)} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="tpl-cover-fallback" style={{ background: `linear-gradient(135deg, ${bg}, #2a2622)` }} />
      )}
      <div className="tpl-cover-shade" />
      <div className="tpl-cover-text">
        <div className="tpl-kicker">{tpl.label} · {tpl.theme}</div>
        <div className="tpl-mast">{tpl.name}</div>
        <ul className="tpl-lines">
          {tpl.lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>
    </div>
  );
}

export default function TemplateGallery({ onChoose, onClose, creating }) {
  const [title, setTitle] = useState('Untitled Issue');
  const [cat, setCat] = useState('all');

  const shown = useMemo(
    () => TEMPLATES.filter((t) => cat === 'all' || t.id === 'blank' || t.category === cat),
    [cat],
  );

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1080, height: '92vh' }}>
        <header>
          <div className="name" style={{ flex: 1 }}>The Newsstand — choose a template</div>
          <button className="btn btn--sm btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="body" style={{ display: 'block' }}>
          <div className="row wrap" style={{ gap: 12, marginBottom: 16 }}>
            <label className="field" style={{ flex: '1 1 280px' }}>
              <span>Title</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </label>
            <div style={{ alignSelf: 'flex-end', color: 'var(--c-ink-soft)', fontSize: 13 }}>
              {shown.length - (cat === 'all' ? 1 : 0)} designs
            </div>
          </div>

          <div className="cat-bar">
            {CATEGORY_FILTERS.map((c) => (
              <button key={c.key} className={`chip ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="tpl-grid">
            {shown.map((tpl) => (
              <button
                key={tpl.id}
                className="tpl-card"
                disabled={creating}
                onClick={() => onChoose(tpl, title.trim() || 'Untitled Issue')}
                title={`${tpl.name} — ${tpl.label}`}
              >
                <Cover tpl={tpl} />
                <div className="tpl-meta">
                  <div className="tpl-name">{tpl.name}</div>
                  <div className="tpl-theme">{tpl.label}{tpl.blocks.length ? ` · ${tpl.blocks.length} blocks` : ''}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
