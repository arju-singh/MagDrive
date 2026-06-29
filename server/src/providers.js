import { config } from './config.js';
import { db } from './db.js';
import { logger } from './logger.js';
import { kindFromMime } from './kinds.js';

// A normalized cloud item is: { id, name, kind, mime, size }
// Each provider exposes:
//   key, label, oauth, isConfigured()
//   (oauth) getAuthUrl(state, redirectUri), exchangeCode(code, redirectUri)
//   listFiles({ conn, kind, pageToken }) -> { items, nextPageToken }
//   media({ conn, fileId, range })  -> { redirect } | { upstream: Response }
//   thumb({ conn, fileId })         -> { redirect } | { upstream: Response } | { status }

// ---------- token persistence + refresh ----------
async function persistTokens(connId, { accessToken, refreshToken, expiresAt }) {
  const sets = ['access_token = @access', 'expires_at = @exp'];
  const params = { id: connId, access: accessToken, exp: expiresAt ?? null };
  if (refreshToken) { sets.push('refresh_token = @refresh'); params.refresh = refreshToken; }
  await db.run(`UPDATE connections SET ${sets.join(', ')} WHERE id = @id`, params);
}

// =====================================================================
// DEMO — a fully working sample "drive" with no credentials required.
// Thumbnails + image media come from Picsum (stable, seeded); video/pdf
// point at public sample files. Everything degrades to an image poster.
// =====================================================================
const DEMO_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
];
const DEMO_PDFS = [
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
];
const DEMO_TITLES = ['Sunset', 'Harbor', 'Forest Trail', 'City Lights', 'Desert Road', 'Snowfall',
  'Coastline', 'Old Town', 'Mountains', 'Night Market', 'Studio', 'Garden', 'Rooftops', 'Rivers',
  'Autumn', 'Skyline', 'Portrait', 'Street', 'Waves', 'Meadow', 'Bridge', 'Canyon', 'Lantern', 'Fog'];

function buildDemoCatalog() {
  const items = [];
  for (let i = 0; i < 24; i += 1) {
    const seed = `demo-img-${i}`;
    items.push({ id: seed, name: `${DEMO_TITLES[i % DEMO_TITLES.length]} ${String(i + 1).padStart(2, '0')}`,
      kind: 'image', mime: 'image/jpeg', size: 0,
      thumb: `https://picsum.photos/seed/${seed}/480/300`, src: `https://picsum.photos/seed/${seed}/1280/800` });
  }
  for (let i = 0; i < 8; i += 1) {
    const seed = `demo-vid-${i}`;
    items.push({ id: seed, name: `Clip ${String(i + 1).padStart(2, '0')}`, kind: 'video', mime: 'video/mp4', size: 0,
      thumb: `https://picsum.photos/seed/${seed}/480/300`, src: DEMO_VIDEOS[i % DEMO_VIDEOS.length] });
  }
  for (let i = 0; i < 6; i += 1) {
    const seed = `demo-pdf-${i}`;
    items.push({ id: seed, name: `Document ${String(i + 1).padStart(2, '0')}.pdf`, kind: 'pdf', mime: 'application/pdf', size: 0,
      thumb: `https://picsum.photos/seed/${seed}/480/300`, src: DEMO_PDFS[i % DEMO_PDFS.length] });
  }
  return items;
}
const DEMO = buildDemoCatalog();

const demoProvider = {
  key: 'demo', label: 'Demo Drive', oauth: false,
  isConfigured: () => true,
  async connectLabel() { return 'Demo Drive'; },
  async listFiles({ kind }) {
    const items = (kind ? DEMO.filter((i) => i.kind === kind) : DEMO).map(({ id, name, kind: k, mime, size }) => ({ id, name, kind: k, mime, size }));
    return { items, nextPageToken: null };
  },
  async media({ fileId }) {
    const it = DEMO.find((i) => i.id === fileId);
    return it ? { redirect: it.src } : { status: 404 };
  },
  async thumb({ fileId }) {
    const it = DEMO.find((i) => i.id === fileId);
    return it ? { redirect: it.thumb } : { status: 404 };
  },
};

