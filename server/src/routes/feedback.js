import { randomUUID } from 'node:crypto';
import express from 'express';
import { db } from '../db.js';
import { optionalAuth } from '../auth.js';
import { rateLimit } from '../ratelimit.js';
import { sendFeedbackNotification } from '../email.js';
import { logger } from '../logger.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_KINDS = new Set(['contact', 'bug']);

// POST /api/feedback — contact/support message or bug report. Anonymous-friendly.
router.post('/', optionalAuth, rateLimit({ bucket: 'feedback', windowMs: 60_000, max: 5 }), async (req, res) => {
  const kind = VALID_KINDS.has(req.body?.kind) ? req.body.kind : 'contact';
  const message = String(req.body?.message || '').trim().slice(0, 5000);
  if (message.length < 3) return res.status(400).json({ error: 'message_required' });

  let email = String(req.body?.email || req.user?.email || '').trim().toLowerCase();
  if (email && !EMAIL_RE.test(email)) email = '';

  let meta = '{}';
  try { meta = JSON.stringify(req.body?.meta || {}).slice(0, 2000); } catch { /* keep {} */ }

  await db.run(
    `INSERT INTO feedback (id, user_id, kind, email, message, meta_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), req.user?.id || null, kind, email || null, message, meta, new Date().toISOString()],
  );

  // Best-effort notification to the support inbox (no-op if SMTP unconfigured).
  sendFeedbackNotification({ kind, fromEmail: email, message, meta: req.body?.meta }).catch(() => {});
  logger.info('feedback received', { kind, hasEmail: Boolean(email) });

  return res.status(201).json({ ok: true });
});

export default router;
