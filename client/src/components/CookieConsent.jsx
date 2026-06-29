import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CONSENT_KEY = 'magdrive_consent';

export default function CookieConsent() {
  const [choice, setChoice] = useState(() => localStorage.getItem(CONSENT_KEY));
  const nav = useNavigate();
  if (choice) return null;

  function decide(value) {
    localStorage.setItem(CONSENT_KEY, value);
    setChoice(value);
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie consent">
      <div className="cookie-banner__text">
        <strong>We use cookies.</strong> Essential cookies keep you signed in. We'd also like to use
        analytics cookies to understand usage — only with your consent.{' '}
        <button className="linklike" onClick={() => nav('/privacy')}>Privacy Policy</button>
      </div>
      <div className="cookie-banner__actions">
        <button className="btn btn--sm" onClick={() => decide('rejected')}>Essential only</button>
        <button className="btn btn--sm btn--primary" onClick={() => decide('accepted')}>Accept all</button>
      </div>
    </div>
  );
}
