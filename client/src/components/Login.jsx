import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api, oauthUrl } from '../api.js';
import { CharacterStrip, Sparkle, Star } from './art.jsx';

const MESSAGES = {
  invalid_credentials: 'Wrong email or password.',
  email_taken: 'That email is already registered. Try signing in.',
  weak_password: 'Password must be at least 8 characters.',
  invalid_email: 'Please enter a valid email address.',
  rate_limited: 'Too many attempts. Please wait a minute and try again.',
};

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentReset, setSentReset] = useState(false);
  const [googleAuth, setGoogleAuth] = useState(false);

  useEffect(() => {
    api.authConfig().then((c) => setGoogleAuth(Boolean(c.googleAuth))).catch(() => {});
  }, []);

  function switchMode(m) { setMode(m); setErr(''); setSentReset(false); }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else if (mode === 'register') await register(email, password, name);
      else if (mode === 'forgot') {
        await api.forgotPassword(email);
        setSentReset(true);
      }
    } catch (ex) {
      setErr(MESSAGES[ex.message] || ex.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="center">
          <CharacterStrip size={62} />
          <div className="brand-mark">
            <Sparkle size={22} className="doodle" /> MAG<span className="dot">.</span>DRIVE <Star size={22} className="doodle" />
          </div>
          <p className="muted" style={{ marginTop: 4 }}>Your media, arranged like a magazine.</p>
        </div>

        {mode !== 'forgot' && (
          <div className="auth-tabs" role="tablist">
            <button className={`btn ${mode === 'login' ? 'btn--primary' : ''}`} onClick={() => switchMode('login')} aria-selected={mode === 'login'}>Sign in</button>
            <button className={`btn ${mode === 'register' ? 'btn--primary' : ''}`} onClick={() => switchMode('register')} aria-selected={mode === 'register'}>Create account</button>
          </div>
        )}

        {mode === 'forgot' && sentReset ? (
          <div className="toast" role="status">
            ✅ If an account exists for that email, a reset link is on its way.
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            {mode === 'register' && (
              <label className="field"><span>Name (optional)</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
            )}
            <label className="field"><span>Email</span>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            {mode !== 'forgot' && (
              <label className="field"><span>Password</span>
                <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </label>
            )}
            <button className="btn btn--primary" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? <span className="spinner" /> : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}
            </button>
            {err && <div className="err" role="alert">{err}</div>}
          </form>
        )}

        {mode === 'login' && (
          <p className="center" style={{ marginTop: 'var(--sp-3)' }}>
            <button type="button" className="linklike" onClick={() => switchMode('forgot')}>Forgot password?</button>
          </p>
        )}
        {mode === 'forgot' && (
          <p className="center" style={{ marginTop: 'var(--sp-3)' }}>
            <button type="button" className="linklike" onClick={() => switchMode('login')}>Back to sign in</button>
          </p>
        )}

        {googleAuth && mode !== 'forgot' && (
          <>
            <div className="auth-divider"><span>or</span></div>
            <a className="btn" href={oauthUrl('google')} style={{ width: '100%', display: 'block', textAlign: 'center' }}>
              Continue with Google
            </a>
          </>
        )}

        <p className="muted center" style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--fs-xs)' }}>
          By continuing you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
