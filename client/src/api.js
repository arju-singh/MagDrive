// API client. Token in localStorage; relative URLs are proxied to the server in dev.
const BASE = import.meta.env.VITE_API_BASE || '';
const TOKEN_KEY = 'magdrive_token';

// Exposed for full-page redirects (OAuth) and the analytics beacon.
export const apiBase = BASE;
export const oauthUrl = (provider) => `${BASE}/api/auth/${provider}`;

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(method, path, body, { isForm = false } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (res.status === 401) {
    tokenStore.clear();
    // Let the app's auth boundary react; surface a typed error.
    throw Object.assign(new Error('unauthorized'), { status: 401 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { status: res.status, data });
  return data;
}

// Build an authenticated media URL for <img>/<video>/<iframe> (token in query).
export function mediaUrl(fileId, { download = false } = {}) {
  const token = tokenStore.get();
  const sub = download ? 'download' : 'raw';
  return `${BASE}/api/files/${fileId}/${sub}?token=${encodeURIComponent(token || '')}`;
}

// Cached server-side thumbnail (generated lazily). 404s for unsupported kinds → caller falls back.
export function thumbUrl(fileId) {
  const token = tokenStore.get();
  return `${BASE}/api/files/${fileId}/thumb?token=${encodeURIComponent(token || '')}`;
}

// Public (shared-link) media URLs — no auth token; the share token in the path
// authorizes access. Server validates the file is in scope for that share.
export function publicMediaUrl(token, fileId, { download = false } = {}) {
  return `${BASE}/api/public/${token}/files/${fileId}/${download ? 'download' : 'raw'}`;
}
export function publicThumbUrl(token, fileId) {
  return `${BASE}/api/public/${token}/files/${fileId}/thumb`;
}

// Cloud media/thumb URLs for a connected provider.
function cloudUrl(provider, id, sub) {
  const token = tokenStore.get();
  return `${BASE}/api/cloud/${provider}/files/${encodeURIComponent(id)}/${sub}?token=${encodeURIComponent(token || '')}`;
}

// Source-aware URL helpers for a normalized item ({ source, id, ... }).
export function srcMediaUrl(item) {
  return item.source === 'local' ? mediaUrl(item.id) : cloudUrl(item.source, item.id, 'raw');
}
export function srcThumbUrl(item) {
  return item.source === 'local' ? thumbUrl(item.id) : cloudUrl(item.source, item.id, 'thumb');
}

export const api = {
  // auth
  register: (b) => request('POST', '/api/auth/register', b),
  login: (b) => request('POST', '/api/auth/login', b),
  me: () => request('GET', '/api/auth/me'),
  authConfig: () => request('GET', '/api/auth/config'),
  resendVerification: () => request('POST', '/api/auth/verify/request'),
  forgotPassword: (email) => request('POST', '/api/auth/password/forgot', { email }),
  resetPassword: (token, password) => request('POST', '/api/auth/password/reset', { token, password }),

  // billing (Stripe — inert until configured server-side)
  billingSubscription: () => request('GET', '/api/billing/subscription'),
  billingCheckout: () => request('POST', '/api/billing/checkout'),
  billingPortal: () => request('POST', '/api/billing/portal'),

  // feedback (contact / bug report)
  feedback: (b) => request('POST', '/api/feedback', b),

  // files
  listFiles: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/api/files${q ? `?${q}` : ''}`);
  },
  getFile: (id) => request('GET', `/api/files/${id}`),
  patchFile: (id, b) => request('PATCH', `/api/files/${id}`, b),
  deleteFile: (id) => request('DELETE', `/api/files/${id}`),
  // uploadFiles uses XHR for progress (below)

  // folders
  listFolders: (parentId = 'root') => request('GET', `/api/folders?parentId=${parentId}`),
  createFolder: (b) => request('POST', '/api/folders', b),
  patchFolder: (id, b) => request('PATCH', `/api/folders/${id}`, b),
  deleteFolder: (id) => request('DELETE', `/api/folders/${id}`),

  // magazines
  listMagazines: () => request('GET', '/api/magazines'),
  getMagazine: (id) => request('GET', `/api/magazines/${id}`),
  createMagazine: (b) => request('POST', '/api/magazines', b),
  patchMagazine: (id, b) => request('PATCH', `/api/magazines/${id}`, b),
  deleteMagazine: (id) => request('DELETE', `/api/magazines/${id}`),

  // shares (public links) — type is 'file' | 'magazine'
  getShare: (type, id) => request('GET', `/api/shares?type=${type}&id=${id}`),
  createShare: (type, id) => request('POST', '/api/shares', { type, id }),
  deleteShare: (shareId) => request('DELETE', `/api/shares/${shareId}`),
  // public read of a shared resource (no auth required)
  getPublic: (token) => request('GET', `/api/public/${token}`),

  // stats
  stats: () => request('GET', '/api/stats'),

  // connections + cloud providers
  connections: () => request('GET', '/api/connections'),
  connect: (provider) => request('GET', `/api/connect/${provider}`),
  disconnect: (provider) => request('DELETE', `/api/connections/${provider}`),
  cloudFiles: (provider, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/api/cloud/${provider}/files${q ? `?${q}` : ''}`);
  },
  // Copy selected cloud files into the local library (permanent, source untouched).
  cloudImport: (provider, items, folderId) =>
    request('POST', `/api/cloud/${provider}/import`, { items, folderId }),

  // shelves (Netflix custom rows)
  listShelves: () => request('GET', '/api/shelves'),
  createShelf: (title) => request('POST', '/api/shelves', { title }),
  patchShelf: (id, b) => request('PATCH', `/api/shelves/${id}`, b),
  deleteShelf: (id) => request('DELETE', `/api/shelves/${id}`),
};

// Upload with progress via XHR (fetch lacks upload progress).
export function uploadFiles(files, { folderId, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    if (folderId && folderId !== 'root') form.append('folderId', folderId);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/api/files`);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(Object.assign(new Error(data.error || 'upload_failed'), { status: xhr.status, data }));
    };
    xhr.onerror = () => reject(new Error('network_error'));
    xhr.send(form);
  });
}

export function formatBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}