// =====================================================================
// GOOGLE DRIVE (OAuth, env-gated)
// =====================================================================
async function googleEnsureToken(conn) {
  if (conn.expires_at && conn.expires_at - 60_000 > Date.now()) return conn.access_token;
  const body = new URLSearchParams({
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    refresh_token: conn.refresh_token,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  if (!res.ok) throw new Error(`google refresh failed ${res.status}`);
  const j = await res.json();
  const access = j.access_token;
  const exp = Date.now() + (j.expires_in || 3500) * 1000;
  await persistTokens(conn.id, { accessToken: access, expiresAt: exp });
  return access;
}

const KIND_QUERY = {
  image: "mimeType contains 'image/'",
  video: "mimeType contains 'video/'",
  pdf: "mimeType = 'application/pdf'",
  audio: "mimeType contains 'audio/'",
};

const googleProvider = {
  key: 'google', label: 'Google Drive', oauth: true,
  isConfigured: () => Boolean(config.google.clientId && config.google.clientSecret),
  getAuthUrl(state, redirectUri) {
    const p = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.readonly openid email profile',
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  },
  async exchangeCode(code, redirectUri) {
    const body = new URLSearchParams({
      code, client_id: config.google.clientId, client_secret: config.google.clientSecret,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
    if (!res.ok) throw new Error(`google token exchange ${res.status}`);
    const j = await res.json();
    let accountLabel = 'Google Drive';
    try {
      const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${j.access_token}` } });
      if (ui.ok) accountLabel = (await ui.json()).email || accountLabel;
    } catch { /* best-effort label */ }
    return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: Date.now() + (j.expires_in || 3500) * 1000, accountLabel };
  },
  async listFiles({ conn, kind, pageToken }) {
    const token = await googleEnsureToken(conn);
    const q = ["trashed = false", KIND_QUERY[kind]].filter(Boolean).join(' and ');
    const p = new URLSearchParams({
      q, pageSize: '40', fields: 'nextPageToken, files(id,name,mimeType,size,thumbnailLink)',
      orderBy: 'modifiedTime desc', spaces: 'drive',
    });
    if (pageToken) p.set('pageToken', pageToken);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${p}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`google list ${res.status}`);
    const j = await res.json();
    const items = (j.files || []).map((f) => ({ id: f.id, name: f.name, kind: kindFromMime(f.mimeType), mime: f.mimeType, size: Number(f.size || 0) }));
    return { items, nextPageToken: j.nextPageToken || null };
  },
  async media({ conn, fileId, range }) {
    const token = await googleEnsureToken(conn);
    const headers = { Authorization: `Bearer ${token}` };
    if (range) headers.Range = range;
    const upstream = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers });
    return { upstream };
  },
  async thumb({ conn, fileId }) {
    const token = await googleEnsureToken(conn);
    // Fetch metadata to get a thumbnailLink, then proxy it.
    const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink`, { headers: { Authorization: `Bearer ${token}` } });
    if (meta.ok) {
      const j = await meta.json();
      if (j.thumbnailLink) {
        const upstream = await fetch(j.thumbnailLink, { headers: { Authorization: `Bearer ${token}` } });
        if (upstream.ok) return { upstream };
      }
    }
    return { status: 404 };
  },
};

// =====================================================================
// DROPBOX (OAuth, env-gated). fileId = base64url(path_lower).
// =====================================================================
const b64urlEncode = (s) => Buffer.from(s, 'utf8').toString('base64url');
const b64urlDecode = (s) => Buffer.from(s, 'base64url').toString('utf8');

async function dropboxEnsureToken(conn) {
  if (conn.expires_at && conn.expires_at - 60_000 > Date.now()) return conn.access_token;
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token });
  const basic = Buffer.from(`${config.dropbox.clientId}:${config.dropbox.clientSecret}`).toString('base64');
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!res.ok) throw new Error(`dropbox refresh ${res.status}`);
  const j = await res.json();
  const exp = Date.now() + (j.expires_in || 14000) * 1000;
  await persistTokens(conn.id, { accessToken: j.access_token, expiresAt: exp });
  return j.access_token;
}

const EXT_KIND = { jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', heic: 'image',
  mp4: 'video', mov: 'video', webm: 'video', mkv: 'video', avi: 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio', pdf: 'pdf' };
const extKind = (name) => EXT_KIND[(name.split('.').pop() || '').toLowerCase()] || 'other';

const dropboxProvider = {
  key: 'dropbox', label: 'Dropbox', oauth: true,
  isConfigured: () => Boolean(config.dropbox.clientId && config.dropbox.clientSecret),
  getAuthUrl(state, redirectUri) {
    const p = new URLSearchParams({
      client_id: config.dropbox.clientId, redirect_uri: redirectUri, response_type: 'code',
      token_access_type: 'offline', state,
    });
    return `https://www.dropbox.com/oauth2/authorize?${p}`;
  },
  async exchangeCode(code, redirectUri) {
    const body = new URLSearchParams({
      code, grant_type: 'authorization_code', redirect_uri: redirectUri,
      client_id: config.dropbox.clientId, client_secret: config.dropbox.clientSecret,
    });
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!res.ok) throw new Error(`dropbox token ${res.status}`);
    const j = await res.json();
    return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: Date.now() + (j.expires_in || 14000) * 1000, accountLabel: 'Dropbox' };
  },
  async listFiles({ conn, kind, pageToken }) {
    const token = await dropboxEnsureToken(conn);
    const url = pageToken
      ? 'https://api.dropboxapi.com/2/files/list_folder/continue'
      : 'https://api.dropboxapi.com/2/files/list_folder';
    const payload = pageToken ? { cursor: pageToken } : { path: '', recursive: true, limit: 200 };
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`dropbox list ${res.status}`);
    const j = await res.json();
    let items = (j.entries || [])
      .filter((e) => e['.tag'] === 'file')
      .map((e) => ({ id: b64urlEncode(e.path_lower), name: e.name, kind: extKind(e.name), mime: '', size: Number(e.size || 0) }));
    if (kind) items = items.filter((i) => i.kind === kind);
    return { items, nextPageToken: j.has_more ? j.cursor : null };
  },
  async media({ conn, fileId, range }) {
    const token = await dropboxEnsureToken(conn);
    const headers = { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path: b64urlDecode(fileId) }) };
    if (range) headers.Range = range;
    const upstream = await fetch('https://content.dropboxapi.com/2/files/download', { method: 'POST', headers });
    return { upstream };
  },
  async thumb({ conn, fileId }) {
    const token = await dropboxEnsureToken(conn);
    const arg = { resource: { '.tag': 'path', path: b64urlDecode(fileId) }, format: 'jpeg', size: 'w640h480', mode: 'fitone_bestfit' };
    const upstream = await fetch('https://content.dropboxapi.com/2/files/get_thumbnail_v2', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify(arg) } });
    return upstream.ok ? { upstream } : { status: 404 };
  },
};

// ---------- registry ----------
const PROVIDERS = { demo: demoProvider, google: googleProvider, dropbox: dropboxProvider };

export const getProvider = (key) => PROVIDERS[key] || null;

// What the UI should offer: demo always; google/dropbox only when configured.
export function availableProviders() {
  return Object.values(PROVIDERS)
    .filter((p) => p.isConfigured())
    .map((p) => ({ key: p.key, label: p.label, oauth: p.oauth }));
}
