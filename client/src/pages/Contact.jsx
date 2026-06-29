import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Footer from '../components/Footer.jsx';

export default function Contact() {
  const { user } = useAuth();
  const [kind, setKind] = useState('contact');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error

  async function submit(e) {
    e.preventDefault();
    setState('sending');
    try {
      await api.feedback({
        kind,
        email,
        message,
        meta: { path: window.location.pathname, ua: navigator.userAgent },
      });
      setState('sent');
      setMessage('');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="public-page">
      <div className="public-page__bar">
        <Link to="/" className="brand">MAG<span className="dot">.</span>DRIVE</Link>
      </div>

      <div className="public-page__center">
        <div className="auth-card" style={{ maxWidth: 520 }}>
          <h2 style={{ marginTop: 0 }}>{kind === 'bug' ? 'Report a bug' : 'Contact support'}</h2>
          <p className="muted">We read every message. Tell us what's on your mind.</p>

          <div className="auth-tabs" role="tablist">
            <button className={`btn ${kind === 'contact' ? 'btn--primary' : ''}`} onClick={() => setKind('contact')}>Contact / Support</button>
            <button className={`btn ${kind === 'bug' ? 'btn--primary' : ''}`} onClick={() => setKind('bug')}>Bug report</button>
          </div>

          {state === 'sent' ? (
            <div className="toast" role="status" style={{ marginTop: 'var(--sp-4)' }}>
              ✅ Thanks! Your {kind === 'bug' ? 'report' : 'message'} was sent.
            </div>
          ) : (
            <form className="stack" onSubmit={submit}>
              <label className="field"><span>Your email</span>
                <input className="input" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </label>
              <label className="field"><span>{kind === 'bug' ? 'What went wrong?' : 'Message'}</span>
                <textarea className="input" required rows={6} value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={kind === 'bug' ? 'Steps to reproduce, what you expected, what happened…' : 'How can we help?'} />
              </label>
              <button className="btn btn--primary" type="submit" disabled={state === 'sending'} style={{ width: '100%' }}>
                {state === 'sending' ? <span className="spinner" /> : 'Send'}
              </button>
              {state === 'error' && <div className="err" role="alert">Couldn't send. Please try again.</div>}
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
