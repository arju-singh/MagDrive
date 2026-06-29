import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Sparkle, Star, Bolt, CharacterStrip } from '../components/art.jsx';

const FEATURES = [
  { icon: 'library', title: 'Store everything', body: 'Photos, videos, PDFs, audio, documents — all your media in one private library. Uploaded once, kept safe, never auto-deleted.' },
  { icon: 'upload', title: 'Import from any drive', body: 'Connect Google Drive, Dropbox or a demo drive, then pull your photos, videos and PDFs straight into MagDrive — select or drag, and they’re copied in.' },
  { icon: 'magazines', title: 'Magazine layouts', body: 'Turn a pile of files into a beautiful editorial spread. Covers, headings, galleries and quotes — your media, arranged like a magazine.' },
  { icon: 'browse', title: 'Browse like a feed', body: 'Netflix-style rows and shelves across every source. Rediscover what you have, mixing your library with your connected clouds.' },
];

const STEPS = [
  { n: '01', title: 'Create your account', body: 'Free to start. Your library is private to you.' },
  { n: '02', title: 'Add or import media', body: 'Drag files in, or connect a drive and import the gallery.' },
  { n: '03', title: 'Arrange & enjoy', body: 'Star, browse, and build magazines from anything.' },
];

export default function Landing() {
  const nav = useNavigate();
  const go = () => nav('/login');

  return (
    <div className="landing">
      {/* Nav */}
      <header className="landing-nav">
        <div className="landing-brand">MAG<span className="dot">.</span>DRIVE</div>
        <nav className="landing-nav__links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <button className="btn btn--sm" onClick={go}>Sign in</button>
          <button className="btn btn--sm btn--primary" onClick={go}>Get started</button>
        </nav>
      </header>

      {/* Hero */}
      <section className="hero-land">
        <div className="hero-land__copy">
          <span className="land-kicker"><Sparkle size={14} className="doodle" /> Your media, arranged like a magazine</span>
          <h1>Every photo, video & file —<br />beautifully in one place.</h1>
          <p className="land-sub">
            MagDrive is a private home for your media. Upload anything, import straight from your
            cloud drives, then browse and build magazine-style layouts from it all.
          </p>
          <div className="land-cta-row">
            <button className="btn btn--primary" onClick={go}><Icon name="upload" size={16} /> Get started free</button>
            <button className="btn" onClick={go}>Sign in</button>
          </div>
          <div className="land-trust">
            <span><Icon name="star" size={14} /> No auto-deletion</span>
            <span><Icon name="library" size={14} /> Private by default</span>
            <span><Icon name="browse" size={14} /> Works with your drives</span>
          </div>
        </div>

        {/* Decorative glass preview */}
        <div className="hero-land__art" aria-hidden="true">
          <div className="preview-card">
            <div className="preview-bar"><span /><span /><span /></div>
            <div className="preview-grid">
              {['image', 'video', 'pdf', 'audio', 'image', 'other'].map((k, i) => (
                <div key={i} className={`preview-tile k-${k}`}><Icon name={k} size={26} /></div>
              ))}
            </div>
          </div>
          <CharacterStrip size={54} />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="land-section">
        <div className="land-section__head">
          <span className="land-kicker"><Star size={14} className="doodle" /> What you get</span>
          <h2>One library for all your media</h2>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon"><Icon name={f.icon} size={26} /></div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="land-section">
        <div className="land-section__head">
          <span className="land-kicker"><Bolt size={14} className="doodle" /> How it works</span>
          <h2>Up and running in minutes</h2>
        </div>
        <div className="step-grid">
          {STEPS.map((s) => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="cta-band">
        <h2>Bring your media home.</h2>
        <p>Start free — upload your first files or import a whole drive in one click.</p>
        <button className="btn btn--primary" onClick={go}><Icon name="upload" size={16} /> Get started free</button>
      </section>

      {/* Footer */}
      <footer className="landing-foot">
        <div className="landing-brand">MAG<span className="dot">.</span>DRIVE</div>
        <div className="landing-foot__links">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/contact">Contact</Link>
          <button className="linklike" onClick={go}>Sign in</button>
        </div>
        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>© 2026 MagDrive</div>
      </footer>
    </div>
  );
}
