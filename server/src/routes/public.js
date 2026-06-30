import express from 'express';
import { db } from '../db.js';
import { THUMBNABLE } from '../thumbnails.js';
import { streamFile, serveThumb } from './files.js';

const router = express.Router();

// Public, read-only view of a file (no storage_key / owner / folder leaked).
function publicFile(f) {
  return {
    id: f.id,
    name: f.name,
    mime: f.mime,
    size: f.size,
    kind: f.kind,
    thumbStatus: f.thumb_status || 'none',
    thumbnailable: THUMBNABLE.includes(f.kind),
    createdAt: f.created_at,
  };
}

async function getShare(token) {
  return db.get('SELECT * FROM shares WHERE token = ?', [token]);
}

// The set of file ids a given share grants public access to. For a file share it's
// just that file; for a magazine it's the cover plus every file the layout references.
async function allowedFileIds(share) {
  if (share.target_type === 'file') return new Set([share.target_id]);
  const m = await db.get('SELECT * FROM magazines WHERE id = ? AND user_id = ?', [share.target_id, share.user_id]);
  if (!m) return new Set();
  const ids = new Set();
  if (m.cover_file_id) ids.add(m.cover_file_id);
  try {
    const layout = JSON.parse(m.layout_json);
    for (const b of layout?.blocks || []) {
      if (b?.fileId) ids.add(b.fileId);
      for (const fid of b?.fileIds || []) ids.add(fid);
    }
  } catch { /* malformed layout → just the cover */ }
  return ids;
}

// GET /api/public/:token — the shared payload (file metadata or magazine layout).
router.get('/:token', async (req, res) => {
  const share = await getShare(req.params.token);
  if (!share) return res.status(404).json({ error: 'not_found' });

  if (share.target_type === 'file') {
    const f = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [share.target_id, share.user_id]);
    if (!f) return res.status(404).json({ error: 'not_found' });
    return res.json({ type: 'file', token: share.token, file: publicFile(f) });
  }

  const m = await db.get('SELECT * FROM magazines WHERE id = ? AND user_id = ?', [share.target_id, share.user_id]);
  if (!m) return res.status(404).json({ error: 'not_found' });
  let layout;
  try { layout = JSON.parse(m.layout_json); } catch { layout = { blocks: [] }; }
  res.json({
    type: 'magazine',
    token: share.token,
    magazine: { title: m.title, theme: m.theme, coverFileId: m.cover_file_id, layout },
  });
});

// Resolve a media request against a share, enforcing the allowed-id scope.
async function resolveSharedFile(req, res) {
  const share = await getShare(req.params.token);
  if (!share) { res.status(404).json({ error: 'not_found' }); return null; }
  const allowed = await allowedFileIds(share);
  if (!allowed.has(req.params.fileId)) { res.status(404).json({ error: 'not_found' }); return null; }
  const f = await db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [req.params.fileId, share.user_id]);
  if (!f) { res.status(404).json({ error: 'not_found' }); return null; }
  return f;
}

// GET /api/public/:token/files/:fileId/raw — inline media (image/video/pdf/audio).
router.get('/:token/files/:fileId/raw', async (req, res) => {
  const f = await resolveSharedFile(req, res);
  if (f) streamFile(f, req, res, { download: false });
});

// GET /api/public/:token/files/:fileId/thumb — cached thumbnail.
router.get('/:token/files/:fileId/thumb', async (req, res) => {
  const f = await resolveSharedFile(req, res);
  if (f && !(await serveThumb(f, res))) res.status(404).json({ error: 'no_thumb' });
});

// GET /api/public/:token/files/:fileId/download — attachment.
router.get('/:token/files/:fileId/download', async (req, res) => {
  const f = await resolveSharedFile(req, res);
  if (f) streamFile(f, req, res, { download: true });
});

export default router;
