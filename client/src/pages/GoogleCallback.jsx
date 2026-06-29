import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// Captures the token from the OAuth redirect fragment (#token=…), adopts the
// session, and bounces to the app. On failure, returns to sign-in with a message.
export default function GoogleCallback() {
  const { loginWithToken } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');
    if (!token) {
      setErr('Google sign-in failed. Please try again.');
      const t = setTimeout(() => nav('/', { replace: true }), 2500);
      return () => clearTimeout(t);
    }
    (async () => {
      try {
        await loginWithToken(token);
        nav('/', { replace: true });
      } catch {
        setErr('Could not complete sign-in. Please try again.');
        setTimeout(() => nav('/', { replace: true }), 2500);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="auth-wrap">
      <div className="auth-card center">
        {err ? <div className="err" role="alert">{err}</div> : <><span className="spinner" /> <p className="muted">Signing you in…</p></>}
      </div>
    </div>
  );
}
