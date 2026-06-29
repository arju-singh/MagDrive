import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const token = sp.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (password.length < 8) return setErr('Password must be at least 8 characters.');
    if (password !== confirm) return setErr('Passwords do not match.');
    setState('sending');
    try {
      await api.resetPassword(token, password);
      setState('done');
      setTimeout(() => nav('/'), 1800);
    } catch (ex) {
      setState('idle');
      setErr(ex.message === 'invalid_token'
        ? 'This reset link is invalid or has expired. Request a new one.'
        : 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="center">
          <div className="brand-mark">MAG<span className="dot">.</span>DRIVE</div>
          <p className="muted" style={{ marginTop: 4 }}>Choose a new password</p>
        </div>

        {!token ? (
          <div className="err" role="alert">Missing reset token. Use the link from your email.</div>
        ) : state === 'done' ? (
          <div className="toast" role="status">✅ Password updated. Redirecting…</div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <label className="field"><span>New password</span>
              <input className="input" type="password" required minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </label>
            <label className="field"><span>Confirm password</span>
              <input className="input" type="password" required minLength={8} value={confirm}
                onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </label>
            <button className="btn btn--primary" type="submit" disabled={state === 'sending'} style={{ width: '100%' }}>
              {state === 'sending' ? <span className="spinner" /> : 'Update password'}
            </button>
            {err && <div className="err" role="alert">{err}</div>}
          </form>
        )}
        <p className="muted center" style={{ marginTop: 'var(--sp-4)' }}>
          <Link to="/">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
