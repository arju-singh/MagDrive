# MAG·DRIVE

A Google-Drive-style storage app with a **magazine-format** interface. Store unlimited
photos, videos, documents and PDFs, browse them in an editorial masonry layout, and
arrange any of your media into **custom magazine issues** with a block editor.

Built with **React + Node.js**, to the discipline of the
`VIBECODE_TO_PRODUCTION` readiness framework (see [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md)).

---

## Quick start

```bash
# 1. install everything (root + server + client)
npm run install:all

# 2. create the server config
cp server/.env.example server/.env      # Windows PowerShell: copy server\.env.example server\.env
#    then edit server/.env and set JWT_SECRET to a long random string

# 3. run both apps (API on :4000, web on :5173)
npm run dev
```

Open **http://localhost:5173**, create an account, and start uploading.

> The web app proxies `/api` and `/health` to the API in dev, so you only ever open `:5173`.

---

## What's inside

```
mom_data/
├─ server/                 Node.js + Express API
│  ├─ src/
│  │  ├─ index.js          app entry, /health, error handler, graceful shutdown
│  │  ├─ config.js         env-driven config (12-factor)
│  │  ├─ db.js             node:sqlite schema + versioned migrations
│  │  ├─ auth.js           register/login/me, JWT middleware (deny-by-default)
│  │  ├─ storage.js        storage adapter — Local now, S3/R2-ready
│  │  ├─ kinds.js          MIME → kind mapping
│  │  └─ routes/           files, folders, magazines, stats
│  └─ data/                sqlite db + uploaded files (gitignored)
└─ client/                 React (Vite) magazine UI
   └─ src/
      ├─ App.jsx           routes
      ├─ auth.jsx          auth context
      ├─ api.js            typed API client + upload-with-progress
      ├─ styles.css        the design system (tokens only)
      ├─ components/       Shell, Login, FileTile, Uploader, Viewer, FilePicker
      └─ pages/            Drive (library), Magazines, MagazineEditor
```

## Features

**The Library (your drive)**
- Drag-and-drop / click upload of any file type, with live progress and large-file support.
- Editorial **masonry grid** — images and videos render inline; docs get typed thumbnails.
- Filter by kind (Photos / Videos / PDFs / Documents / Audio), Starred, and full-text search by name.
- Click any file for a full viewer: image, `<video>` player (HTTP-Range streaming), audio, in-browser PDF, or download.
- Rename, star, and delete. Storage meter in the sidebar.

**Magazines (the customizable section)**
- Create named issues, pick a theme (`editorial · mono · vogue · zine · noir`) and a cover.
- A block editor with live preview: **Cover, Heading, Text, Pull-quote, Image, Video, Gallery, Spacer**.
- Pull any media from your library into a block; set size/alignment; reorder and delete blocks.
- Saved as structured layout JSON, scoped to your account.

**Browse (connect a cloud drive, arrange it Netflix-style)**
- **Connect a drive** and browse its media here without managing it in the original account:
  - **Demo Drive** — works out of the box, no credentials (sample photos/clips/docs).
  - **Google Drive** & **Dropbox** — real OAuth; appear once you add credentials to `server/.env` (setup steps in [`server/.env.example`](./server/.env.example)). *Apple/iCloud Drive has no public web API and cannot be connected; "Android" uses your Google account.*
- A **Netflix-style** page: a hero, **auto rows** (Recently added / Photos / Videos / PDFs) that merge your uploads + every connected drive, and **custom shelves** you create and fill by picking items from any source.
- Cloud media is proxied through the server using your stored tokens (or 302-redirected for the demo), so `<img>`/`<video>` just work. Tokens auto-refresh.

## Architecture notes

- **Storage is pluggable.** `STORAGE_DRIVER=local` writes to disk via a small adapter
  interface. Set `STORAGE_DRIVER=s3` + S3/R2 credentials to scale to millions of large
  files with **zero application changes** (the AWS SDK is lazy-loaded only when used).
- **Multi-user & private.** Every API route verifies a JWT first and scopes every query
  to the caller's `user_id`. Media URLs use a short-lived signed token in the query so
  `<img>`/`<video>` tags work without leaking access.
- **Database** is Node's built-in `node:sqlite` (no native build), with composite indexes
  on every hot query and versioned migrations. Swap to Postgres for very high concurrency.

## Production / scaling

This is a complete, runnable MVP. Before opening to real users, walk
[`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) — it maps this build to the
`VIBECODE_TO_PRODUCTION` gates and lists the known gaps (server-side thumbnails,
object-store migration, error tracking, backups) with where to add them.

## Config reference

See [`server/.env.example`](./server/.env.example). Key vars: `JWT_SECRET`,
`STORAGE_DRIVER`, `MAX_FILE_BYTES`, `CORS_ORIGIN`, and the `S3_*` group.
# MagDrive
