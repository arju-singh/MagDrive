import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

const PLAN_LABEL = { free: 'Free', pro: 'Pro' };

export default function Billing() {
  const [sp, setSp] = useSearchParams();
  const [sub, setSub] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const checkout = sp.get('checkout'); // success | cancel (post-Stripe redirect)

  async function load() {
    setErr('');
    try {
      setSub(await api.billingSubscription());
    } catch (ex) {
      if (ex.status === 503) setErr('unavailable');
      else setErr('error');
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the ?checkout flag once read.
  useEffect(() => {
    if (checkout) {
      const t = setTimeout(() => { sp.delete('checkout'); setSp(sp, { replace: true }); load(); }, 100);
      return () => clearTimeout(t);
    }
  }, [checkout]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startCheckout() {
    setBusy(true); setErr('');
    try {
      const { url } = await api.billingCheckout();
      window.location.href = url;
    } catch (ex) {
      setBusy(false);
      setErr(ex.status === 503 ? 'unavailable' : 'error');
    }
  }

  async function openPortal() {
    setBusy(true); setErr('');
    try {
      const { url } = await api.billingPortal();
      window.location.href = url;
    } catch (ex) {
      setBusy(false);
      setErr(ex.data?.error === 'no_customer' ? 'no_customer' : 'error');
    }
  }

  if (err === 'unavailable' || (sub && sub.enabled === false)) {
    return (
      <div className="content-pad">
        <h1 className="page-title">Billing</h1>
        <div className="card-note">
          <p><strong>Billing isn't configured yet.</strong></p>
          <p className="muted">
            Payments are wired up but inactive. Add <code>STRIPE_SECRET_KEY</code>,{' '}
            <code>STRIPE_PRICE_ID</code>, and <code>STRIPE_WEBHOOK_SECRET</code> to the server's{' '}
            <code>.env</code> to enable subscriptions.
          </p>
        </div>
      </div>
    );
  }

  const plan = sub?.plan || 'free';
  const isPro = plan === 'pro';

  return (
    <div className="content-pad">
      <h1 className="page-title">Billing</h1>

      {checkout === 'success' && <div className="toast" role="status">✅ Subscription active — welcome to Pro!</div>}
      {checkout === 'cancel' && <div className="toast" role="status">Checkout cancelled. No charge was made.</div>}

      <div className="card-note">
        <p>Current plan: <strong>{PLAN_LABEL[plan] || plan}</strong>
          {sub?.status && <span className="muted"> · {sub.status}</span>}
        </p>
        {sub?.currentPeriodEnd && (
          <p className="muted">Renews / ends: {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>
        )}

        <div className="stack" style={{ marginTop: 'var(--sp-4)', maxWidth: 320 }}>
          {!isPro && (
            <button className="btn btn--primary" onClick={startCheckout} disabled={busy}>
              {busy ? <span className="spinner" /> : 'Upgrade to Pro'}
            </button>
          )}
          <button className="btn" onClick={openPortal} disabled={busy}>
            Manage subscription (upgrade / downgrade / cancel)
          </button>
        </div>

        {err === 'error' && <div className="err" role="alert" style={{ marginTop: 'var(--sp-3)' }}>Something went wrong. Please try again.</div>}
        {err === 'no_customer' && <div className="muted" style={{ marginTop: 'var(--sp-3)' }}>Start a subscription first to manage billing.</div>}
      </div>
    </div>
  );
}
