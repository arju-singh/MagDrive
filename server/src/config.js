import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/ root (one level up from src/)
export const SERVER_ROOT = path.resolve(__dirname, '..');

const resolveFromRoot = (p) => (path.isAbsolute(p) ? p : path.join(SERVER_ROOT, p));

export const config = {
  port: Number(process.env.PORT || 4000),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  storageDriver: (process.env.STORAGE_DRIVER || 'local').toLowerCase(),
  localStorageDir: resolveFromRoot(process.env.LOCAL_STORAGE_DIR || 'data/uploads'),
  maxFileBytes: Number(process.env.MAX_FILE_BYTES || 5 * 1024 * 1024 * 1024),

  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },

  dbPath: resolveFromRoot(process.env.DB_PATH || 'data/magdrive.sqlite'),
  isProd: process.env.NODE_ENV === 'production',

  // Public URLs used to build OAuth redirect URIs and the post-connect bounce-back.
  apiUrl: process.env.API_URL || `http://localhost:${Number(process.env.PORT || 4000)}`,
  clientUrl:
    process.env.CLIENT_URL ||
    (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0].trim(),

  // Cloud connectors (OAuth). Demo provider needs no credentials.
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  dropbox: {
    clientId: process.env.DROPBOX_APP_KEY || '',
    clientSecret: process.env.DROPBOX_APP_SECRET || '',
  },

  // Branding / support (used by legal pages + transactional email + feedback routing).
  appName: process.env.APP_NAME || 'MagDrive',
  companyName: process.env.COMPANY_NAME || 'MagDrive',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@magdrive.app',

  // Transactional email (SMTP via nodemailer). Inert until SMTP_HOST is set.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@magdrive.app',
  },

  // Payments (Stripe). Inert until STRIPE_SECRET_KEY is set.
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    priceId: process.env.STRIPE_PRICE_ID || '',
  },

  // "Sign in with Google" — reuses the Drive connector credentials, gated by an explicit flag.
  googleAuthEnabled:
    process.env.GOOGLE_AUTH_ENABLED === 'true' &&
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
};

// Derived feature flags (kept off config literal so they can reference the above).
config.emailEnabled = Boolean(config.smtp.host);
config.billingEnabled = Boolean(config.stripe.secretKey);

// Fail fast in production if the secret was never changed (Rule #8).
if (config.isProd && config.jwtSecret.startsWith('dev-only')) {
  throw new Error('JWT_SECRET must be set to a strong value in production.');
}
