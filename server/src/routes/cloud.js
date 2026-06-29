import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { db } from '../db.js';
import { config, SERVER_ROOT } from '../config.js';
import { storage } from '../storage.js';
import { kindFromMime } from '../kinds.js';
import { requireAuth, requireAuthFlexible } from '../auth.js';
import { getProvider } from '../providers.js';
import { logger } from '../logger.js';
import { serialize, scheduleThumb } from './files.js';

const router = express.Router();

// Temp landing dir for imported streams (mirrors the upload path).
const TMP_DIR = path.join(SERVER_ROOT, 'data', 'tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

async function getConn(userId, providerKey) {
  return db.get('SELECT * FROM connections WHERE user_id = ? AND provider = ?', [userId, providerKey]);
}

async function ownsFolder(userId, folderId) {
  if (!folderId) return true;
  return !!(await db.get('SELECT 1 FROM folders WHERE id = ? AND user_id = ?', [folderId, userId]));
}

// Turn a provider.media() result into a fetch Response we can stream from.
// Handles both the redirect form (demo) and the upstream-Response form (google/dropbox).
async function openCloudStream(provider, conn, fileId) {
  const r = await provider.media({ conn, fileId });
  if (r?.redirect) {
    const up = await fetch(r.redirect, { signal: AbortSignal.timeout(60_000) });
    if (!up.ok || !up.body) throw new Error(`fetch redirect ${up.status}`);
    return up;
  }
  if (r?.upstream) {
    if (!r.upstream.ok && r.upstream.status !== 206) throw new Error(`upstream ${r.upstream.status}`);
    if (!r.upstream.body) throw new Error('upstream has no body');
    return r.upstream;
  }
  throw new Error(`no stream (status ${r?.status || '?'})`);
}

// GET /api/cloud/:provider/files?kind=&pageToken= — list files from a connected provider.
router.get('/:provider/files', requireAuth, async (req, res) => {
  const provider = getProvider(req.params.provider);
  if (!provider) return res.status(404).json({ error: 'provider_unavailable' });
  const conn = await getConn(req.user.id, provider.key);
  if (!conn) return res.status(409).json({ error: 'not_connected' });

  try {
    const { items, nextPageToken } = await provider.listFiles({
      conn, kind: req.query.kind || null, pageToken: req.query.pageToken || null,
    });
    // tag each item with its source so the client can build media/thumb URLs
    res.json({ items: items.map((i) => ({ ...i, source: provider.key })), nextPageToken });
  } catch (e) {
    logger.warn('cloud list failed', { provider: provider.key, msg: e.message });
    res.status(502).json({ error: 'provider_error' });
  }
});

// Pipe a provider's upstream fetch Response to our response, copying key headers.
function pipeUpstream(upstream, res, { fallbackType } = {}) {
  if (!upstream || !upstream.ok && upstream.status !== 206) {
    return res.status(upstream?.status === 401 ? 502 : 404).end();
  }
  const copy = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
  for (const h of copy) { const v = upstream.headers.get(h); if (v) res.setHeader(h, v); }
  if (!upstream.headers.get('content-type') && fallbackType) res.setHeader('Content-Type', fallbackType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.status(upstream.status);
  if (!upstream.body) return res.end();
  return Readable.fromWeb(upstream.body).pipe(res);
}

// GET /api/cloud/:provider/files/:id/raw — stream the original (proxy or redirect).
router.get('/:provider/files/:id/raw', requireAuthFlexible, async (req, res) => {
  const provider = getProvider(req.params.provider);
  if (!provider) return res.status(404).end();
  const conn = await getConn(req.user.id, provider.key);
  if (!conn) return res.status(409).end();
  try {
    const r = await provider.media({ conn, fileId: req.params.id, range: req.headers.range });
    if (r.redirect) return res.redirect(302, r.redirect);
    if (r.status) return res.status(r.status).end();
    return pipeUpstream(r.upstream, res);
  } catch (e) {
    logger.warn('cloud media failed', { provider: provider.key, msg: e.message });
    return res.status(502).end();
  }
});

// GET /api/cloud/:provider/files/:id/thumb — thumbnail (proxy or redirect).
router.get('/:provider/files/:id/thumb', requireAuthFlexible, async (req, res) => {
  const provider = getProvider(req.params.provider);
  if (!provider) return res.status(404).end();
  const conn = await getConn(req.user.id, provider.key);
  if (!conn) return res.status(409).end();
  try {
    const r = await provider.thumb({ conn, fileId: req.params.id });
    if (r.redirect) return res.redirect(302, r.redirect);
    if (r.status) return res.status(r.status).end();
    return pipeUpstream(r.upstream, res, { fallbackType: 'image/jpeg' });
  } catch (e) {
    logger.warn('cloud thumb failed', { provider: provider.key, msg: e.message });
    return res.status(404).end();
  }
});

// POST /api/cloud/:provider/import — copy selected cloud files INTO the local library.
// Body: { items: [{ id, name?, mime?, kind? }], folderId? }
// Each file is streamed from the provider into our own storage + a `files` row, so the
// imported copy is permanent and independent of the source (deleting it there, or
// disconnecting, never removes it here). The source is never modified.
router.post('/:provider/import', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const provider = getProvider(req.params.provider);
  if (!provider) return res.status(404).json({ error: 'provider_unavailable' });
  const conn = await getConn(userId, provider.key);
  if (!conn) return res.status(409).json({ error: 'not_connected' });

  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : [];
  if (!items.length) return res.status(400).json({ error: 'no_items' });
  const folderId = req.body?.folderId && req.body.folderId !== 'root' ? req.body.folderId : null;
  if (folderId && !(await ownsFolder(userId, folderId))) return res.status(403).json({ error: 'forbidden_folder' });

  const now = new Date().toISOString();
  const insertSql = `
    INSERT INTO files (id, user_id, folder_id, name, original_name, mime, size, kind, storage_key, starred, created_at, updated_at)
    VALUES (@id, @user_id, @folder_id, @name, @original_name, @mime, @size, @kind, @storage_key, 0, @created_at, @updated_at)
  `;

  const created = [];
  const failed = [];
  for (const item of items) {
    const fileId = String(item?.id || '');
    if (!fileId) { failed.push({ id: fileId, error: 'bad_id' }); continue; }
    const id = randomUUID();
    const name = String(item?.name || 'Untitled').slice(0, 255);
    const ext = path.extname(name);
    const key = `${userId}/${id}${ext}`;
    const tmp = path.join(TMP_DIR, `${id}.part`);

    try {
      const up = await openCloudStream(provider, conn, fileId);
      // Stream to a temp file with a hard size cap (mirrors the upload limit).
      let bytes = 0;
      const cap = config.maxFileBytes;
      const counter = new Transform({
        transform(chunk, _enc, cb) {
          bytes += chunk.length;
          if (bytes > cap) return cb(Object.assign(new Error('too_large'), { code: 'TOO_LARGE' }));
          cb(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(up.body), counter, fs.createWriteStream(tmp));

      const mime = item?.mime || up.headers.get('content-type') || 'application/octet-stream';
      await storage.put(key, tmp); // moves the temp file into the adapter
      const row = {
        id, user_id: userId, folder_id: folderId,
        name, original_name: name, mime,
        size: bytes, kind: item?.kind || kindFromMime(mime),
        storage_key: key, created_at: now, updated_at: now,
      };
      await db.run(insertSql, row);
      created.push(serialize(row));
      scheduleThumb(row); // background thumbnail, same as uploads
    } catch (e) {
      await fs.promises.unlink(tmp).catch(() => {});
      logger.warn('cloud import failed', { provider: provider.key, code: e.code, msg: e.message });
      failed.push({ id: fileId, error: e.code === 'TOO_LARGE' ? 'too_large' : 'import_failed' });
    }
  }

  if (!created.length) return res.status(502).json({ error: 'import_failed', failed });
  logger.info('cloud import', { userId, provider: provider.key, count: created.length, failed: failed.length });
  res.status(201).json({ files: created, imported: created.length, failed });
});

export default router;
