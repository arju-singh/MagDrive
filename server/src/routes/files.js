import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import multer from 'multer';
import { db } from '../db.js';
import { config, SERVER_ROOT } from '../config.js';
import { storage } from '../storage.js';
import { kindFromMime, KINDS } from '../kinds.js';
import { requireAuth, requireAuthFlexible } from '../auth.js';
import { logger } from '../logger.js';
import { makeThumb, THUMBNABLE } from '../thumbnails.js';

const router = express.Router();

// Temp landing dir for multipart parts; the storage adapter moves them out.
const TMP_DIR = path.join(SERVER_ROOT, 'data', 'tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_DIR),
    filename: (_req, _file, cb) => cb(null, `${randomUUID()}.part`),
  }),
  limits: { fileSize: config.maxFileBytes }, // size cap (Checklist: Security)
});

export function serialize(f) {
  return {
    id: f.id,
    name: f.name,
    originalName: f.original_name,
    mime: f.mime,
    size: f.size,
    kind: f.kind,
    folderId: f.folder_id,
    starred: !!f.starred,
    // 'ready' means /thumb will serve a cached image; the client can skip the fallback.
    thumbStatus: f.thumb_status || 'none',
    thumbnailable: THUMBNABLE.includes(f.kind),
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  };
}

// Verify a folder belongs to the user (deny cross-user moves).
function ownsFolder(userId, folderId) {
  if (!folderId) return true;
  return !!db.prepare('SELECT 1 FROM folders WHERE id = ? AND user_id = ?').get(folderId, userId);
}

