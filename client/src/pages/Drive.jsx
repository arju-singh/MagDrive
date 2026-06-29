import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useRefresh } from '../refresh.jsx';
import { KIND_LABEL } from '../components/kindIcon.js';
import FileTile from '../components/FileTile.jsx';
import FolderTile from '../components/FolderTile.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';
import Uploader from '../components/Uploader.jsx';
import Viewer from '../components/Viewer.jsx';
import ImportDrive from '../components/ImportDrive.jsx';
import Icon from '../components/Icon.jsx';
import { Character, Sparkle, Star, Bolt } from '../components/art.jsx';

const PAGE = 60;
const todayLine = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export default function Drive() {
  const [sp] = useSearchParams();
  const { bump } = useRefresh();
  const kind = sp.get('kind') || '';
  const starred = sp.get('starred') === '1';
  const q = sp.get('q') || '';

  // Folders form a hierarchy only in the unfiltered "All files" view; kind/starred/
  // search stay flat, global views (so you can find anything regardless of folder).
  const folderView = !kind && !starred && !q;
  const [folderId, setFolderId] = useState(null); // null = root
  const [trail, setTrail] = useState([]);          // [{ id, name }] root → current
  const [folders, setFolders] = useState([]);

  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const here = folderId || 'root';
  const title = q ? `Search: ${q}` : starred ? 'Starred'
    : kind ? KIND_LABEL[kind]
    : trail.length ? trail[trail.length - 1].name : 'The Library';

  const load = useCallback(async (reset) => {
    setLoading(true);
    const nextOffset = reset ? 0 : offset;
    const params = { limit: PAGE, offset: nextOffset };
    if (kind) params.kind = kind;
    if (starred) params.starred = '1';
    if (q) params.q = q;
    if (folderView) params.folderId = here;
    try {
      const res = await api.listFiles(params);
      setTotal(res.total);
      setOffset(nextOffset + res.files.length);
      setFiles((prev) => (reset ? res.files : [...prev, ...res.files]));
    } finally {
      setLoading(false);
    }
  }, [kind, starred, q, offset, folderView, here]);

  const loadFolders = useCallback(async () => {
    if (!folderView) { setFolders([]); return; }
    try { setFolders((await api.listFolders(here)).folders); } catch { setFolders([]); }
  }, [folderView, here]);

  // Leaving folder mode (entering a filtered view) drops folder context, so coming
  // back to "All files" always starts at the root.
  useEffect(() => { if (!folderView) { setFolderId(null); setTrail([]); } }, [folderView]);

  // Reload files + subfolders whenever the filter or current folder changes.
  useEffect(() => { setFiles([]); setOffset(0); load(true); loadFolders(); /* eslint-disable-next-line */ }, [kind, starred, q, folderId]);

  // ---- folder navigation ----
  function openFolder(folder) { setTrail((t) => [...t, { id: folder.id, name: folder.name }]); setFolderId(folder.id); }
  function navCrumb(index) {
    if (index <= 0) { setTrail([]); setFolderId(null); return; }
    const t = trail.slice(0, index);
    setTrail(t);
    setFolderId(t[t.length - 1].id);
  }

  // ---- folder CRUD ----
  async function submitNewFolder() {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    const { folder } = await api.createFolder({ name, parentId: here });
    setFolders((p) => [...p, folder].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName(''); setCreating(false);
    bump();
  }
  async function renameFolder(folder, name) {
    const { folder: u } = await api.patchFolder(folder.id, { name });
    setFolders((p) => p.map((f) => (f.id === u.id ? u : f)).sort((a, b) => a.name.localeCompare(b.name)));
    setTrail((t) => t.map((c) => (c.id === u.id ? { ...c, name: u.name } : c)));
  }
  async function deleteFolder(folder) {
    await api.deleteFolder(folder.id);
    setFolders((p) => p.filter((f) => f.id !== folder.id));
    if (folderView) load(true); // files freed to root may now appear here
    bump();
  }

  // ---- move a file into a folder (drag-drop targets + Viewer picker) ----
  async function moveFile(fileId, destId) {
    if (destId === here) return; // already here
    const { file: u } = await api.patchFile(fileId, { folderId: destId });
    setFiles((p) => p.filter((x) => x.id !== fileId)); // it left the current folder
    setTotal((t) => Math.max(0, t - 1));
    if (active?.id === u.id) setActive(null);
    bump();
  }

  function onUploaded(created) {
    // Prepend items that belong in the current view: everything in folder view (they
    // land in the current folder), or kind-matching items in a flat filtered view.
    const fits = folderView ? created : created.filter((f) => (!kind || f.kind === kind) && !starred && !q);
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
  function onMoved(u) {
    // Moved from the viewer; drop it from this list if it no longer lives here.
    const stillHere = (u.folderId || null) === (folderId || null);
    setFiles((p) => (stillHere ? p.map((x) => (x.id === u.id ? u : x)) : p.filter((x) => x.id !== u.id)));
    if (!stillHere) setTotal((t) => Math.max(0, t - 1));
    setActive(null);
    bump();
  }

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

      {folderView && (
        <Breadcrumb trail={trail} onNavigate={navCrumb} onDropFile={moveFile} />
      )}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        {folderView && !creating && (
          <button className="btn btn--sm" onClick={() => { setCreating(true); setNewName(''); }}>
            <Icon name="folder-plus" size={15} /> New folder
          </button>
        )}
        {folderView && creating && (
          <span className="folder-compose">
            <Icon name="folder" size={16} />
            <input
              className="input" autoFocus placeholder="Folder name" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNewFolder(); if (e.key === 'Escape') setCreating(false); }}
            />
            <button className="btn btn--sm btn--primary" onClick={submitNewFolder}>Create</button>
            <button className="btn btn--sm btn--ghost" onClick={() => setCreating(false)}>Cancel</button>
          </span>
        )}
        <button className="btn btn--sm btn--primary" onClick={() => setImporting(true)}>
          <Icon name="upload" size={15} /> Import from Drive
        </button>
      </div>

      <Uploader folderId={here} onUploaded={onUploaded} />

      {folderView && folders.length > 0 && (
        <div className="folder-grid">
          {folders.map((f) => (
            <FolderTile key={f.id} folder={f} onOpen={openFolder} onRename={renameFolder} onDelete={deleteFolder} onDropFile={moveFile} />
          ))}
        </div>
      )}

      {loading && files.length === 0 ? (
        <div className="empty"><span className="spinner" /></div>
      ) : files.length === 0 ? (
        folders.length === 0 && (
          <div className="empty">
            <Character seed={q ? 'searching' : 'empty-library'} style="adventurer" size={130} className="empty-char" />
            <h3>Nothing here yet</h3>
            <p className="muted">{q ? 'No files match your search.' : 'Upload your first photos, videos or documents above.'}</p>
          </div>
        )
      ) : (
        <>
          <div className="masonry">
            {files.map((f) => (
              <FileTile key={f.id} file={f} onOpen={setActive} onToggleStar={onToggleStar} draggable={folderView} />
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
        <Viewer file={active} onClose={() => setActive(null)} onChanged={onChanged} onDeleted={onDeleted} onMoved={onMoved} />
      )}

      {importing && (
        <ImportDrive folderId={here} onImported={(created) => onUploaded(created)} onClose={() => setImporting(false)} />
      )}
    </>
  );
}
