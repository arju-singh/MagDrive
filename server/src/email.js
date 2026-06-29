import nodemailer from 'nodemailer';
import { config } from './config.js';
import { logger } from './logger.js';

// Lazily built transport — only when SMTP is configured.
let _transport = null;
function transport() {
  if (!config.emailEnabled) return null;
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return _transport;
}

/**
 * Best-effort send. Never throws to the caller — a failed email must not fail
 * the request (e.g. registration still succeeds if the verify mail bounces).
 * When SMTP is not configured we log the message (and any actionLink in dev)
 * so the flows are fully testable without a provider.
 */
export async function sendMail({ to, subject, html, text, actionLink }) {
  const t = transport();
  if (!t) {
    logger.warn('email skipped (SMTP not configured)', {
      to: redact(to),
      subject,
      // In dev, surface the actionable link so flows can be tested end-to-end.
      ...(config.isProd ? {} : { actionLink }),
    });
    return { skipped: true };
  }
  try {
    await t.sendMail({ from: config.smtp.from, to, subject, html, text });
    logger.info('email sent', { to: redact(to), subject });
    return { sent: true };
  } catch (e) {
    logger.error('email send failed', { subject, msg: e.message });
    return { error: true };
  }
}

// Don't log full addresses; keep enough to debug delivery.
function redact(addr = '') {
  const [u, d] = String(addr).split('@');
  if (!d) return '***';
  return `${u.slice(0, 2)}***@${d}`;
}

function shell(title, body) {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h2 style="margin:0 0 12px">${config.appName}</h2>
    <h3 style="margin:0 0 8px">${title}</h3>
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
  </body></html>`;
}

export function sendVerificationEmail(to, link) {
  return sendMail({
    to,
    subject: `Verify your ${config.appName} email`,
    actionLink: link,
    text: `Verify your email: ${link}`,
    html: shell(
      'Confirm your email',
      `<p>Welcome! Please confirm your email address to finish setting up your account.</p>
       <p><a href="${link}" style="display:inline-block;background:#e8825f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Verify email</a></p>
       <p style="color:#888;font-size:12px">Or paste this link: ${link}</p>`,
    ),
  });
}

export function sendPasswordResetEmail(to, link) {
  return sendMail({
    to,
    subject: `Reset your ${config.appName} password`,
    actionLink: link,
    text: `Reset your password: ${link}`,
    html: shell(
      'Reset your password',
      `<p>We received a request to reset your password. This link expires in 1 hour.</p>
       <p><a href="${link}" style="display:inline-block;background:#e8825f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Choose a new password</a></p>
       <p style="color:#888;font-size:12px">Or paste this link: ${link}</p>`,
    ),
  });
}

export function sendFeedbackNotification({ kind, fromEmail, message, meta }) {
  return sendMail({
    to: config.supportEmail,
    subject: `[${config.appName}] New ${kind} report`,
    text: `From: ${fromEmail || 'anonymous'}\n\n${message}\n\nMeta: ${JSON.stringify(meta || {})}`,
    html: shell(
      `New ${kind} report`,
      `<p><strong>From:</strong> ${fromEmail || 'anonymous'}</p>
       <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
       <pre style="background:#f6f6f6;padding:8px;border-radius:6px;font-size:12px">${escapeHtml(JSON.stringify(meta || {}, null, 2))}</pre>`,
    ),
  });
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
