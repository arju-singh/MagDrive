import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../auth.js';
import { logger } from '../logger.js';
import { getProvider, availableProviders } from '../providers.js';

const router = express.Router();

const redirectUriFor = (provider) => `${config.apiUrl}/api/connect/${provider}/callback`;

function serializeConn(c) {
  return { provider: c.provider, accountLabel: c.account_label, connectedAt: c.created_at };
}

async function upsertConnection(userId, provider, { accountLabel = '', accessToken = null, refreshToken = null, expiresAt = null }) {
  const existing = await db.get('SELECT id FROM connections WHERE user_id = ? AND provider = ?', [userId, provider]);
  if (existing) {
    await db.run(`UPDATE connections SET account_label = @label, access_token = @access, refresh_token = COALESCE(@refresh, refresh_token), expires_at = @exp WHERE id = @id`,
      { id: existing.id, label: accountLabel, access: accessToken, refresh: refreshToken, exp: expiresAt });
    return existing.id;
  }
  const id = randomUUID();
  await db.run(`INSERT INTO connections (id, user_id, provider, account_label, access_token, refresh_token, expires_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, provider, accountLabel, accessToken, refreshToken, expiresAt, new Date().toISOString()]);
  return id;
}

// GET /api/connections — current connections + which providers can be offered.
router.get('/connections', requireAuth, async (req, res) => {
  const rows = await db.all('SELECT * FROM connections WHERE user_id = ? ORDER BY created_at', [req.user.id]);
  res.json({ connections: rows.map(serializeConn), available: availableProviders() });
});

// DELETE /api/connections/:provider — disconnect.
router.delete('/connections/:provider', requireAuth, async (req, res) => {
  await db.run('DELETE FROM connections WHERE user_id = ? AND provider = ?', [req.user.id, req.params.provider]);
  res.json({ ok: true });
});

// GET /api/connect/:provider — start connecting.
//  demo  -> create the connection immediately, return { connected: true }
//  oauth -> return { url } for the client to navigate to
router.get('/connect/:provider', requireAuth, async (req, res) => {
  const provider = getProvider(req.params.provider);
  if (!provider || !provider.isConfigured()) return res.status(404).json({ error: 'provider_unavailable' });

  if (!provider.oauth) {
    await upsertConnection(req.user.id, provider.key, { accountLabel: provider.label });
    return res.json({ connected: true });
  }
  // Signed, short-lived state ties the callback back to this user.
  const state = jwt.sign({ sub: req.user.id, provider: provider.key }, config.jwtSecret, { expiresIn: '10m' });
  return res.json({ url: provider.getAuthUrl(state, redirectUriFor(provider.key)) });
});

// GET /api/connect/:provider/callback — OAuth redirect target (no auth header; uses state).
router.get('/connect/:provider/callback', async (req, res) => {
  const provider = getProvider(req.params.provider);
  const bounce = (status) => res.redirect(`${config.clientUrl}/browse?connect=${status}`);
  if (!provider || !provider.oauth || !provider.isConfigured()) return bounce('error');
  if (req.query.error) return bounce('denied');

  let userId;
  try {
    const payload = jwt.verify(String(req.query.state || ''), config.jwtSecret);
    if (payload.provider !== provider.key) throw new Error('state mismatch');
    userId = payload.sub;
  } catch {
    return bounce('error');
  }

  try {
    const tokens = await provider.exchangeCode(String(req.query.code || ''), redirectUriFor(provider.key));
    await upsertConnection(userId, provider.key, tokens);
    logger.info('cloud connected', { userId, provider: provider.key });
    return bounce(provider.key);
  } catch (e) {
    logger.warn('oauth callback failed', { provider: provider.key, msg: e.message });
    return bounce('error');
  }
});

export default router;
