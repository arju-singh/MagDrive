// Lightweight, privacy-respecting analytics beacon → POST /api/analytics.
// Sends only when the user has accepted cookies/analytics consent.
import { apiBase, tokenStore } from './api.js';

const ANON_KEY = 'magdrive_anon';
const CONSENT_KEY = 'magdrive_consent';

function anonId() {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() || String(Math.random()).slice(2)) + '';
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

function consented() {
  return localStorage.getItem(CONSENT_KEY) === 'accepted';
}

function send(type, name, path, props) {
  if (!consented()) return; // respect cookie/analytics consent
  const body = JSON.stringify({ type, name, path, props: props || {}, anonId: anonId() });
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  // Fire-and-forget; never surface errors to the UI.
  fetch(`${apiBase}/api/analytics`, { method: 'POST', headers, body, keepalive: true }).catch(() => {});
}

export function pageview(path) {
  send('page', 'pageview', path || window.location.pathname);
}

export function track(name, props) {
  send('event', name, window.location.pathname, props);
}
