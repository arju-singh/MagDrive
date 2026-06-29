import { Link } from 'react-router-dom';
import Footer from '../components/Footer.jsx';

const APP = 'MagDrive';
const COMPANY = 'MagDrive';
const SUPPORT = 'support@magdrive.app';
const UPDATED = 'June 2026';

// NOTE: This is reasonable starter boilerplate, NOT legal advice. Have counsel
// review and tailor it (jurisdiction, data processors, retention) before launch.
function PrivacyBody() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: {UPDATED}</p>
      <p>
        This Privacy Policy explains how {COMPANY} ("we", "us") collects, uses, and protects your
        information when you use {APP} (the "Service").
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account data:</strong> your email address, display name, and a securely hashed password.</li>
        <li><strong>Content:</strong> files, folders, and magazines you upload or create.</li>
        <li><strong>Usage data:</strong> pageviews and feature events, collected only with your consent, to improve the Service. We do not store raw IP addresses with these events.</li>
        <li><strong>Connected accounts:</strong> if you link a cloud provider, we store access tokens to fetch the files you authorize.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide, secure, and maintain the Service.</li>
        <li>To communicate with you about your account (e.g. email verification, password resets).</li>
        <li>To understand and improve product usage (consented analytics only).</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use essential cookies/local storage to keep you signed in. Analytics cookies are used only
        if you accept them in our cookie banner; you can change your choice by clearing site data.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal data. We share data only with service providers that help us run
        the Service (e.g. email delivery, payment processing) under appropriate safeguards.
      </p>

      <h2>Your rights</h2>
      <p>
        You may access, correct, export, or delete your account data. Contact us at{' '}
        <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a> to make a request.
      </p>

      <h2>Contact</h2>
      <p>Questions? Email <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>.</p>
    </>
  );
}

function TermsBody() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="muted">Last updated: {UPDATED}</p>
      <p>
        These Terms govern your use of {APP}, provided by {COMPANY}. By creating an account or using
        the Service, you agree to these Terms.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for activity under your account and for keeping your credentials secure.
        You must be able to form a binding contract to use the Service.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don't upload content you don't have the rights to, or that is illegal or harmful.</li>
        <li>Don't attempt to disrupt, reverse-engineer, or abuse the Service or other users.</li>
        <li>Don't use the Service to store or distribute malware or unlawful material.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You retain ownership of content you upload. You grant us the limited rights needed to store and
        display it back to you as part of operating the Service.
      </p>

      <h2>Subscriptions</h2>
      <p>
        Paid plans renew automatically until cancelled. You can upgrade, downgrade, or cancel at any
        time from your billing settings; changes take effect per the plan terms shown at checkout.
      </p>

      <h2>Disclaimer &amp; liability</h2>
      <p>
        The Service is provided "as is" without warranties. To the maximum extent permitted by law,
        {' '}{COMPANY} is not liable for indirect or consequential damages.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms. Material changes will be communicated through the Service. Continued
        use after changes means you accept the updated Terms.
      </p>

      <h2>Contact</h2>
      <p>Questions about these Terms? Email <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>.</p>
    </>
  );
}

export default function Legal({ kind }) {
  return (
    <div className="public-page">
      <div className="public-page__bar">
        <Link to="/" className="brand">MAG<span className="dot">.</span>DRIVE</Link>
      </div>
      <article className="prose">
        {kind === 'terms' ? <TermsBody /> : <PrivacyBody />}
        <p className="muted" style={{ marginTop: 'var(--sp-6)', fontSize: 'var(--fs-xs)' }}>
          This document is a template provided for convenience and is not legal advice.
        </p>
      </article>
      <Footer />
    </div>
  );
}