// GET /api/files — list (paginated, filtered), always scoped to the caller.
router.get('/', requireAuth, (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(Number(req.query.limit) || 60, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const where = ['user_id = @userId'];
  // node:sqlite rejects unknown named params, so the WHERE params are kept separate
  // from pagination params (which only the list query references).
  const filter = { userId };

  if (req.query.kind && KINDS.includes(req.query.kind)) {
    where.push('kind = @kind');
    filter.kind = req.query.kind;
  }
  if (req.query.starred === '1') where.push('starred = 1');
  if (req.query.folderId === 'root') {
    where.push('folder_id IS NULL');
  } else if (req.query.folderId) {
    where.push('folder_id = @folderId');
    filter.folderId = req.query.folderId;
  }
  if (req.query.q) {
    where.push('name LIKE @q');
    filter.q = `%${String(req.query.q).slice(0, 100)}%`;
  }

  const clause = where.join(' AND ');
  const rows = db
    .prepare(`SELECT * FROM files WHERE ${clause} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...filter, limit, offset });
  const total = db.prepare(`SELECT COUNT(*) AS c FROM files WHERE ${clause}`).get(filter).c;

  res.json({ files: rows.map(serialize), total, limit, offset });
});

// POST /api/files — upload one or many. field name: "files". optional body.folderId
router.post('/', requireAuth, upload.array('files', 50), async (req, res) => {
  const userId = req.user.id;
  const folderId = req.body?.folderId && req.body.folderId !== 'root' ? req.body.folderId : null;

  if (folderId && !ownsFolder(userId, folderId)) {
    // Clean temp parts before bailing.
    for (const f of req.files || []) fs.promises.unlink(f.path).catch(() => {});
    return res.status(403).json({ error: 'forbidden_folder' });
  }
  if (!req.files?.length) return res.status(400).json({ error: 'no_files' });

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO files (id, user_id, folder_id, name, original_name, mime, size, kind, storage_key, starred, created_at, updated_at)
    VALUES (@id, @user_id, @folder_id, @name, @original_name, @mime, @size, @kind, @storage_key, 0, @created_at, @updated_at)
  `);

  const created = [];
  const failed = [];
  for (const part of req.files) {
    const id = randomUUID();
    const original = Buffer.from(part.originalname, 'latin1').toString('utf8'); // multer latin1 -> utf8
    const ext = path.extname(original);
    const key = `${userId}/${id}${ext}`;
    try {
      await storage.put(key, part.path); // moves temp file into the adapter
    } catch (e) {
      // Don't silently swallow — a full disk (ENOSPC) used to return 201 with an
      // empty list, so uploads looked like they "worked" but nothing appeared.
      logger.error('storage put failed', { code: e.code });
      fs.promises.unlink(part.path).catch(() => {}); // free the orphaned temp part
      failed.push({ name: original, code: e.code });
      continue;
    }
    const row = {
      id,
      user_id: userId,
      folder_id: folderId,
      name: original,
      original_name: original,
      mime: part.mimetype || 'application/octet-stream',
      size: part.size,
      kind: kindFromMime(part.mimetype),
      storage_key: key,
      created_at: now,
      updated_at: now,
    };
    insert.run(row);
    created.push(serialize(row));
    // Pre-generate the thumbnail in the background (non-blocking). The response is
    // sent immediately; the lazy /thumb endpoint still works if this hasn't finished.
    scheduleThumb(row);
  }

  // If every file failed to store, report it instead of faking success.
  if (!created.length && failed.length) {
    const outOfSpace = failed.some((f) => f.code === 'ENOSPC');
    logger.error('upload failed for all files', { userId, count: failed.length, outOfSpace });
    return res.status(outOfSpace ? 507 : 500).json({
      error: outOfSpace ? 'insufficient_storage' : 'storage_failed',
      failed: failed.map((f) => f.name),
    });
  }

  logger.info('files uploaded', { userId, count: created.length, failed: failed.length });
  res.status(201).json({ files: created, ...(failed.length ? { failed: failed.map((f) => f.name) } : {}) });
});

function getOwnedFile(userId, id) {
  return db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(id, userId);
}

// GET /api/files/:id — metadata
router.get('/:id', requireAuth, (req, res) => {
  const f = getOwnedFile(req.user.id, req.params.id);
  if (!f) return res.status(404).json({ error: 'not_found' });
  res.json({ file: serialize(f) });
});

// Shared streamer with HTTP Range support (video scrubbing, large files).
function streamFile(f, req, res, { download } = {}) {
  const size = f.size;
  const range = req.headers.range;
  res.setHeader('Content-Type', f.mime);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  if (download) {
    const safe = f.original_name.replace(/["\\\r\n]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  }

  if (range && size > 0) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || start < 0) start = 0;
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start > end) return res.status(416).setHeader('Content-Range', `bytes */${size}`).end();

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', end - start + 1);
    const stream = storage.createReadStream(f.storage_key, { start, end });
    stream.on('error', () => res.destroyed || res.end());
    return stream.pipe(res);
  }

  if (size > 0) res.setHeader('Content-Length', size);
  const stream = storage.createReadStream(f.storage_key);
  stream.on('error', () => res.destroyed || res.end());
  return stream.pipe(res);
}

// GET /api/files/:id/raw — inline (img/video/pdf). Flexible auth (?token=) for media tags.
router.get('/:id/raw', requireAuthFlexible, (req, res) => {
  const f = getOwnedFile(req.user.id, req.params.id);
  if (!f) return res.status(404).json({ error: 'not_found' });
  streamFile(f, req, res, { download: false });
});

async function generateThumb(f) {
  const { path: src, cleanup } = await storage.getLocalFile(f.storage_key);
  try {
    const buf = await makeThumb(f.kind, src);
    if (!buf) {
      db.prepare("UPDATE files SET thumb_status = 'unsupported' WHERE id = ?").run(f.id);
      return;
    }
    const key = `thumbs/${f.user_id}/${f.id}.jpg`;
    await storage.putBuffer(key, buf);
    db.prepare("UPDATE files SET thumb_key = ?, thumb_status = 'ready' WHERE id = ?").run(key, f.id);
  } catch (e) {
    logger.warn('thumb generation failed', { kind: f.kind, code: e.code, msg: e.message });
    db.prepare("UPDATE files SET thumb_status = 'failed' WHERE id = ?").run(f.id);
  } finally {
    await cleanup();
  }
}

// Concurrency-limited thumbnail scheduler. Shared by the upload path (pre-generate)
// and the lazy /thumb endpoint, so the same file is never generated twice and a
// large multi-file upload can't spawn dozens of ffmpeg/sharp jobs at once.
const MAX_THUMB_CONCURRENCY = 3;
const thumbInFlight = new Map(); // id -> Promise (resolves when generation completes)
const thumbQueue = [];
let activeThumbs = 0;

function pumpThumbs() {
  while (activeThumbs < MAX_THUMB_CONCURRENCY && thumbQueue.length) {
    const { f, done } = thumbQueue.shift();
    activeThumbs += 1;
    generateThumb(f).finally(() => {
      activeThumbs -= 1;
      thumbInFlight.delete(f.id);
      done();
      pumpThumbs();
    });
  }
}

// Ensure a thumbnail is (being) generated; returns a Promise that resolves when done.
// No-op for non-thumbnable kinds. Deduped via thumbInFlight.
export function scheduleThumb(f) {
  if (!THUMBNABLE.includes(f.kind)) return Promise.resolve();
  if (thumbInFlight.has(f.id)) return thumbInFlight.get(f.id);
  let done;
  const p = new Promise((resolve) => { done = resolve; });
  thumbInFlight.set(f.id, p);
  thumbQueue.push({ f, done });
  pumpThumbs();
  return p;
}

async function sendThumb(f, res) {
  const buf = await storage.getBuffer(f.thumb_key);
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(buf);
}

// GET /api/files/:id/thumb — cached JPEG thumbnail; generated lazily on first view.
router.get('/:id/thumb', requireAuthFlexible, async (req, res) => {
  const f = getOwnedFile(req.user.id, req.params.id);
  if (!f) return res.status(404).json({ error: 'not_found' });

  if (f.thumb_status === 'ready' && f.thumb_key) return sendThumb(f, res);
  if (f.thumb_status === 'failed' || f.thumb_status === 'unsupported' || !THUMBNABLE.includes(f.kind)) {
    return res.status(404).json({ error: 'no_thumb' });
  }

  // status 'none' → fallback path if pre-generation hasn't finished yet (or is disabled).
  await scheduleThumb(f);

  const nf = getOwnedFile(req.user.id, f.id);
  if (nf?.thumb_status === 'ready' && nf.thumb_key) return sendThumb(nf, res);
  return res.status(404).json({ error: 'no_thumb' });
});

// GET /api/files/:id/download — attachment
router.get('/:id/download', requireAuthFlexible, (req, res) => {
  const f = getOwnedFile(req.user.id, req.params.id);
  if (!f) return res.status(404).json({ error: 'not_found' });
  streamFile(f, req, res, { download: true });
});

// PATCH /api/files/:id — rename / move / star
router.patch('/:id', requireAuth, (req, res) => {
  const userId = req.user.id;
  const f = getOwnedFile(userId, req.params.id);
  if (!f) return res.status(404).json({ error: 'not_found' });

  const sets = [];
  const params = { id: f.id, userId, updated_at: new Date().toISOString() };

  if (typeof req.body?.name === 'string') {
    const name = req.body.name.trim().slice(0, 255);
    if (!name) return res.status(400).json({ error: 'invalid_name' });
    sets.push('name = @name');
    params.name = name;
  }
  if ('folderId' in (req.body || {})) {
    const folderId = req.body.folderId && req.body.folderId !== 'root' ? req.body.folderId : null;
    if (!ownsFolder(userId, folderId)) return res.status(403).json({ error: 'forbidden_folder' });
    sets.push('folder_id = @folderId');
    params.folderId = folderId;
  }
  if (typeof req.body?.starred === 'boolean') {
    sets.push('starred = @starred');
    params.starred = req.body.starred ? 1 : 0;
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing_to_update' });

  sets.push('updated_at = @updated_at');
  db.prepare(`UPDATE files SET ${sets.join(', ')} WHERE id = @id AND user_id = @userId`).run(params);
  res.json({ file: serialize(getOwnedFile(userId, f.id)) });
});

// DELETE /api/files/:id — remove storage object + row (right-to-delete; Checklist: Data/Security)
router.delete('/:id', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const f = getOwnedFile(userId, req.params.id);
  if (!f) return res.status(404).json({ error: 'not_found' });
  await storage.remove(f.storage_key);
  if (f.thumb_key) await storage.remove(f.thumb_key);
  db.prepare('DELETE FROM files WHERE id = ? AND user_id = ?').run(f.id, userId);
  logger.info('file deleted', { userId, fileId: f.id });
  res.json({ ok: true });
});

export default router;
