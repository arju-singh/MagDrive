import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { logger } from './logger.js';

// Dual-driver data layer. Same async API for both backends so route code is
// identical regardless of driver:
//   await db.get(sql, params)  -> first row | undefined
//   await db.all(sql, params)  -> rows[]
//   await db.run(sql, params)  -> { changes }
//   await db.exec(sql)         -> DDL / multi-statement
//   await db.tx(async (t) => …) -> transaction (t has get/all/run)
// params may be an array (positional `?`) or an object (named `@name`).
// DB_DRIVER=postgres uses Neon/Postgres (`pg`); anything else uses node:sqlite.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRIVER = (process.env.DB_DRIVER || 'sqlite').toLowerCase();

// ---- placeholder + param normalization ----------------------------------
// node:sqlite understands `?` (positional) and `@name` (named). Postgres only
// understands `$n`, so for the pg backend we rewrite the SQL + build a values
// array. Both backends accept the same call signature.
function pgRewrite(sql, params) {
  if (params && !Array.isArray(params) && typeof params === 'object') {
    const values = [];
    const seen = new Map();
    const text = sql.replace(/@(\w+)/g, (_, name) => {
      if (!seen.has(name)) { values.push(params[name]); seen.set(name, values.length); }
      return `$${seen.get(name)}`;
    });
    return { text, values };
  }
  const arr = params === undefined ? [] : (Array.isArray(params) ? params : [params]);
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: arr };
}

// node:sqlite call shape: named -> single object arg; positional -> spread.
function sqliteArgs(params) {
  if (params === undefined) return [];
  if (!Array.isArray(params) && typeof params === 'object') return [params];
  return Array.isArray(params) ? params : [params];
}

// =========================================================================
// POSTGRES (Neon) backend
// =========================================================================
async function makePostgres() {
  const { default: pg } = await import('pg');
  // Return int8 (bigint) as a JS number — our bigints (size, epoch-ms timestamps)
  // are well within Number.MAX_SAFE_INTEGER, and the app does numeric math on them.
  // Without this, node-postgres returns int8 as a string and breaks comparisons.
  pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // Neon requires TLS; the connection string usually carries sslmode=require.
    ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 10),
  });

  const runOn = (client) => ({
    async get(sql, params) { const { text, values } = pgRewrite(sql, params); return (await client.query(text, values)).rows[0]; },
    async all(sql, params) { const { text, values } = pgRewrite(sql, params); return (await client.query(text, values)).rows; },
    async run(sql, params) { const { text, values } = pgRewrite(sql, params); return { changes: (await client.query(text, values)).rowCount }; },
    async exec(sql) { await client.query(sql); },
  });

  const api = {
    ...runOn(pool),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(runOn(client));
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    async migrate() {
      const sql = fs.readFileSync(path.join(__dirname, 'schema.pg.sql'), 'utf8');
      await pool.query(sql);
      logger.info('postgres schema ensured');
    },
  };
  return api;
}

// =========================================================================
// SQLITE backend (sync engine wrapped in the async API for local dev)
// =========================================================================
async function makeSqlite() {
  const { DatabaseSync } = await import('node:sqlite');
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const sdb = new DatabaseSync(config.dbPath);
  sdb.exec('PRAGMA journal_mode = WAL;');
  sdb.exec('PRAGMA foreign_keys = ON;');

  const sync = {
    get(sql, params) { return sdb.prepare(sql).get(...sqliteArgs(params)); },
    all(sql, params) { return sdb.prepare(sql).all(...sqliteArgs(params)); },
    run(sql, params) { const r = sdb.prepare(sql).run(...sqliteArgs(params)); return { changes: r.changes }; },
    exec(sql) { sdb.exec(sql); },
  };
  // async wrappers (resolve immediately — the engine is synchronous)
  const api = {
    async get(sql, p) { return sync.get(sql, p); },
    async all(sql, p) { return sync.all(sql, p); },
    async run(sql, p) { return sync.run(sql, p); },
    async exec(sql) { sync.exec(sql); },
    async tx(fn) {
      sdb.exec('BEGIN');
      try { const out = await fn(sync); sdb.exec('COMMIT'); return out; }
      catch (e) { sdb.exec('ROLLBACK'); throw e; }
    },
    async migrate() { runSqliteMigrations(sdb); },
  };
  return api;
}

