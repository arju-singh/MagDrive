import { logger } from './logger.js';

/**
 * In-memory sliding-window rate limiter (single-instance).
 *
 * For a multi-instance deployment swap the Map for a shared store (Redis) —
 * the interface (hit count per key per window) stays the same.
 *
 * Keyed by `<bucket>:<ip>`. Each key holds an array of recent hit timestamps;
 * we drop any older than the window before counting.
 */
const hits = new Map();

function clientIp(req) {
  // Trust the left-most XFF entry when behind a proxy; fall back to the socket.
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function rateLimit({ windowMs = 60_000, max = 30, bucket = 'default' } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${bucket}:${clientIp(req)}`;
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - arr[0])) / 1000);
      res.set('Retry-After', String(retryAfter));
      logger.warn('rate limited', { bucket, retryAfter });
      return res.status(429).json({ error: 'rate_limited', retryAfter });
    }
    arr.push(now);
    hits.set(key, arr);
    return next();
  };
}

// Periodic cleanup so the Map doesn't grow unbounded for idle keys.
const SWEEP_MS = 5 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, arr] of hits) {
    const live = arr.filter((t) => now - t < SWEEP_MS);
    if (live.length) hits.set(key, live);
    else hits.delete(key);
  }
}, SWEEP_MS).unref();
