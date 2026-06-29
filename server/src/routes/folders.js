import { randomUUID } from 'node:crypto';
import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

function serialize(f) {
  return { id: f.id, name: f.name, parentId: f.parent_id, createdAt: f.created_at };
}

function owns(userId, folderId) {
  if (!folderId) return true;
  return !!db.prepare('SELECT 1 FROM folders WHERE id = ? AND user_id = ?').get(folderId, userId);
}

// GET /api/folders?parentId=root|<id> — children of a folder (defaults to root).
router.get('/', requireAuth, (req, res) => {
  const userId = req.user.id;
  const parentId = req.query.parentId && req.query.parentId !== 'root' ? req.query.parentId : null;
  const rows = parentId
    ? db.prepare('SELECT * FROM folders WHERE user_id = ? AND parent_id = ? ORDER BY name').all(userId, parentId)
    : db.prepare('SELECT * FROM folders WHERE user_id = ? AND parent_id IS NULL ORDER BY name').all(userId);
  res.json({ folders: rows.map(serialize) });
});

// POST /api/folders — { name, parentId? }
router.post('/', requireAuth, (req, res) => {
  const userId = req.user.id;
  const name = String(req.body?.name || '').trim().slice(0, 120);
  const parentId = req.body?.parentId && req.body.parentId !== 'root' ? req.body.parentId : null;
  if (!name) return res.status(400).json({ error: 'invalid_name' });
  if (!owns(userId, parentId)) return res.status(403).json({ error: 'forbidden_parent' });

  const folder = { id: randomUUID(), user_id: userId, name, parent_id: parentId, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO folders (id, user_id, name, parent_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(folder.id, folder.user_id, folder.name, folder.parent_id, folder.created_at);
  res.status(201).json({ folder: serialize(folder) });
});

// PATCH /api/folders/:id — rename / reparent
router.patch('/:id', requireAuth, (req, res) => {
  const userId = req.user.id;
  const folder = db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!folder) return res.status(404).json({ error: 'not_found' });

  const sets = [];
  const params = { id: folder.id, userId };
  if (typeof req.body?.name === 'string') {
    const name = req.body.name.trim().slice(0, 120);
    if (!name) return res.status(400).json({ error: 'invalid_name' });
    sets.push('name = @name');
    params.name = name;
  }
  if ('parentId' in (req.body || {})) {
    const parentId = req.body.parentId && req.body.parentId !== 'root' ? req.body.parentId : null;
    if (parentId === folder.id) return res.status(400).json({ error: 'self_parent' });
    if (!owns(userId, parentId)) return res.status(403).json({ error: 'forbidden_parent' });
    sets.push('parent_id = @parentId');
    params.parentId = parentId;
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing_to_update' });
  db.prepare(`UPDATE folders SET ${sets.join(', ')} WHERE id = @id AND user_id = @userId`).run(params);
  const updated = db.prepare('SELECT * FROM folders WHERE id = ?').get(folder.id);
  res.json({ folder: serialize(updated) });
});

// DELETE /api/folders/:id — cascades to subfolders; contained files have folder_id set NULL.
router.delete('/:id', requireAuth, (req, res) => {
  const userId = req.user.id;
  const folder = db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!folder) return res.status(404).json({ error: 'not_found' });
  db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?').run(folder.id, userId);
  res.json({ ok: true });
});

export default router;
