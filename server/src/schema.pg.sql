-- MagDrive Postgres schema (Neon). Idempotent: safe to run on every boot.
-- Mirrors the SQLite migration ladder (db.js), merged to final state.
-- Booleans stay smallint 0/1 so app code (`!!row.starred`) is unchanged.
-- Epoch-ms columns are bigint; ISO timestamps stay text (matches app code).

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    integer PRIMARY KEY,
  applied_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id                  text PRIMARY KEY,
  email               text NOT NULL UNIQUE,
  password_hash       text NOT NULL,
  name                text NOT NULL DEFAULT '',
  created_at          text NOT NULL,
  email_verified      smallint NOT NULL DEFAULT 0,
  plan                text NOT NULL DEFAULT 'free',
  stripe_customer_id  text,
  subscription_status text,
  subscription_id     text,
  current_period_end  bigint
);

CREATE TABLE IF NOT EXISTS folders (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  parent_id  text REFERENCES folders(id) ON DELETE CASCADE,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_folders_user_parent ON folders(user_id, parent_id);

CREATE TABLE IF NOT EXISTS files (
  id            text PRIMARY KEY,
  user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id     text REFERENCES folders(id) ON DELETE SET NULL,
  name          text NOT NULL,
  original_name text NOT NULL,
  mime          text NOT NULL DEFAULT 'application/octet-stream',
  size          bigint NOT NULL DEFAULT 0,
  kind          text NOT NULL DEFAULT 'other',
  storage_key   text NOT NULL,
  starred       smallint NOT NULL DEFAULT 0,
  created_at    text NOT NULL,
  updated_at    text NOT NULL,
  thumb_key     text,
  thumb_status  text NOT NULL DEFAULT 'none'
);
CREATE INDEX IF NOT EXISTS idx_files_user_folder_created ON files(user_id, folder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_user_kind_created   ON files(user_id, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS magazines (
  id            text PRIMARY KEY,
  user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  theme         text NOT NULL DEFAULT 'editorial',
  cover_file_id text REFERENCES files(id) ON DELETE SET NULL,
  layout_json   text NOT NULL DEFAULT '{"blocks":[]}',
  created_at    text NOT NULL,
  updated_at    text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_magazines_user_updated ON magazines(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS connections (
  id            text PRIMARY KEY,
  user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      text NOT NULL,
  account_label text NOT NULL DEFAULT '',
  access_token  text,
  refresh_token text,
  expires_at    bigint,
  created_at    text NOT NULL,
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS shelves (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  position   integer NOT NULL DEFAULT 0,
  items_json text NOT NULL DEFAULT '[]',
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shelves_user_pos ON shelves(user_id, position);

CREATE TABLE IF NOT EXISTS email_tokens (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  token_hash text NOT NULL,
  expires_at bigint NOT NULL,
  used_at    text,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_hash ON email_tokens(token_hash);

CREATE TABLE IF NOT EXISTS auth_identities (
  id               text PRIMARY KEY,
  user_id          text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         text NOT NULL,
  provider_user_id text NOT NULL,
  created_at       text NOT NULL,
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id         text PRIMARY KEY,
  user_id    text REFERENCES users(id) ON DELETE SET NULL,
  anon_id    text,
  type       text NOT NULL DEFAULT 'event',
  name       text NOT NULL,
  path       text,
  props_json text NOT NULL DEFAULT '{}',
  ua         text,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

CREATE TABLE IF NOT EXISTS feedback (
  id         text PRIMARY KEY,
  user_id    text REFERENCES users(id) ON DELETE SET NULL,
  kind       text NOT NULL DEFAULT 'contact',
  email      text,
  message    text NOT NULL,
  meta_json  text NOT NULL DEFAULT '{}',
  status     text NOT NULL DEFAULT 'open',
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
