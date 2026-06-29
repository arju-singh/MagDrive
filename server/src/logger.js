// Minimal structured logger. No PII in logs (Rule #8) — log ids, not emails/content.
const fmt = (level, msg, meta) => {
  const base = { t: new Date().toISOString(), level, msg };
  return JSON.stringify(meta ? { ...base, ...meta } : base);
};

export const logger = {
  info: (msg, meta) => console.log(fmt('info', msg, meta)),
  warn: (msg, meta) => console.warn(fmt('warn', msg, meta)),
  error: (msg, meta) => console.error(fmt('error', msg, meta)),
};
