import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function VerifyBanner() {
  const { user, refreshUser } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [state, setState] = useState('idle'); // idle | sending | sent | error

  // Arrived back from the verify link (?verified=1) — refresh the profile, show a toast.
  const verified = sp.get('verified');
  useEffect(() => {
    if (verified === '1') {
      refreshUser();
      const t = setTimeout(() => {
        sp.delete('verified');
        setSp(sp, { replace: true });
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [verified]); // eslint-disable-line react-hooks/exhaustive-deps

  if (verified === '1') {
    return <div className="verify-banner verify-banner--ok">✅ Email verified — you're all set.</div>;
  }

  // Nothing to show once the account is verified.
  if (!user || user.emailVerified) return null;

  async function resend() {
    setState('sending');
    try {
      await api.resendVerification();
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="verify-banner">
      <span>✉️ Please verify your email to secure your account.</span>
      {state === 'sent' ? (
        <span className="muted">Verification email sent.</span>
      ) : (
        <button className="btn btn--sm" onClick={resend} disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Resend email'}
        </button>
      )}
      {state === 'error' && <span className="err">Couldn't send. Try again.</span>}
    </div>
  );
}
