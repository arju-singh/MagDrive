import { randomUUID, randomBytes, createHash } from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { rateLimit } from './ratelimit.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TTL_MS = 60 * 60 * 1000;       // 1h

function sign(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.created_at,
    emailVerified: Boolean(u.email_verified),
    plan: u.plan || 'free',
  };
}

// ---- single-use, hashed, expiring tokens (verify | reset) ----
async function createEmailToken(userId, type, ttlMs) {
  const raw = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(raw).digest('hex');
  await db.run(
    'INSERT INTO email_tokens (id, user_id, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [randomUUID(), userId, type, tokenHash, Date.now() + ttlMs, new Date().toISOString()],
  );
  return raw;
}

async function consumeEmailToken(raw, type) {
  const tokenHash = createHash('sha256').update(String(raw || '')).digest('hex');
  const row = await db.get('SELECT * FROM email_tokens WHERE token_hash = ? AND type = ?', [tokenHash, type]);
  if (!row || row.used_at || row.expires_at < Date.now()) return null;
  await db.run('UPDATE email_tokens SET used_at = ? WHERE id = ?', [new Date().toISOString(), row.id]);
  return row;
}

const verifyLink = (raw) => `${config.apiUrl}/api/auth/verify?token=${raw}`;
const resetLink = (raw) => `${config.clientUrl}/reset-password?token=${raw}`;

/**
 * Auth middleware — runs FIRST on every protected route (Rule #1, Per-Feature DoD step 3).
 * Deny-by-default: no/invalid token => 401. Attaches req.user = { id, email }.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

/**
 * Like requireAuth, but also accepts ?token= for media endpoints that the browser
 * loads via <img>/<video> (which cannot set an Authorization header). Still verified
 * + user-scoped — the token is a normal signed JWT, just delivered in the query.
 */
export function requireAuthFlexible(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : (typeof req.query.token === 'string' ? req.query.token : null);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

/**
 * Soft auth: attaches req.user when a valid Bearer token is present, otherwise
 * continues anonymously. Used by analytics + feedback which accept both.
 */
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      req.user = { id: payload.sub, email: payload.email };
    } catch { /* stay anonymous */ }
  }
  return next();
}

export const authRouter = express.Router();

// Public feature-flag probe so the client renders only the buttons that work.
authRouter.get('/config', (_req, res) => {
  res.json({
    googleAuth: config.googleAuthEnabled,
    emailEnabled: config.emailEnabled,
    billingEnabled: config.billingEnabled,
  });
});

authRouter.post('/register', rateLimit({ bucket: 'register', windowMs: 60_000, max: 10 }), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim().slice(0, 80);

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid_email' });
  if (password.length < 8) return res.status(400).json({ error: 'weak_password', message: 'Password must be at least 8 characters.' });

  const exists = await db.get('SELECT 1 FROM users WHERE email = ?', [email]);
  if (exists) return res.status(409).json({ error: 'email_taken' });

  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: randomUUID(),
    email,
    password_hash: hash,
    name: name || email.split('@')[0],
    created_at: new Date().toISOString(),
  };
  await db.run(
    'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
    [user.id, user.email, user.password_hash, user.name, user.created_at],
  );

  // Fire-and-forget verification email (best-effort; never blocks signup).
  const raw = await createEmailToken(user.id, 'verify', VERIFY_TTL_MS);
  sendVerificationEmail(user.email, verifyLink(raw)).catch(() => {});

  logger.info('user registered', { userId: user.id });
  return res.status(201).json({ token: sign(user), user: publicUser(user) });
});

authRouter.post('/login', rateLimit({ bucket: 'login', windowMs: 60_000, max: 10 }), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  // Same response shape/time-ish for missing user vs bad password (no user enumeration).
  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  return res.json({ token: sign(user), user: publicUser(user) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'not_found' });
  return res.json({ user: publicUser(user) });
});

// ---- email verification ----
authRouter.post('/verify/request', requireAuth, rateLimit({ bucket: 'verify', windowMs: 60_000, max: 5 }), async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (user.email_verified) return res.json({ ok: true, alreadyVerified: true });
  const raw = await createEmailToken(user.id, 'verify', VERIFY_TTL_MS);
  sendVerificationEmail(user.email, verifyLink(raw)).catch(() => {});
  return res.json({ ok: true });
});

