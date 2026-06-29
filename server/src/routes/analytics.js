import { randomUUID } from 'node:crypto';
import express from 'express';
import { db } from '../db.js';
import { requireAuth, optionalAuth } from '../auth.js';
import { rateLimit } from '../ratelimit.js';

const router = express.Router();

const VALID_TYPES = new Set(['page', 'event']);

// POST /api/analytics — record a pageview or custom event.
// Anonymous-friendly (attaches user_id when a Bearer token is present).
// Privacy: we keep the User-Agent for device/browser breakdowns but never the raw IP.
router.post('/', optionalAuth, rateLimit({ bucket: 'analytics', windowMs: 60_000, max: 120 }), async (req, res) => {
  const type = VALID_TYPES.has(req.body?.type) ? req.body.type : 'event';
  const name = String(req.body?.name || '').slice(0, 120);
  if (!name) return res.status(400).json({ error: 'name_required' });
  const path = String(req.body?.path || '').slice(0, 300) || null;
  const anonId = String(req.body?.anonId || '').slice(0, 64) || null;
  let props = '{}';
  try { props = JSON.stringify(req.body?.props || {}).slice(0, 2000); } catch { /* keep {} */ }

  await db.run(
    `INSERT INTO analytics_events (id, user_id, anon_id, type, name, path, props_json, ua, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      req.user?.id || null,
      anonId,
      type,
      name,
      path,
      props,
      String(req.headers['user-agent'] || '').slice(0, 300),
      new Date().toISOString(),
    ],
  );
  return res.status(204).end();
});

// GET /api/analytics/summary — simple 30-day rollup for the signed-in account.
router.get('/summary', requireAuth, async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const pageviews = (await db.get(
    `SELECT COUNT(*) AS n FROM analytics_events WHERE type = 'page' AND created_at >= ?`,
    [since],
  ))?.n || 0;
  const topEvents = await db.all(
    `SELECT name, COUNT(*) AS n FROM analytics_events
     WHERE type = 'event' AND created_at >= ? GROUP BY name ORDER BY n DESC LIMIT 10`,
    [since],
  );
  const topPages = await db.all(
    `SELECT path, COUNT(*) AS n FROM analytics_events
     WHERE type = 'page' AND created_at >= ? AND path IS NOT NULL GROUP BY path ORDER BY n DESC LIMIT 10`,
    [since],
  );
  res.json({ since, pageviews, topEvents, topPages });
});

export default router;
