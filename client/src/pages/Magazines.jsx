import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, mediaUrl } from '../api.js';
import { useRefresh } from '../refresh.jsx';
import TemplateGallery from '../components/TemplateGallery.jsx';
import { Character, Sparkle } from '../components/art.jsx';

const todayLine = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

export default function Magazines() {
  const nav = useNavigate();
  const { bump } = useRefresh();
  const [mags, setMags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  useEffect(() => { api.listMagazines().then((r) => setMags(r.magazines)).finally(() => setLoading(false)); }, []);

  async function createFromTemplate(tpl, title) {
    setCreating(true);
    try {
      const { magazine } = await api.createMagazine({
        title,
        theme: tpl.theme,
        layout: { blocks: tpl.blocks },
      });
      bump();
      nav(`/magazines/${magazine.id}`);
    } finally { setCreating(false); }
  }

  async function remove(e, m) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${m.title}"?`)) return;
    await api.deleteMagazine(m.id);
    setMags((p) => p.filter((x) => x.id !== m.id));
    bump();
  }

  return (
    <>
      <div className="masthead">
        <div>
          <div className="kicker">Custom Issues · The Newsstand</div>
          <h1>Magazines <Sparkle size={28} className="doodle" /></h1>
        </div>
        <div className="issue">{todayLine}<br />{mags.length} issue{mags.length === 1 ? '' : 's'}</div>
      </div>

      <div className="toolbar">
        <button className="btn btn--primary" onClick={() => setShowGallery(true)} disabled={creating}>
          {creating ? <span className="spinner" /> : '＋ New magazine'}
        </button>
        <span className="muted">Pick a ready-made template, then just add your content.</span>
      </div>

      {loading ? (
        <div className="empty"><span className="spinner" /></div>
      ) : mags.length === 0 ? (
        <div className="empty">
          <Character seed="newsstand-empty" style="lorelei" size={130} className="empty-char" />
          <h3>No magazines yet</h3>
          <p className="muted">Pick a template and lay out your media like a real magazine.</p>
          <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => setShowGallery(true)}>＋ Start from a template</button>
        </div>
      ) : (
        <div className="mag-grid">
          {mags.map((m) => (
            <article key={m.id} className="mag-card" onClick={() => nav(`/magazines/${m.id}`)}>
              <div className="mag-cover">
                {m.coverFileId && <img src={mediaUrl(m.coverFileId)} alt="" />}
                <div className="overlay">
                  <div className="mkicker">{m.theme}</div>
                  <div>
                    <div className="mtitle">{m.title}</div>
                    <div className="mkicker" style={{ marginTop: 8, opacity: .8 }}>
                      {m.layout.blocks.length} blocks · {new Date(m.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn--sm btn--danger" onClick={(e) => remove(e, m)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showGallery && (
        <TemplateGallery
          creating={creating}
          onChoose={createFromTemplate}
          onClose={() => setShowGallery(false)}
        />
      )}
    </>
  );
}