// Existing SQLite migration ladder (unchanged) — only used by the sqlite backend.
function runSqliteMigrations(sdb) {
  sdb.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);`);
  const migrations = [
    { version: 1, up: () => sdb.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
        CREATE TABLE folders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE, created_at TEXT NOT NULL);
        CREATE INDEX idx_folders_user_parent ON folders(user_id, parent_id);
        CREATE TABLE files (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL, name TEXT NOT NULL, original_name TEXT NOT NULL, mime TEXT NOT NULL DEFAULT 'application/octet-stream', size INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL DEFAULT 'other', storage_key TEXT NOT NULL, starred INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE INDEX idx_files_user_folder_created ON files(user_id, folder_id, created_at DESC);
        CREATE INDEX idx_files_user_kind_created ON files(user_id, kind, created_at DESC);
        CREATE TABLE magazines (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, theme TEXT NOT NULL DEFAULT 'editorial', cover_file_id TEXT REFERENCES files(id) ON DELETE SET NULL, layout_json TEXT NOT NULL DEFAULT '{"blocks":[]}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE INDEX idx_magazines_user_updated ON magazines(user_id, updated_at DESC);
      `) },
    { version: 2, up: () => sdb.exec(`ALTER TABLE files ADD COLUMN thumb_key TEXT; ALTER TABLE files ADD COLUMN thumb_status TEXT NOT NULL DEFAULT 'none';`) },
    { version: 3, up: () => sdb.exec(`
        CREATE TABLE connections (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL, account_label TEXT NOT NULL DEFAULT '', access_token TEXT, refresh_token TEXT, expires_at INTEGER, created_at TEXT NOT NULL, UNIQUE(user_id, provider));
        CREATE TABLE shelves (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, items_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE INDEX idx_shelves_user_pos ON shelves(user_id, position);
      `) },
    { version: 4, up: () => sdb.exec(`
        ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
        ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
        ALTER TABLE users ADD COLUMN subscription_status TEXT;
        ALTER TABLE users ADD COLUMN subscription_id TEXT;
        ALTER TABLE users ADD COLUMN current_period_end INTEGER;
        CREATE TABLE email_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at TEXT, created_at TEXT NOT NULL);
        CREATE INDEX idx_email_tokens_hash ON email_tokens(token_hash);
        CREATE TABLE auth_identities (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL, provider_user_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(provider, provider_user_id));
        CREATE TABLE analytics_events (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, anon_id TEXT, type TEXT NOT NULL DEFAULT 'event', name TEXT NOT NULL, path TEXT, props_json TEXT NOT NULL DEFAULT '{}', ua TEXT, created_at TEXT NOT NULL);
        CREATE INDEX idx_analytics_created ON analytics_events(created_at);
        CREATE TABLE feedback (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, kind TEXT NOT NULL DEFAULT 'contact', email TEXT, message TEXT NOT NULL, meta_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
        CREATE INDEX idx_feedback_created ON feedback(created_at);
      `) },
  ];
  const current = sdb.prepare('SELECT MAX(version) AS v FROM schema_migrations').get()?.v ?? 0;
  for (const m of migrations) {
    if (m.version > current) {
      sdb.exec('BEGIN');
      try {
        m.up();
        sdb.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(m.version, new Date().toISOString());
        sdb.exec('COMMIT');
        logger.info('migration applied', { version: m.version });
      } catch (e) { sdb.exec('ROLLBACK'); throw e; }
    }
  }
}

// Build the backend once at import. Top-level await is fine (ESM module).
export const db = DRIVER === 'postgres' ? await makePostgres() : await makeSqlite();
export const migrate = () => db.migrate();
logger.info('db driver ready', { driver: DRIVER });
