import { randomUUID } from 'node:crypto';
import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

const THEMES = ['editorial', 'mono', 'vogue', 'zine', 'noir'];
const MAX_LAYOUT_BYTES = 256 * 1024; // guardrail on stored JSON size

function serialize(m) {
  let layout;
  try {
    layout = JSON.parse(m.layout_json);
  } catch {
    layout = { blocks: [] };
  }
  return {
    id: m.id,
    title: m.title,
    theme: m.theme,
    coverFileId: m.cover_file_id,
    layout,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

// Validate that any file referenced in the layout/cover belongs to the user.
function validateRefs(userId, layout, coverFileId) {
  const ids = new Set();
  if (coverFileId) ids.add(coverFileId);
  for (const b of layout?.blocks || []) {
    if (b?.fileId) ids.add(b.fileId);
    for (const fid of b?.fileIds || []) ids.add(fid);
  }
  for (const id of ids) {
    const ok = db.prepare('SELECT 1 FROM files WHERE id = ? AND user_id = ?').get(id, userId);
    if (!ok) return false;
  }
  return true;
}

function normalizeLayout(input) {
  const blocks = Array.isArray(input?.blocks) ? input.blocks : [];
  return {
    blocks: blocks.slice(0, 200).map((b) => ({
      id: typeof b?.id === 'string' ? b.id : randomUUID(),
      type: ['cover', 'heading', 'text', 'image', 'gallery', 'video', 'quote', 'spacer'].includes(b?.type)
        ? b.type
        : 'text',
      text: typeof b?.text === 'string' ? b.text.slice(0, 5000) : '',
      fileId: typeof b?.fileId === 'string' ? b.fileId : null,
      fileIds: Array.isArray(b?.fileIds) ? b.fileIds.filter((x) => typeof x === 'string').slice(0, 30) : [],
      align: ['left', 'center', 'right'].includes(b?.align) ? b.align : 'left',
      size: ['s', 'm', 'l', 'full'].includes(b?.size) ? b.size : 'm',
    })),
  };
}

// GET /api/magazines — list
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM magazines WHERE user_id = ? ORDER BY updated_at DESC')
    .all(req.user.id);
  res.json({ magazines: rows.map(serialize) });
});

// GET /api/magazines/:id
router.get('/:id', requireAuth, (req, res) => {
  const m = db.prepare('SELECT * FROM magazines WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!m) return res.status(404).json({ error: 'not_found' });
  res.json({ magazine: serialize(m) });
});

// POST /api/magazines — { title, theme?, layout? }
router.post('/', requireAuth, (req, res) => {
  const userId = req.user.id;
  const title = String(req.body?.title || '').trim().slice(0, 160) || 'Untitled Magazine';
  const theme = THEMES.includes(req.body?.theme) ? req.body.theme : 'editorial';
  const layout = normalizeLayout(req.body?.layout);
  const coverFileId = typeof req.body?.coverFileId === 'string' ? req.body.coverFileId : null;

  if (!validateRefs(userId, layout, coverFileId)) return res.status(403).json({ error: 'forbidden_file_ref' });
  const layoutJson = JSON.stringify(layout);
  if (layoutJson.length > MAX_LAYOUT_BYTES) return res.status(413).json({ error: 'layout_too_large' });

  const now = new Date().toISOString();
  const m = {
    id: randomUUID(),
    user_id: userId,
    title,
    theme,
    cover_file_id: coverFileId,
    layout_json: layoutJson,
    created_at: now,
    updated_at: now,
  };
  db.prepare(`INSERT INTO magazines (id, user_id, title, theme, cover_file_id, layout_json, created_at, updated_at)
              VALUES (@id, @user_id, @title, @theme, @cover_file_id, @layout_json, @created_at, @updated_at)`).run(m);
  res.status(201).json({ magazine: serialize(m) });
});

// PATCH /api/magazines/:id — update title/theme/cover/layout
router.patch('/:id', requireAuth, (req, res) => {
  const userId = req.user.id;
  const m = db.prepare('SELECT * FROM magazines WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!m) return res.status(404).json({ error: 'not_found' });

  const sets = [];
  const params = { id: m.id, userId, updated_at: new Date().toISOString() };

  if (typeof req.body?.title === 'string') {
    sets.push('title = @title');
    params.title = req.body.title.trim().slice(0, 160) || 'Untitled Magazine';
  }
  if (THEMES.includes(req.body?.theme)) {
    sets.push('theme = @theme');
    params.theme = req.body.theme;
  }
  if ('coverFileId' in (req.body || {})) {
    const coverFileId = typeof req.body.coverFileId === 'string' ? req.body.coverFileId : null;
    if (coverFileId && !db.prepare('SELECT 1 FROM files WHERE id = ? AND user_id = ?').get(coverFileId, userId))
      return res.status(403).json({ error: 'forbidden_file_ref' });
    sets.push('cover_file_id = @coverFileId');
    params.coverFileId = coverFileId;
  }
  if ('layout' in (req.body || {})) {
    const layout = normalizeLayout(req.body.layout);
    if (!validateRefs(userId, layout, null)) return res.status(403).json({ error: 'forbidden_file_ref' });
    const layoutJson = JSON.stringify(layout);
    if (layoutJson.length > MAX_LAYOUT_BYTES) return res.status(413).json({ error: 'layout_too_large' });
    sets.push('layout_json = @layoutJson');
    params.layoutJson = layoutJson;
  }
  if (sets.length === 1) return res.status(400).json({ error: 'nothing_to_update' }); // only updated_at

  sets.push('updated_at = @updated_at');
  db.prepare(`UPDATE magazines SET ${sets.join(', ')} WHERE id = @id AND user_id = @userId`).run(params);
  const updated = db.prepare('SELECT * FROM magazines WHERE id = ?').get(m.id);
  res.json({ magazine: serialize(updated) });
});

// DELETE /api/magazines/:id
router.delete('/:id', requireAuth, (req, res) => {
  const userId = req.user.id;
  const m = db.prepare('SELECT * FROM magazines WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!m) return res.status(404).json({ error: 'not_found' });
  db.prepare('DELETE FROM magazines WHERE id = ? AND user_id = ?').run(m.id, userId);
  res.json({ ok: true });
});

export default router;