authRouter.get('/verify', async (req, res) => {
  const row = await consumeEmailToken(req.query.token, 'verify');
  const bounce = (status) => res.redirect(`${config.clientUrl}/?verified=${status}`);
  if (!row) return bounce('invalid');
  await db.run('UPDATE users SET email_verified = 1 WHERE id = ?', [row.user_id]);
  logger.info('email verified', { userId: row.user_id });
  return bounce('1');
});

// ---- password reset ----
authRouter.post('/password/forgot', rateLimit({ bucket: 'forgot', windowMs: 60_000, max: 5 }), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  // Always 200 — never reveal whether the address exists (no user enumeration).
  if (EMAIL_RE.test(email)) {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (user) {
      const raw = await createEmailToken(user.id, 'reset', RESET_TTL_MS);
      sendPasswordResetEmail(user.email, resetLink(raw)).catch(() => {});
    }
  }
  return res.json({ ok: true });
});

authRouter.post('/password/reset', rateLimit({ bucket: 'reset', windowMs: 60_000, max: 10 }), async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (password.length < 8) return res.status(400).json({ error: 'weak_password', message: 'Password must be at least 8 characters.' });
  const row = await consumeEmailToken(token, 'reset');
  if (!row) return res.status(400).json({ error: 'invalid_token' });
  const hash = await bcrypt.hash(password, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id]);
  logger.info('password reset', { userId: row.user_id });
  return res.json({ ok: true });
});

// ===================================================================
// "Sign in with Google" (OAuth login — distinct from the Drive connector).
// Gated by config.googleAuthEnabled. Reuses GOOGLE_CLIENT_ID/SECRET.
// ===================================================================
const googleRedirectUri = () => `${config.apiUrl}/api/auth/google/callback`;

authRouter.get('/google', (req, res) => {
  if (!config.googleAuthEnabled) return res.status(404).json({ error: 'google_auth_unavailable' });
  const state = jwt.sign({ purpose: 'login-google', nonce: randomUUID() }, config.jwtSecret, { expiresIn: '10m' });
  const p = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
});

authRouter.get('/google/callback', async (req, res) => {
  const fail = () => res.redirect(`${config.clientUrl}/auth/callback#error=google`);
  if (!config.googleAuthEnabled || req.query.error) return fail();
  try {
    jwt.verify(String(req.query.state || ''), config.jwtSecret); // CSRF: signed state
  } catch {
    return fail();
  }
  try {
    const body = new URLSearchParams({
      code: String(req.query.code || ''),
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    });
    const tokRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
    if (!tokRes.ok) throw new Error(`token ${tokRes.status}`);
    const tok = await tokRes.json();
    const uiRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!uiRes.ok) throw new Error(`userinfo ${uiRes.status}`);
    const profile = await uiRes.json(); // { id, email, name, ... }
    const user = await upsertGoogleUser(profile);
    logger.info('google sign-in', { userId: user.id });
    return res.redirect(`${config.clientUrl}/auth/callback#token=${sign(user)}`);
  } catch (e) {
    logger.warn('google sign-in failed', { msg: e.message });
    return fail();
  }
});

// Find-or-create a user from a Google profile, linking via auth_identities.
async function upsertGoogleUser(profile) {
  const providerUserId = String(profile.id);
  const email = String(profile.email || '').trim().toLowerCase();

  const ident = await db.get(
    'SELECT user_id FROM auth_identities WHERE provider = ? AND provider_user_id = ?',
    ['google', providerUserId],
  );
  if (ident) return db.get('SELECT * FROM users WHERE id = ?', [ident.user_id]);

  // Link to an existing account with the same (Google-verified) email, else create one.
  let user = email ? await db.get('SELECT * FROM users WHERE email = ?', [email]) : null;
  if (!user) {
    user = {
      id: randomUUID(),
      email: email || `google_${providerUserId}@users.noreply`,
      password_hash: '', // OAuth-only account; password login disabled until a reset is done
      name: String(profile.name || email.split('@')[0] || 'User').slice(0, 80),
      created_at: new Date().toISOString(),
    };
    await db.run(
      'INSERT INTO users (id, email, password_hash, name, created_at, email_verified) VALUES (?, ?, ?, ?, ?, 1)',
      [user.id, user.email, user.password_hash, user.name, user.created_at],
    );
  } else if (!user.email_verified) {
    await db.run('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id]);
  }
  await db.run(
    'INSERT INTO auth_identities (id, user_id, provider, provider_user_id, created_at) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), user.id, 'google', providerUserId, new Date().toISOString()],
  );
  return db.get('SELECT * FROM users WHERE id = ?', [user.id]);
}
