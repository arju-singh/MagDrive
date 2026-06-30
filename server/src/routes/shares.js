import { randomUUID } from 'node:crypto';
import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { logger } from '../logger.js';

const router = express.Router();

const TYPES = ['file', 'magazine'];

function serialize(s) {
  return { id: s.id, token: s.token, type: s.target_type, targetId: s.target_id, createdAt: s.created_at };
}

// Confirm the caller owns the thing they're trying to share.
async function ownsTarget(userId, type, id) {
  const table = type === 'file' ? 'files' : 'magazines';
  return !!(await db.get(`SELECT 1 FROM ${table} WHERE id = ? AND user_id = ?`, [id, userId]));
}

// GET /api/shares?type=&id= — the existing share for one target (or null).
// GET /api/shares — all of the caller's shares.
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { type, id } = req.query;
  if (type && id) {
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'invalid_type' });
    const s = await db.get('SELECT * FROM shares WHERE user_id = ? AND target_type = ? AND target_id = ?', [userId, type, id]);
    return res.json({ share: s ? serialize(s) : null });
  }
  const rows = await db.all('SELECT * FROM shares WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  res.json({ shares: rows.map(serialize) });
});

// POST /api/shares — { type, id }. Idempotent: returns the existing share if any.
router.post('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const type = req.body?.type;
  const id = req.body?.id;
  if (!TYPES.includes(type) || typeof id !== 'string' || !id) return res.status(400).json({ error: 'invalid_target' });
  if (!(await ownsTarget(userId, type, id))) return res.status(404).json({ error: 'not_found' });

  const existing = await db.get('SELECT * FROM shares WHERE user_id = ? AND target_type = ? AND target_id = ?', [userId, type, id]);
  if (existing) return res.json({ share: serialize(existing) });

  const share = { id: randomUUID(), user_id: userId, token: randomUUID(), target_type: type, target_id: id, created_at: new Date().toISOString() };
  await db.run('INSERT INTO shares (id, user_id, token, target_type, target_id, created_at) VALUES (@id, @user_id, @token, @target_type, @target_id, @created_at)', share);
  logger.info('share created', { userId, type });
  res.status(201).json({ share: serialize(share) });
});

// DELETE /api/shares/:id — revoke (stops the public link working).
router.delete('/:id', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { changes } = await db.run('DELETE FROM shares WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

export default router;
