import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { logger } from './logger.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

// Pragmas: WAL for concurrent reads, foreign keys on (schema-first, Rule #4).
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// schema_migrations tracks the version field (Checklist: schema-version + migrations).
db.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`);

const migrations = [
  {
    version: 1,
    up: () => {
      db.exec(`
        CREATE TABLE users (
          id            TEXT PRIMARY KEY,
          email         TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          name          TEXT NOT NULL DEFAULT '',
          created_at    TEXT NOT NULL
        );

        CREATE TABLE folders (
          id         TEXT PRIMARY KEY,
          user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name       TEXT NOT NULL,
          parent_id  TEXT REFERENCES folders(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL
        );
        -- Composite index for the hot query: a user's folders under a parent (Rule #4).
        CREATE INDEX idx_folders_user_parent ON folders(user_id, parent_id);

        CREATE TABLE files (
          id            TEXT PRIMARY KEY,
          user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          folder_id     TEXT REFERENCES folders(id) ON DELETE SET NULL,
          name          TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime          TEXT NOT NULL DEFAULT 'application/octet-stream',
          size          INTEGER NOT NULL DEFAULT 0,
          kind          TEXT NOT NULL DEFAULT 'other', -- image|video|audio|pdf|doc|other
          storage_key   TEXT NOT NULL,                 -- adapter-relative key
          starred       INTEGER NOT NULL DEFAULT 0,
          created_at    TEXT NOT NULL,
          updated_at    TEXT NOT NULL
        );
        -- Hot list query: a user's files in a folder, newest first.
        CREATE INDEX idx_files_user_folder_created ON files(user_id, folder_id, created_at DESC);
        -- Filter-by-kind grid (images / videos / docs tabs).
        CREATE INDEX idx_files_user_kind_created ON files(user_id, kind, created_at DESC);

        CREATE TABLE magazines (
          id            TEXT PRIMARY KEY,
          user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title         TEXT NOT NULL,
          theme         TEXT NOT NULL DEFAULT 'editorial',
          cover_file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
          layout_json   TEXT NOT NULL DEFAULT '{"blocks":[]}',
          created_at    TEXT NOT NULL,
          updated_at    TEXT NOT NULL
        );
        CREATE INDEX idx_magazines_user_updated ON magazines(user_id, updated_at DESC);
      `);
    },
  },
  {
    version: 2,
    up: () => {
      // Server-side thumbnail cache. thumb_status: none|ready|failed|unsupported
      db.exec(`
        ALTER TABLE files ADD COLUMN thumb_key TEXT;
        ALTER TABLE files ADD COLUMN thumb_status TEXT NOT NULL DEFAULT 'none';
      `);
    },
  },
  {
    version: 3,
    up: () => {
      db.exec(`
        -- Connected cloud accounts (google | dropbox | demo). Tokens stored per user.
        CREATE TABLE connections (
          id            TEXT PRIMARY KEY,
          user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider      TEXT NOT NULL,
          account_label TEXT NOT NULL DEFAULT '',
          access_token  TEXT,
          refresh_token TEXT,
          expires_at    INTEGER,            -- epoch ms
          created_at    TEXT NOT NULL,
          UNIQUE(user_id, provider)
        );

        -- Netflix-style custom shelves: an ordered list of item refs (any source).
        CREATE TABLE shelves (
          id         TEXT PRIMARY KEY,
          user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title      TEXT NOT NULL,
          position   INTEGER NOT NULL DEFAULT 0,
          items_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_shelves_user_pos ON shelves(user_id, position);
      `);
    },
  },
  {
    version: 4,
    up: () => {
      // Pre-launch SaaS columns + tables: email verification, password reset,
      // OAuth sign-in linkage, self-hosted analytics, and a feedback channel.
      db.exec(`
        ALTER TABLE users ADD COLUMN email_verified       INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN plan                 TEXT NOT NULL DEFAULT 'free';
        ALTER TABLE users ADD COLUMN stripe_customer_id   TEXT;
        ALTER TABLE users ADD COLUMN subscription_status  TEXT;
        ALTER TABLE users ADD COLUMN subscription_id      TEXT;
        ALTER TABLE users ADD COLUMN current_period_end   INTEGER; -- epoch ms

        -- Single-use, expiring tokens for email verification + password reset.
        -- We store a SHA-256 hash of the token, never the raw value (Rule #8).
        CREATE TABLE email_tokens (
          id         TEXT PRIMARY KEY,
          user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type       TEXT NOT NULL,            -- verify | reset
          token_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,         -- epoch ms
          used_at    TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_email_tokens_hash ON email_tokens(token_hash);

        -- Federated identities (e.g. "Sign in with Google"). One row per provider account.
        CREATE TABLE auth_identities (
          id               TEXT PRIMARY KEY,
          user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider         TEXT NOT NULL,      -- google
          provider_user_id TEXT NOT NULL,      -- the provider's stable subject id
          created_at       TEXT NOT NULL,
          UNIQUE(provider, provider_user_id)
        );

        -- Self-hosted, privacy-light product analytics. No raw IP is stored.
        CREATE TABLE analytics_events (
          id         TEXT PRIMARY KEY,
          user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
          anon_id    TEXT,
          type       TEXT NOT NULL DEFAULT 'event', -- page | event
          name       TEXT NOT NULL,
          path       TEXT,
          props_json TEXT NOT NULL DEFAULT '{}',
          ua         TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_analytics_created ON analytics_events(created_at);

        -- Contact / support + bug reports.
        CREATE TABLE feedback (
          id         TEXT PRIMARY KEY,
          user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
          kind       TEXT NOT NULL DEFAULT 'contact', -- contact | bug
          email      TEXT,
          message    TEXT NOT NULL,
          meta_json  TEXT NOT NULL DEFAULT '{}',
          status     TEXT NOT NULL DEFAULT 'open',
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_feedback_created ON feedback(created_at);
      `);
    },
  },
];

export function migrate() {
  const getVersion = db.prepare('SELECT MAX(version) AS v FROM schema_migrations');
  const current = getVersion.get()?.v ?? 0;
  const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
  for (const m of migrations) {
    if (m.version > current) {
      db.exec('BEGIN');
      try {
        m.up();
        insert.run(m.version, new Date().toISOString());
        db.exec('COMMIT');
        logger.info('migration applied', { version: m.version });
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    }
  }
}
