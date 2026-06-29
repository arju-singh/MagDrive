import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { api, formatBytes } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useRefresh } from '../refresh.jsx';
import { useTheme } from '../theme.jsx';
import { KIND_LABEL } from './kindIcon.js';
import { Avatar, Mascot } from './art.jsx';
import VerifyBanner from './VerifyBanner.jsx';
import Footer from './Footer.jsx';

const KIND_NAV = [
  { key: 'image', emoji: '🖼️' },
  { key: 'video', emoji: '🎬' },
  { key: 'pdf', emoji: '📕' },
  { key: 'doc', emoji: '📄' },
  { key: 'audio', emoji: '🎵' },
  { key: 'other', emoji: '📦' },
];

// Soft display quota for the storage meter (visual only).
const QUOTA_BYTES = 15 * 1024 * 1024 * 1024;

export default function Shell({ children }) {
  const { user, logout } = useAuth();
  const { version } = useRefresh();
  const { mode, theme, cycle } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [sp] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState(sp.get('q') || '');

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, [version]);

  const onDrive = loc.pathname === '/';
  const activeKind = sp.get('kind');
  const activeStarred = sp.get('starred') === '1';
  const goDrive = (params) => nav(`/?${new URLSearchParams(params).toString()}`);

  function submitSearch(e) {
    e.preventDefault();
    goDrive(q ? { q } : {});
  }

  const pct = stats ? Math.min(100, (stats.bytes / QUOTA_BYTES) * 100) : 0;

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand" onClick={() => nav('/')} style={{ cursor: 'pointer' }}>MAG<span className="dot">.</span>DRIVE</div>
        <form className="searchbar" onSubmit={submitSearch}>
          <input className="input" placeholder="Search your library…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <div className="spacer" />
        <div className="usermenu">
          <button
            className="btn btn--sm"
            onClick={cycle}
            title={`Theme: ${mode === 'auto' ? `Auto (system → ${theme})` : mode} — click to change`}
            aria-label={`Theme: ${mode}. Click to change.`}
          >
            {mode === 'light' ? '☀️ Light' : mode === 'dark' ? '🌙 Dark' : '🖥️ Auto'}
          </button>
          <Avatar seed={user?.id || user?.email || 'guest'} label={(user?.name || user?.email || '?')[0].toUpperCase()} style="fun-emoji" />
          <span title={user?.email} style={{ fontWeight: 700, fontSize: 'var(--fs-sm)' }}>{user?.name || user?.email?.split('@')[0]}</span>
          <button className="btn btn--sm btn--ghost" onClick={logout}>Sign out</button>
        </div>
      </div>

      <aside className="sidebar">
        <div className="nav-section">
          <h4>Library</h4>
          <button className={`nav-item ${onDrive && !activeKind && !activeStarred ? 'active' : ''}`} onClick={() => goDrive({})}>
            <span className="nav-emoji">📚</span> All files
            {stats && <span className="count">{stats.files}</span>}
          </button>
          <button className={`nav-item ${onDrive && activeStarred ? 'active' : ''}`} onClick={() => goDrive({ starred: '1' })}>
            <span className="nav-emoji">★</span> Starred
          </button>
          {KIND_NAV.map((k) => (
            <button key={k.key} className={`nav-item ${onDrive && activeKind === k.key ? 'active' : ''}`} onClick={() => goDrive({ kind: k.key })}>
              <span className="nav-emoji">{k.emoji}</span> {KIND_LABEL[k.key]}
              {stats?.byKind?.[k.key] && <span className="count">{stats.byKind[k.key].count}</span>}
            </button>
          ))}
        </div>

        <div className="nav-section">
          <h4>Discover</h4>
          <button className={`nav-item ${loc.pathname === '/browse' ? 'active' : ''}`} onClick={() => nav('/browse')}>
            <span className="nav-emoji">🍿</span> Browse
          </button>
        </div>

        <div className="nav-section">
          <h4>Create</h4>
          <button className={`nav-item ${loc.pathname.startsWith('/magazines') ? 'active' : ''}`} onClick={() => nav('/magazines')}>
            <span className="nav-emoji">📰</span> Magazines
            {stats && <span className="count">{stats.magazines}</span>}
          </button>
        </div>

        <div className="nav-section">
          <h4>Account</h4>
          <button className={`nav-item ${loc.pathname === '/billing' ? 'active' : ''}`} onClick={() => nav('/billing')}>
            <span className="nav-emoji">💳</span> Billing
          </button>
          <button className={`nav-item ${loc.pathname === '/contact' ? 'active' : ''}`} onClick={() => nav('/contact')}>
            <span className="nav-emoji">💬</span> Support
          </button>
        </div>

        <div className="nav-section">
          <h4>Storage</h4>
          <div className="meter">
            <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {stats ? `${formatBytes(stats.bytes)} of ${formatBytes(QUOTA_BYTES)}` : '…'}
            </div>
          </div>
        </div>

        <div className="sidebar-mascot">
          <Mascot size={64} />
          <p>Drop files &amp; build magazines!</p>
        </div>
      </aside>

      <main className="main">
        <VerifyBanner />
        {children}
        <Footer />
      </main>
    </div>
  );
}
