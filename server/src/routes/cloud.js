import { Readable } from 'node:stream';
import express from 'express';
import { db } from '../db.js';
import { requireAuth, requireAuthFlexible } from '../auth.js';
import { getProvider } from '../providers.js';
import { logger } from '../logger.js';

const router = express.Router();

function getConn(userId, providerKey) {
  return db.prepare('SELECT * FROM connections WHERE user_id = ? AND provider = ?').get(userId, providerKey);
}

// GET /api/cloud/:provider/files?kind=&pageToken= — list files from a connected provider.
router.get('/:provider/files', requireAuth, async (req, res) => {
  const provider = getProvider(req.params.provider);
  if (!provider) return res.status(404).json({ error: 'provider_unavailable' });
  const conn = getConn(req.user.id, provider.key);
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
  const conn = getConn(req.user.id, provider.key);
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
  const conn = getConn(req.user.id, provider.key);
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

export default router;
