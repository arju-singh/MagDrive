#!/usr/bin/env node
// One-off data migration: copy all rows from the local SQLite DB into Postgres (Neon).
//
//   Usage (from server/):
//     DATABASE_URL='postgres://…neon.tech/neondb?sslmode=require' node scripts/migrate-sqlite-to-postgres.js
//
//   Options:
//     --truncate     wipe the target tables first (TRUNCATE … CASCADE). Default is
//                    additive: existing rows are kept (INSERT … ON CONFLICT DO NOTHING).
//     --sqlite PATH  source SQLite file (default: $DB_PATH or data/magdrive.sqlite)
//
// Safe to re-run: without --truncate it only inserts missing rows.
// UUID primary keys make this a straight copy. Booleans stay 0/1 (smallint),
// epoch-ms + size stay numeric (bigint), ISO timestamps stay text — identical to source.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(SERVER_ROOT, '.env') });

const args = process.argv.slice(2);
const TRUNCATE = args.includes('--truncate');
const sqliteArgIdx = args.indexOf('--sqlite');
const SQLITE_PATH = sqliteArgIdx !== -1
  ? args[sqliteArgIdx + 1]
  : path.isAbsolute(process.env.DB_PATH || '')
    ? process.env.DB_PATH
    : path.join(SERVER_ROOT, process.env.DB_PATH || 'data/magdrive.sqlite');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✖ DATABASE_URL is not set. Pass your Neon connection string, e.g.\n' +
    "  DATABASE_URL='postgres://…neon.tech/neondb?sslmode=require' node scripts/migrate-sqlite-to-postgres.js");
  process.exit(1);
}

// Dependency order — parents before children (FKs are enforced at insert time).
// Self-referencing `folders.parent_id` and forward refs (files.folder_id,
// magazines.cover_file_id) are handled by inserting each table ordered by created_at.
const TABLES = [
  'users',
  'folders',
  'files',
  'magazines',
  'connections',
  'shelves',
  'email_tokens',
  'auth_identities',
  'analytics_events',
  'feedback',
];

const sdb = new DatabaseSync(SQLITE_PATH);
const tableExists = (name) =>
  !!sdb.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(name);

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

function quoteIdent(s) { return `"${String(s).replace(/"/g, '""')}"`; }

async function run() {
  console.log(`→ source SQLite: ${SQLITE_PATH}`);
  console.log(`→ target Postgres: ${DATABASE_URL.replace(/:[^:@/]+@/, ':****@')}`);
  console.log(`→ mode: ${TRUNCATE ? 'TRUNCATE then insert' : 'additive (ON CONFLICT DO NOTHING)'}\n`);

  const client = await pool.connect();
  try {
    // Ensure the target schema exists (idempotent) so this runs standalone.
    await client.query(fs.readFileSync(path.join(SERVER_ROOT, 'src', 'schema.pg.sql'), 'utf8'));
    console.log('• ensured Postgres schema\n');

    if (TRUNCATE) {
      const present = TABLES.filter(tableExists).map(quoteIdent).join(', ');
      if (present) {
        await client.query(`TRUNCATE TABLE ${present} RESTART IDENTITY CASCADE`);
        console.log('• truncated target tables\n');
      }
    }

    const summary = [];
    for (const table of TABLES) {
      if (!tableExists(table)) { summary.push({ table, source: 0, inserted: 0, skipped: 0, failed: 0, note: 'missing in source' }); continue; }

      // created_at ordering keeps self/forward references valid (parents first).
      const hasCreatedAt = sdb.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === 'created_at');
      const rows = sdb.prepare(`SELECT * FROM ${quoteIdent(table)}${hasCreatedAt ? ' ORDER BY created_at ASC' : ''}`).all();

      let inserted = 0, skipped = 0, failed = 0;
      for (const row of rows) {
        const cols = Object.keys(row);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${quoteIdent(table)} (${cols.map(quoteIdent).join(', ')}) ` +
          `VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        try {
          const r = await client.query(sql, cols.map((c) => row[c]));
          if (r.rowCount === 1) inserted += 1; else skipped += 1;
        } catch (e) {
          failed += 1;
          if (failed <= 3) console.warn(`  ! ${table} row ${row.id ?? '?'} failed: ${e.message}`);
        }
      }
      summary.push({ table, source: rows.length, inserted, skipped, failed });
      console.log(`• ${table.padEnd(18)} source=${rows.length}  inserted=${inserted}  skipped=${skipped}  failed=${failed}`);
    }

    const totalFailed = summary.reduce((a, s) => a + (s.failed || 0), 0);
    console.log(`\n${totalFailed ? '⚠' : '✓'} done. ${totalFailed} row(s) failed.`);
    process.exitCode = totalFailed ? 1 : 0;
  } finally {
    client.release();
    await pool.end();
    sdb.close();
  }
}

run().catch((e) => { console.error('✖ migration error:', e.message); process.exit(1); });
