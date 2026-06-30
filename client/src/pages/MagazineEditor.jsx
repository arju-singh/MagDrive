import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, mediaUrl } from '../api.js';
import { useRefresh } from '../refresh.jsx';
import FilePicker from '../components/FilePicker.jsx';
import Carousel from '../components/Carousel.jsx';
import ShareModal from '../components/ShareModal.jsx';
import Icon from '../components/Icon.jsx';
import { CAROUSEL_VARIANTS } from '../templates.js';

const THEMES = ['editorial', 'mono', 'vogue', 'zine', 'noir', 'y2k', 'pastel', 'neon'];
const BLOCK_TYPES = [
  { type: 'cover', label: 'Cover', icon: 'cover', media: true },
  { type: 'heading', label: 'Heading', icon: 'heading' },
  { type: 'text', label: 'Text', icon: 'text' },
  { type: 'quote', label: 'Pull-quote', icon: 'quote' },
  { type: 'image', label: 'Image', icon: 'image', media: true },
  { type: 'video', label: 'Video', icon: 'video', media: true },
  { type: 'gallery', label: 'Gallery', icon: 'gallery', media: true },
  { type: 'carousel', label: 'Carousel', icon: 'carousel', media: true },
  { type: 'spacer', label: 'Spacer', icon: 'spacer' },
];

let tmpId = 0;
const newId = () => `b_${Date.now()}_${tmpId++}`;

function defaultBlock(type) {
  const base = { id: newId(), type, text: '', fileId: null, fileIds: [], align: 'left', size: 'm', variant: 'swipe' };
  if (type === 'heading') base.text = 'A Bold Headline';
  if (type === 'text') base.text = 'Write your story here…';
  if (type === 'quote') base.text = 'A line worth pulling out.';
  if (type === 'cover') base.text = 'COVER STORY';
  if (type === 'carousel') { base.text = 'swipe →'; base.size = 'full'; }
  return base;
}

