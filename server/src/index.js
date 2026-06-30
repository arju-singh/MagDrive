import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { logger } from './logger.js';
import { migrate } from './db.js';
import { authRouter } from './auth.js';
import filesRouter from './routes/files.js';
import foldersRouter from './routes/folders.js';
import magazinesRouter from './routes/magazines.js';
import statsRouter from './routes/stats.js';
import connectionsRouter from './routes/connections.js';
import cloudRouter from './routes/cloud.js';
import shelvesRouter from './routes/shelves.js';
import billingRouter, { handleWebhook } from './routes/billing.js';
import analyticsRouter from './routes/analytics.js';
import feedbackRouter from './routes/feedback.js';
import sharesRouter from './routes/shares.js';
import publicRouter from './routes/public.js';

await migrate();

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigins, credentials: true }));

// Stripe webhook needs the raw body for signature verification — mount it BEFORE
// express.json() so the body isn't parsed/consumed first.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json({ limit: '1mb' }));

// Observability: /health for uptime checks (Rule #6). No auth, no data.
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/files', filesRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/magazines', magazinesRouter);
app.use('/api/stats', statsRouter);
app.use('/api', connectionsRouter); // /api/connections, /api/connect/*
app.use('/api/cloud', cloudRouter);
app.use('/api/shelves', shelvesRouter);
app.use('/api/billing', billingRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/shares', sharesRouter);   // authed: create/revoke links
app.use('/api/public', publicRouter);   // no auth: view shared files/magazines

app.use((req, res) => res.status(404).json({ error: 'not_found' }));

// Centralized error handler — maps known cases, never leaks internals/PII (Rule #8).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file_too_large', maxBytes: config.maxFileBytes });
  }
  logger.error('unhandled error', { name: err?.name, code: err?.code });
  res.status(500).json({ error: 'internal_error' });
});

const server = app.listen(config.port, () => {
  logger.info('magdrive api listening', { port: config.port, driver: config.storageDriver });
});

// Graceful shutdown (Operations Runbook).
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    logger.info('shutting down', { sig });
    server.close(() => process.exit(0));
  });
}
