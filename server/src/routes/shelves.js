import { randomUUID } from 'node:crypto';
import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

const SOURCES = ['local', 'demo', 'google', 'dropbox'];
const KINDS = ['image', 'video', 'audio', 'pdf', 'doc', 'other'];

function serialize(s) {
  let items = [];
  try { items = JSON.parse(s.items_json); } catch { items = []; }
  return { id: s.id, title: s.title, position: s.position, items, updatedAt: s.updated_at };
}

// Keep only well-formed item refs; the client builds media URLs from source+id.
function normalizeItems(input) {
  if (!Array.isArray(input)) return null;
  return input.slice(0, 100)
    .filter((i) => i && SOURCES.includes(i.source) && typeof i.id === 'string')
    .map((i) => ({
      source: i.source,
      id: i.id,
      name: typeof i.name === 'string' ? i.name.slice(0, 300) : '',
      kind: KINDS.includes(i.kind) ? i.kind : 'other',
    }));
}

// GET /api/shelves
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM shelves WHERE user_id = ? ORDER BY position, created_at').all(req.user.id);
  res.json({ shelves: rows.map(serialize) });
});

// POST /api/shelves { title }
router.post('/', requireAuth, (req, res) => {
  const userId = req.user.id;
  const title = String(req.body?.title || '').trim().slice(0, 120) || 'New shelf';
  const max = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM shelves WHERE user_id = ?').get(userId).m;
  const now = new Date().toISOString();
  const s = { id: randomUUID(), user_id: userId, title, position: max + 1, items_json: '[]', created_at: now, updated_at: now };
  db.prepare(`INSERT INTO shelves (id, user_id, title, position, items_json, created_at, updated_at)
              VALUES (@id, @user_id, @title, @position, @items_json, @created_at, @updated_at)`).run(s);
  res.status(201).json({ shelf: serialize(s) });
});

// PATCH /api/shelves/:id { title?, position?, items? }
router.patch('/:id', requireAuth, (req, res) => {
  const userId = req.user.id;
  const shelf = db.prepare('SELECT * FROM shelves WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!shelf) return res.status(404).json({ error: 'not_found' });

  const sets = [];
  const params = { id: shelf.id, userId, updated_at: new Date().toISOString() };
  if (typeof req.body?.title === 'string') {
    sets.push('title = @title');
    params.title = req.body.title.trim().slice(0, 120) || 'Untitled shelf';
  }
  if (Number.isInteger(req.body?.position)) {
    sets.push('position = @position');
    params.position = req.body.position;
  }
  if ('items' in (req.body || {})) {
    const items = normalizeItems(req.body.items);
    if (!items) return res.status(400).json({ error: 'invalid_items' });
    sets.push('items_json = @items');
    params.items = JSON.stringify(items);
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing_to_update' });

  sets.push('updated_at = @updated_at');
  db.prepare(`UPDATE shelves SET ${sets.join(', ')} WHERE id = @id AND user_id = @userId`).run(params);
  res.json({ shelf: serialize(db.prepare('SELECT * FROM shelves WHERE id = ?').get(shelf.id)) });
});

// DELETE /api/shelves/:id
router.delete('/:id', requireAuth, (req, res) => {
  const r = db.prepare('DELETE FROM shelves WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

export default router;
