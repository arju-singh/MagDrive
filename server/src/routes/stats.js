import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

// GET /api/stats — storage usage + per-kind counts for the dashboard.
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const totals = await db.get(
    'SELECT COUNT(*) AS files, COALESCE(SUM(size), 0) AS bytes FROM files WHERE user_id = ?',
    [userId]
  );
  const byKindRows = await db.all(
    'SELECT kind, COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM files WHERE user_id = ? GROUP BY kind',
    [userId]
  );
  const folders = (await db.get('SELECT COUNT(*) AS c FROM folders WHERE user_id = ?', [userId])).c;
  const magazines = (await db.get('SELECT COUNT(*) AS c FROM magazines WHERE user_id = ?', [userId])).c;

  const byKind = {};
  for (const r of byKindRows) byKind[r.kind] = { count: r.count, bytes: r.bytes };

  res.json({
    files: totals.files,
    bytes: totals.bytes,
    folders,
    magazines,
    byKind,
  });
});

export default router;
