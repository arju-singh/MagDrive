# MagDrive → Supabase/Postgres migration plan

Target stack (decided):
- **Frontend** → Vercel (static Vite build)
- **Backend** → existing Express app on a **long-running container** (Fly.io / Render / Railway) — *not* serverless functions (ffmpeg/sharp/pdf thumbnailing, HTTP Range streaming, disk temp files, and the in-memory queues don't fit functions).
- **DB** → Supabase **Postgres**
- **File storage** → Supabase **Storage** (S3-compatible) via the existing `storage.js` S3 driver
- **Cache / rate-limit / thumbnail queue** → **Upstash Redis**
- **Auth** → keep current **JWT + bcrypt** (SMTP/reset already wired). No Supabase Auth.

Guiding principle: reuse what already abstracts cleanly (SQL schema, storage adapter), and isolate the one hard part (sync→async DB).

---

## Why this is mostly mechanical
The codebase is already SQL with raw queries (`db.prepare('SELECT … FROM files WHERE …')`) and UUID text PKs — no Firestore-style rewrite needed. The schema (`server/src/db.js`) is 6 tables: `users, folders, files, magazines, connections, shelves, email_tokens, auth_identities, analytics_events, feedback` (+ `schema_migrations`). All portable to Postgres.

**The one real cost:** `node:sqlite` `DatabaseSync` is synchronous; `pg` is async. Every `db.prepare(...).get()/.all()/.run()` and `db.exec()` call site must become `await`. Handlers are already `async` functions, so this is additive, not structural.

Call sites to convert (grep `db\.prepare|db\.exec`):
`auth.js, routes/files.js, routes/folders.js, routes/magazines.js, routes/stats.js, routes/connections.js, routes/cloud.js, routes/shelves.js, routes/billing.js, routes/analytics.js, routes/feedback.js`.

---

## Phase 0 — Accounts & secrets (you do this; I can't create accounts)
1. **Supabase** project → grab: `DATABASE_URL` (Postgres connection string, use the **pooled** `6543` port for serverless-ish, direct `5432` for the container), and **Storage** S3 credentials (Project Settings → Storage → S3 connection: endpoint, region, access key, secret). Create a bucket, e.g. `magdrive`.
2. **Upstash** Redis → `UPSTASH_REDIS_REST_URL` + token (or a `redis://` URL).
3. **Container host** (pick one: Fly.io / Render / Railway) account.
4. **Vercel** account (frontend).

These become env vars in Phase 4. Nothing here touches code.

---

## Phase 1 — Postgres data layer  ⟵ *I can start this now, no external creds needed*
1. `npm --prefix server install pg`.
2. New `server/src/db.js` exporting an **async** API that mirrors today's shape so call-site edits are minimal:
   - `query(sql, params)` → rows
   - `get(sql, params)` → first row or undefined
   - `all(sql, params)` → rows
   - `run(sql, params)` → `{ changes }`
   - `tx(fn)` → transaction with a scoped client
   - A placeholder adapter: rewrite `?` and `@name` → `$1..$n` (keeps existing query strings almost as-is).
3. Port schema to Postgres (`server/src/schema.sql` or a Postgres migration runner). Type mapping:
   | SQLite | Postgres |
   |---|---|
   | `TEXT` PK / cols | `text` |
   | `INTEGER` (epoch ms: `expires_at`, `current_period_end`) | `bigint` |
   | `INTEGER` boolean (`starred`, `email_verified`) | `smallint` (keep 0/1 so `!!f.starred` still works) |
   | ISO-string timestamps (`created_at`…) | keep `text` (no code change) |
   | `PRAGMA …` | drop |
   | `name LIKE @q` | `name ILIKE @q` (case-insensitive search — small UX win) |
   - Keep the same indexes (`idx_files_user_folder_created`, etc.).
4. Convert call sites to `await db.get/all/run(...)`. Convert the connections "SELECT then INSERT/UPDATE" to `INSERT … ON CONFLICT (user_id, provider) DO UPDATE`.
5. Keep `node:sqlite` path behind an env flag (`DB_DRIVER=sqlite|postgres`) during transition so local dev still works until cutover.

**Verification:** run the existing flows (register/login, upload, list, magazine CRUD, cloud import) against a local Postgres or the Supabase dev DB.

---

## Phase 2 — File storage on Supabase
- The S3 driver in `storage.js` already implements `put/getBuffer/createReadStream(range)/remove/putBuffer`. Point it at Supabase Storage:
  - `STORAGE_DRIVER=s3`, `S3_ENDPOINT=<supabase S3 endpoint>`, `S3_REGION`, `S3_BUCKET=magdrive`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- Verify Range streaming (video scrubbing) works through Supabase's S3 GetObject — the adapter already passes `Range`.
- Thumbnails: `getLocalFile()` (s3 path) downloads to a temp file for sharp/ffmpeg — works in a container with writable `/tmp`.

---

## Phase 3 — Upstash for shared state
Today these are **in-memory** (fine for one instance, lost on restart, wrong across multiple instances):
- `ratelimit.js` — rate-limit buckets → Redis `INCR`+`EXPIRE`.
- `routes/files.js` — thumbnail queue + in-flight dedup → Redis (or keep in-memory if you stay single-instance; document the limit).
Add a small `cache.js` wrapping Upstash. Only required if you scale beyond one backend instance; single container can defer this.

---

## Phase 4 — Deploy
**Backend (container):**
- `Dockerfile` (node:22-slim + `ffmpeg` apt package; sharp ships prebuilt binaries). Expose `PORT`.
- Env: `DATABASE_URL`, `DB_DRIVER=postgres`, S3 vars, `JWT_SECRET`, SMTP vars, `GOOGLE_*`, `API_URL` (the container's public URL), `CLIENT_URL` (the Vercel URL), `CORS_ORIGIN=<vercel url>`, Upstash vars.
- Deploy to Fly/Render/Railway.

**Frontend (Vercel):**
- Build `client` (Vite). Set `VITE_API_BASE=https://<backend-url>` (api.js already honors `VITE_API_BASE`), or use Vercel rewrites to proxy `/api` → backend.
- Update OAuth redirect URIs (Google console) + `API_URL`/`CLIENT_URL` to the production hosts.

---

## Phase 5 — Data migration (existing rows + files)
- One-off script: read all rows from the SQLite file → `INSERT` into Postgres (UUID PKs make this a straight copy; preserve `created_at` strings).
- Copy `server/data/uploads/**` and `thumbs/**` into the Supabase bucket under the same keys.
- Verify counts match; spot-check media + thumbnails load.

---

## Phase 6 — Cutover & verify
- Point DNS / set the Vercel env to the production backend.
- Smoke test: signup → verify email → upload (image/video/pdf) → thumbnails → magazine build → cloud import → billing probe.
- Keep the SQLite file as a backup until confident.

---

## Effort summary
| Phase | Effort | Blockers |
|---|---|---|
| 1 Data layer (sync→async + dialect) | **High** (the bulk) | none — can start now |
| 2 Storage | Low | Supabase S3 creds |
| 3 Upstash | Low (optional for single instance) | Upstash creds |
| 4 Deploy | Medium | host accounts |
| 5 Data migration | Low–Medium | Phases 1–2 done |
| 6 Cutover | Low | all above |

Critical correctness notes:
- **Don't put this backend on Vercel/Firebase Functions** — long-running streaming + ffmpeg + in-memory queues need a container.
- The async DB conversion is the only change that touches many files; everything else is config + adapter reuse.
