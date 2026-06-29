import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useRefresh } from '../refresh.jsx';
import { KIND_LABEL } from '../components/kindIcon.js';
import FileTile from '../components/FileTile.jsx';
import Uploader from '../components/Uploader.jsx';
import Viewer from '../components/Viewer.jsx';
import { Character, Sparkle, Star, Bolt } from '../components/art.jsx';

const PAGE = 60;
const todayLine = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export default function Drive() {
  const [sp] = useSearchParams();
  const { bump } = useRefresh();
  const kind = sp.get('kind') || '';
  const starred = sp.get('starred') === '1';
  const q = sp.get('q') || '';

  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  const title = q ? `Search: ${q}` : starred ? 'Starred' : kind ? KIND_LABEL[kind] : 'The Library';

  const load = useCallback(async (reset) => {
    setLoading(true);
    const nextOffset = reset ? 0 : offset;
    const params = { limit: PAGE, offset: nextOffset };
    if (kind) params.kind = kind;
    if (starred) params.starred = '1';
    if (q) params.q = q;
    try {
      const res = await api.listFiles(params);
      setTotal(res.total);
      setOffset(nextOffset + res.files.length);
      setFiles((prev) => (reset ? res.files : [...prev, ...res.files]));
    } finally {
      setLoading(false);
    }
  }, [kind, starred, q, offset]);

  // Reload from scratch whenever the filter changes.
  useEffect(() => { setFiles([]); setOffset(0); load(true); /* eslint-disable-next-line */ }, [kind, starred, q]);

  function onUploaded(created) {
    // Only prepend items that match the current view.
    const fits = created.filter((f) => (!kind || f.kind === kind) && !starred && !q);
    if (fits.length) { setFiles((p) => [...fits, ...p]); setTotal((t) => t + fits.length); }
    bump();
  }
  function onToggleStar(file) {
    api.patchFile(file.id, { starred: !file.starred }).then(({ file: u }) => {
      setFiles((p) => (starred && !u.starred ? p.filter((x) => x.id !== u.id) : p.map((x) => (x.id === u.id ? u : x))));
      if (active?.id === u.id) setActive(u);
      bump();
    });
  }
  function onChanged(u) { setFiles((p) => p.map((x) => (x.id === u.id ? u : x))); setActive(u); }
  function onDeleted(id) { setFiles((p) => p.filter((x) => x.id !== id)); setTotal((t) => Math.max(0, t - 1)); setActive(null); bump(); }

  return (
    <>
      <div className="masthead">
        <div>
          <div className="kicker">MagDrive Weekly · Vol. 1</div>
          <h1>{title}</h1>
        </div>
        <div className="issue">
          <span className="doodle-row"><Star size={20} /><Sparkle size={20} /><Bolt size={20} /></span><br />
          {todayLine}<br />{total} {total === 1 ? 'piece' : 'pieces'} on file
        </div>
      </div>

      <Uploader onUploaded={onUploaded} />

      {loading && files.length === 0 ? (
        <div className="empty"><span className="spinner" /></div>
      ) : files.length === 0 ? (
        <div className="empty">
          <Character seed={q ? 'searching' : 'empty-library'} style="adventurer" size={130} className="empty-char" />
          <h3>Nothing here yet</h3>
          <p className="muted">{q ? 'No files match your search.' : 'Upload your first photos, videos or documents above.'}</p>
        </div>
      ) : (
        <>
          <div className="masonry">
            {files.map((f) => (
              <FileTile key={f.id} file={f} onOpen={setActive} onToggleStar={onToggleStar} />
            ))}
          </div>
          {files.length < total && (
            <div className="center" style={{ marginTop: 24 }}>
              <button className="btn" onClick={() => load(false)} disabled={loading}>
                {loading ? <span className="spinner" /> : `Load more (${total - files.length} left)`}
              </button>
            </div>
          )}
        </>
      )}

      {active && (
        <Viewer file={active} onClose={() => setActive(null)} onChanged={onChanged} onDeleted={onDeleted} />
      )}
    </>
  );
}
