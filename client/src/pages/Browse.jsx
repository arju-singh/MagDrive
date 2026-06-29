import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, srcMediaUrl, srcThumbUrl } from '../api.js';
import Row from '../components/Row.jsx';
import MediaModal from '../components/MediaModal.jsx';
import Connect from '../components/Connect.jsx';
import CloudItemPicker from '../components/CloudItemPicker.jsx';

const asLocal = (f) => ({ source: 'local', id: f.id, name: f.name, kind: f.kind });
const dedupe = (arr) => {
  const seen = new Set();
  return arr.filter((i) => { const k = `${i.source}:${i.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
};

export default function Browse() {
  const [sp, setSp] = useSearchParams();
  const [conns, setConns] = useState([]);
  const [available, setAvailable] = useState([]);
  const [rows, setRows] = useState({ recent: [], image: [], video: [], pdf: [] });
  const [shelves, setShelves] = useState([]);
  const [hero, setHero] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [showConnect, setShowConnect] = useState(false);
  const [pickerShelf, setPickerShelf] = useState(null);
  const [toast, setToast] = useState('');

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  const loadKind = useCallback(async (kind, connections) => {
    const jobs = [api.listFiles({ kind, limit: 24 }).then((r) => r.files.map(asLocal)).catch(() => [])];
    for (const c of connections) jobs.push(api.cloudFiles(c.provider, { kind }).then((r) => r.items).catch(() => []));
    return dedupe((await Promise.all(jobs)).flat());
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const { connections, available } = await api.connections();
    setConns(connections); setAvailable(available);
    const [recentLocal, image, video, pdf, shelvesRes] = await Promise.all([
      api.listFiles({ limit: 24 }).then((r) => r.files.map(asLocal)).catch(() => []),
      loadKind('image', connections),
      loadKind('video', connections),
      loadKind('pdf', connections),
      api.listShelves().then((r) => r.shelves).catch(() => []),
    ]);
    const recent = dedupe([...recentLocal, ...image]).slice(0, 24);
    setRows({ recent, image, video, pdf });
    setShelves(shelvesRes);
    setHero(image[0] || video[0] || recent[0] || null);
    setLoading(false);
  }, [loadKind]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Feedback after an OAuth bounce-back (?connect=google|dropbox|error|denied).
  useEffect(() => {
    const c = sp.get('connect');
    if (!c) return;
    flash(c === 'error' ? 'Connection failed. Check your credentials.' : c === 'denied' ? 'Connection cancelled.' : `Connected ${c}!`);
    sp.delete('connect'); setSp(sp, { replace: true });
    if (c !== 'error' && c !== 'denied') loadAll();
  }, [sp, setSp, loadAll]);

  async function addToShelf(shelf, newItems) {
    const merged = dedupe([...shelf.items, ...newItems]);
    const { shelf: updated } = await api.patchShelf(shelf.id, { items: merged });
    setShelves((p) => p.map((s) => (s.id === updated.id ? updated : s)));
    setPickerShelf(null);
    flash(`Added ${newItems.length} to “${shelf.title}”`);
  }
  async function removeFromShelf(shelf, item) {
    const items = shelf.items.filter((i) => !(i.source === item.source && i.id === item.id));
    const { shelf: updated } = await api.patchShelf(shelf.id, { items });
    setShelves((p) => p.map((s) => (s.id === updated.id ? updated : s)));
  }
  async function newShelf() {
    const title = window.prompt('Name your shelf', 'My Collection');
    if (title === null) return;
    const { shelf } = await api.createShelf(title || 'My Collection');
    setShelves((p) => [...p, shelf]);
    setPickerShelf(shelf);
  }
  async function removeShelf(shelf) {
    if (!window.confirm(`Delete shelf “${shelf.title}”?`)) return;
    await api.deleteShelf(shelf.id);
    setShelves((p) => p.filter((s) => s.id !== shelf.id));
  }

  if (loading) return <div className="empty"><span className="spinner" /></div>;

  const totalConnected = conns.length;

  return (
    <div className="browse">
      {/* Hero */}
      <div className="hero" style={hero ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.15), var(--c-paper) 96%), url(${srcThumbUrl(hero)})` } : undefined}>
        <div className="hero-inner">
          <div className="kicker">Your Universe</div>
          <h1>Everything, arranged your way.</h1>
          <p className="muted" style={{ maxWidth: 520 }}>
            {totalConnected
              ? `Connected: ${conns.map((c) => c.accountLabel || c.provider).join(', ')}. Browse and curate it all here.`
              : 'Connect a drive (or your demo drive) and arrange your photos, videos and PDFs into custom rows.'}
          </p>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn btn--primary" onClick={() => setShowConnect(true)}>☁️ Connect a drive</button>
            {hero && <button className="btn" onClick={() => setViewing(hero)}>▶ Open</button>}
            <button className="btn" onClick={newShelf}>＋ New shelf</button>
          </div>
        </div>
      </div>

      {/* Custom shelves first (Netflix puts your lists up top) */}
      {shelves.map((shelf) => (
        <Row
          key={shelf.id}
          kicker="Your shelf"
          title={shelf.title}
          items={shelf.items}
          onOpen={setViewing}
          onRemove={(it) => removeFromShelf(shelf, it)}
          actions={(
            <>
              <button className="btn btn--sm" onClick={() => setPickerShelf(shelf)}>＋ Add</button>
              <button className="btn btn--sm btn--ghost" onClick={() => removeShelf(shelf)} title="Delete shelf">🗑</button>
            </>
          )}
        />
      ))}

      {/* Auto rows */}
      <Row title="Recently added" kicker="Auto" items={rows.recent} onOpen={setViewing} />
      <Row title="Photos" kicker="Auto" items={rows.image} onOpen={setViewing} />
      <Row title="Videos" kicker="Auto" items={rows.video} onOpen={setViewing} />
      <Row title="PDFs & Documents" kicker="Auto" items={rows.pdf} onOpen={setViewing} />

      {totalConnected === 0 && rows.recent.length === 0 && (
        <div className="empty">
          <div className="big">🌌</div>
          <h3>Nothing to show yet</h3>
          <p className="muted">Connect a drive to pull in your media, or upload files in The Library.</p>
          <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={() => setShowConnect(true)}>Connect a drive</button>
        </div>
      )}

      {viewing && <MediaModal item={viewing} onClose={() => setViewing(null)} />}
      {showConnect && <Connect connections={conns} available={available} onChanged={() => { setShowConnect(false); loadAll(); }} onClose={() => setShowConnect(false)} />}
      {pickerShelf && <CloudItemPicker connections={conns} onAdd={(items) => addToShelf(pickerShelf, items)} onClose={() => setPickerShelf(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