export default function MagazineEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { bump } = useRefresh();

  const [mag, setMag] = useState(null);
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('editorial');
  const [coverFileId, setCoverFileId] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [picker, setPicker] = useState(null); // {target, multiple, kind}
  const [sharing, setSharing] = useState(false);
  const [shareConfirm, setShareConfirm] = useState(false); // unsaved-changes prompt
  const loadedRef = useRef(false);

  useEffect(() => {
    api.getMagazine(id).then(({ magazine }) => {
      setMag(magazine);
      setTitle(magazine.title);
      setTheme(magazine.theme);
      setCoverFileId(magazine.coverFileId);
      setBlocks(magazine.layout.blocks.map((b) => ({ ...b })));
      loadedRef.current = true;
    }).catch(() => nav('/magazines'));
  }, [id, nav]);

  // Mark dirty on any edit after initial load.
  useEffect(() => { if (loadedRef.current) setDirty(true); }, [title, theme, coverFileId, blocks]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 1800); };

  async function save() {
    setSaving(true);
    try {
      const { magazine } = await api.patchMagazine(id, { title, theme, coverFileId, layout: { blocks } });
      setMag(magazine);
      setDirty(false);
      bump();
      showToast('Saved');
      return true;
    } catch (ex) {
      showToast(ex.status === 413 ? 'Magazine is too large to save.' : 'Save failed.');
      return false;
    } finally { setSaving(false); }
  }

  // Share opens the link modal — but a public link reflects the last SAVED version,
  // so prompt to save first when there are unsaved edits.
  function onShareClick() {
    if (dirty) setShareConfirm(true);
    else setSharing(true);
  }
  async function saveThenShare() {
    if (await save()) { setShareConfirm(false); setSharing(true); }
  }

  // block ops
  const addBlock = (type) => setBlocks((p) => [...p, defaultBlock(type)]);
  const updateBlock = (bid, patch) => setBlocks((p) => p.map((b) => (b.id === bid ? { ...b, ...patch } : b)));
  const removeBlock = (bid) => setBlocks((p) => p.filter((b) => b.id !== bid));
  const move = (bid, dir) => setBlocks((p) => {
    const i = p.findIndex((b) => b.id === bid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= p.length) return p;
    const copy = [...p];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });

  function onPick(result) {
    const t = picker.target;
    if (t === 'cover') setCoverFileId(result);
    else if (picker.multiple) updateBlock(t, { fileIds: result });
    else updateBlock(t, { fileId: result });
    setPicker(null);
  }

  if (!mag) return <div className="empty"><span className="spinner" /></div>;

  return (
    <>
      <div className="toolbar">
        <button className="btn btn--ghost" onClick={() => nav('/magazines')}>← Newsstand</button>
        <div className="spacer" style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 13 }}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <button className="btn" onClick={onShareClick}>
          <Icon name="share" size={15} /> Share
        </button>
        <button className="btn btn--primary" onClick={save} disabled={saving || !dirty}>
          {saving ? <span className="spinner" /> : 'Save'}
        </button>
      </div>

      <div className="editor">
        {/* ---- Controls ---- */}
        <div>
          <div className="panel stack">
            <label className="field"><span>Title</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field"><span>Theme</span>
              <select className="input select" value={theme} onChange={(e) => setTheme(e.target.value)}>
                {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <div className="field">
              <span className="tag" style={{ display: 'block', marginBottom: 4 }}>Cover image</span>
              <div className="row">
                <button className="btn btn--sm" onClick={() => setPicker({ target: 'cover', multiple: false, kind: 'image' })}>
                  {coverFileId ? 'Change cover' : 'Choose cover'}
                </button>
                {coverFileId && <button className="btn btn--sm btn--ghost" onClick={() => setCoverFileId(null)}>Remove</button>}
              </div>
            </div>
          </div>

          <div className="panel">
            <span className="tag" style={{ display: 'block', marginBottom: 8 }}>Add a block</span>
            <div className="block-btns">
              {BLOCK_TYPES.map((b) => (
                <button key={b.type} className="btn btn--sm" onClick={() => addBlock(b.type)}>
                  <Icon name={b.icon} size={15} /> {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Live reader / preview ---- */}
        <div className={`reader theme-${theme}`}>
          <div style={{ borderBottom: '3px double currentColor', paddingBottom: 12, marginBottom: 28 }}>
            <div className="tag">{theme} · issue</div>
            <h1 style={{ fontSize: 'var(--fs-2xl)', margin: '4px 0 0' }}>{title || 'Untitled'}</h1>
          </div>

          {blocks.length === 0 && (
            <div className="empty"><p className="muted">Add blocks from the left to build your layout.</p></div>
          )}

          {blocks.map((b) => (
            <EditableBlock
              key={b.id}
              block={b}
              onUpdate={(patch) => updateBlock(b.id, patch)}
              onRemove={() => removeBlock(b.id)}
              onMove={(d) => move(b.id, d)}
              onPickMedia={(opts) => setPicker({ target: b.id, ...opts })}
            />
          ))}
        </div>
      </div>

      {picker && (
        <FilePicker
          multiple={picker.multiple}
          kind={picker.kind || ''}
          onPick={onPick}
          onClose={() => setPicker(null)}
        />
      )}
      {shareConfirm && (
        <div className="modal-back" onClick={() => setShareConfirm(false)}>
          <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <div className="name" style={{ flex: 1 }}>Unsaved changes</div>
              <button className="btn btn--sm btn--ghost" onClick={() => setShareConfirm(false)} aria-label="Close">✕</button>
            </header>
            <div className="share-body">
              <p className="muted">A public link always shows the last saved version. Save your changes first so people see your latest edits?</p>
              <div className="row" style={{ gap: 'var(--sp-2)' }}>
                <button className="btn btn--primary" onClick={saveThenShare} disabled={saving}>
                  {saving ? <span className="spinner" /> : 'Save & share'}
                </button>
                <button className="btn" onClick={() => { setShareConfirm(false); setSharing(true); }} disabled={saving}>
                  Share without saving
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sharing && (
        <ShareModal target={{ type: 'magazine', id, title: title || 'Untitled Magazine' }} onClose={() => setSharing(false)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function MediaControls({ block, onUpdate }) {
  return (
    <div className="row wrap" style={{ marginTop: 8 }}>
      <select className="input select btn--sm" style={{ width: 'auto', minHeight: 32 }} value={block.size} onChange={(e) => onUpdate({ size: e.target.value })}>
        {['s', 'm', 'l', 'full'].map((s) => <option key={s} value={s}>size: {s}</option>)}
      </select>
      <select className="input select btn--sm" style={{ width: 'auto', minHeight: 32 }} value={block.align} onChange={(e) => onUpdate({ align: e.target.value })}>
        {['left', 'center', 'right'].map((a) => <option key={a} value={a}>align: {a}</option>)}
      </select>
    </div>
  );
}

function EditableBlock({ block, onUpdate, onRemove, onMove, onPickMedia }) {
  const cls = `blk size-${block.size} align-${block.align}`;

  return (
    <div className={cls}>
      <div className="blk-controls">
        <button title="Move up" onClick={() => onMove(-1)}>↑</button>
        <button title="Move down" onClick={() => onMove(1)}>↓</button>
        <button title="Delete block" onClick={onRemove}>✕</button>
      </div>

      {block.type === 'cover' && (
        <div className="blk-cover" style={{ background: '#222' }}>
          {block.fileId && <img src={mediaUrl(block.fileId)} alt="" />}
          <input className="ctext" value={block.text} onChange={(e) => onUpdate({ text: e.target.value })}
            style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%' }} />
          <button className="btn btn--sm" style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}
            onClick={() => onPickMedia({ multiple: false, kind: 'image' })}>
            {block.fileId ? 'Change image' : 'Choose image'}
          </button>
        </div>
      )}

      {block.type === 'heading' && (
        <input className="blk-heading input" value={block.text} onChange={(e) => onUpdate({ text: e.target.value })}
          style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', border: 'none', background: 'transparent', padding: 0 }} />
      )}

      {block.type === 'text' && (
        <textarea className="blk-text input" value={block.text} onChange={(e) => onUpdate({ text: e.target.value })}
          style={{ border: 'none', background: 'transparent', padding: 0 }} rows={4} />
      )}

      {block.type === 'quote' && (
        <div className="blk-quote">
          <input value={block.text} onChange={(e) => onUpdate({ text: e.target.value })}
            style={{ font: 'inherit', fontStyle: 'italic', border: 'none', background: 'transparent', width: '100%' }} />
        </div>
      )}

      {block.type === 'image' && (
        <div>
          {block.fileId
            ? <img className="blk-img" src={mediaUrl(block.fileId)} alt="" />
            : <div className="doc-thumb kind-image" style={{ borderRadius: 6 }}><Icon name="image" size={40} /></div>}
          <button className="btn btn--sm" onClick={() => onPickMedia({ multiple: false, kind: 'image' })} style={{ marginTop: 8 }}>
            {block.fileId ? 'Change image' : 'Choose image'}
          </button>
          <MediaControls block={block} onUpdate={onUpdate} />
        </div>
      )}

      {block.type === 'video' && (
        <div>
          {block.fileId
            ? <video className="blk-img" src={mediaUrl(block.fileId)} controls />
            : <div className="doc-thumb kind-video" style={{ borderRadius: 6 }}><Icon name="video" size={40} /></div>}
          <button className="btn btn--sm" onClick={() => onPickMedia({ multiple: false, kind: 'video' })} style={{ marginTop: 8 }}>
            {block.fileId ? 'Change video' : 'Choose video'}
          </button>
          <MediaControls block={block} onUpdate={onUpdate} />
        </div>
      )}

      {block.type === 'gallery' && (
        <div>
          {block.fileIds?.length ? (
            <div className="blk-gallery">
              {block.fileIds.map((fid) => <img key={fid} src={mediaUrl(fid)} alt="" />)}
            </div>
          ) : <div className="doc-thumb kind-other" style={{ borderRadius: 6 }}><Icon name="gallery" size={40} /></div>}
          <button className="btn btn--sm" onClick={() => onPickMedia({ multiple: true, kind: 'image' })} style={{ marginTop: 8 }}>
            {block.fileIds?.length ? `Edit selection (${block.fileIds.length})` : 'Choose images'}
          </button>
        </div>
      )}

      {block.type === 'carousel' && (
        <div>
          <Carousel fileIds={block.fileIds} variant={block.variant} caption={block.text} size={block.size} />
          <div className="row wrap" style={{ marginTop: 8, gap: 8 }}>
            <button className="btn btn--sm" onClick={() => onPickMedia({ multiple: true, kind: 'image' })}>
              {block.fileIds?.length ? `Edit photos (${block.fileIds.length})` : 'Choose photos'}
            </button>
            <select
              className="input select btn--sm"
              style={{ width: 'auto', minHeight: 32 }}
              value={block.variant || 'swipe'}
              onChange={(e) => onUpdate({ variant: e.target.value })}
              title="Carousel style"
            >
              {CAROUSEL_VARIANTS.map((v) => <option key={v.key} value={v.key}>style: {v.label}</option>)}
            </select>
          </div>
          <label className="field" style={{ marginTop: 8 }}>
            <span className="tag">Caption</span>
            <input className="input" value={block.text} onChange={(e) => onUpdate({ text: e.target.value })} placeholder="swipe →" />
          </label>
          <MediaControls block={block} onUpdate={onUpdate} />
        </div>
      )}

      {block.type === 'spacer' && <div className="blk-spacer" />}
    </div>
  );
}
