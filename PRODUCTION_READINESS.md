# Production Readiness — MagDrive

Mapped to `VIBECODE_TO_PRODUCTION.xlsx`. Honest status: this is a **solid, verified MVP**,
not yet a launched product. Below is what's done, and the exact gaps to close before
real users + real money.

## Readiness Gates

| Gate | Phase | Status | Notes |
|---|---|---|---|
| 0 | Project Setup | **DONE** | Monorepo, env vars, design tokens, S3-ready adapter, lazy AWS SDK. |
| 1 | Auth & Profile | **DONE** | JWT register/login/me, deny-by-default middleware, user-scoped queries. |
| 2 | Core Entity & Data | **DONE** | Files + folders schema, upload→storage, viewer, magazines (custom layouts). |
| 3 | Catalog & Commerce | N/A | No payments in scope. |
| 10 | Performance & SEO | **PARTIAL** | Bundle 61 KB gz (under 300 KB budget), lazy images, Range streaming. SSR/OG/sitemap TODO. |
| 12 | Testing & Observability | **TODO** | Golden path verified via API/proxy. Add Sentry + uptime + automated tests. |
| 13 | Launch & Scale | **TODO** | Domain/SSL, S3 migration, backups, TTL, status page. |

## 10 Rules — where we stand

1. **Auth/authz on every write** ✅ — `requireAuth` runs first; every query filtered by `user_id`; cross-user folder/file refs rejected (403).
2. **Never trust client money** — N/A (no payments).
3. **Idempotent payments/webhooks** — N/A.
4. **Schema-first: rules + indexes** ✅ — versioned migrations; composite indexes on every hot query; FKs ON.
5. **Perf budgets, not vibes** ⚠️ — Vite warns >300 KB; current bundle 61 KB gz. Not yet enforced in CI.
6. **Observability before launch** ❌ — structured JSON logs + `/health` exist; **no Sentry / uptime / alerts yet**.
7. **Cost discipline** ✅ (design) — paginated reads (no unbounded scans), indexed queries, no `.get()` in loops.
8. **Secrets out of repo; least privilege** ✅ — all secrets via `.env` (gitignored); prod refuses default `JWT_SECRET`; no PII in logs.
9. **One design system, tokens only** ✅ — all color/type/spacing are CSS tokens; focus states; 44px tap targets; WCAG-minded.
10. **Launch runbook + kill criteria** ❌ — not written yet.

## Security checklist (current)

- ✅ Every write route runs token-verify + ownership check.
- ✅ Upload paths user-scoped (`<userId>/<uuid>`), traversal-guarded, size-capped (`MAX_FILE_BYTES`).
- ✅ Right-to-delete: deleting a file removes the storage object + row; deleting a folder cascades.
- ✅ Secrets in env; centralized error handler never leaks internals/PII.
- ⚠️ JWT in query string for media (needed for `<img>`/`<video>`). Mitigate later with short-lived signed URLs / signed cookies.
- ❌ 2FA on consoles, key rotation policy, rules tests — operational, post-MVP.

## Known gaps (close these before launch)

1. ~~**Server-side thumbnails.**~~ **DONE.** Cached JPEG thumbnails via `GET /api/files/:id/thumb` (image→`sharp`, video→bundled `ffmpeg`, pdf→`pdf-to-img`+`sharp`), stored at `thumbs/<userId>/<id>.jpg` with a `thumb_key`/`thumb_status` column. **Pre-generated on upload** in a background, concurrency-limited queue (max 3 in parallel) so the upload response isn't blocked and a big multi-file drop can't spike CPU; by the time the grid renders, thumbs are already `ready` (first `/thumb` hit ≈3 ms, no generation). The lazy endpoint remains as a fallback (older files, failed/skipped gen). Unsupported kinds 404 and the client falls back to an icon. Generators load lazily/independently so a missing one only disables that kind. *Next: CDN cache headers at the edge.*
2. **Object storage.** Flip `STORAGE_DRIVER=s3` + add `@aws-sdk/client-s3` for production-scale durable storage and CDN. App code already supports it (storage adapter has `getLocalFile`/`putBuffer`/`getBuffer`, and thumbnails work over S3 by downloading to a temp path).
3. **Cloud OAuth tokens at rest.** Google/Dropbox access+refresh tokens are stored **plaintext** in SQLite (`connections` table). Before real launch, encrypt them (e.g. AES-GCM with a key from Secret Manager) or move to a secrets store, and verify the OAuth consent screen is published (not just test users). The demo provider stores no tokens. Apple/iCloud is intentionally unsupported (no public web API).
4. **Observability.** Wire Sentry on client + server, uptime checks on `/health`, log-based alerts.
5. **Backups + restore drill** for the SQLite db (or migrate to managed Postgres).
6. **Automated tests** (unit + integration + E2E) and a CI perf-budget gate.
7. **Public-route SEO** (SSR/SSG, OG cards, sitemap) if any pages become public.

## Verified golden path (this build)

register → upload (multi-file, correct kind detection) → list/filter/search →
Range-streamed media (HTTP 206) → create magazine with cover + blocks referencing
owned files → stats. Unauthenticated requests correctly rejected (401).
Cross-user file references rejected (403). Client production build clean (0 vulns).
