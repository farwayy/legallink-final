/**
 * Small security helpers used by server.js and the routes.
 * No extra packages needed.
 */
const { createRateLimiter } = require('./rateLimit');

// ── 1. Block MongoDB operators in request bodies ─────────────────────────────
// Stops tricks like { "email": { "$ne": null } } that turn a login lookup into
// "any account". Keys starting with "$" or containing "." are removed.
const stripOperators = (value, depth = 0) => {
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripOperators(v, depth + 1));
  if (Buffer.isBuffer(value)) return value;
  const clean = {};
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    clean[key] = stripOperators(value[key], depth + 1);
  }
  return clean;
};

const sanitizeInput = (req, _res, next) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = stripOperators(req.body);
  }
  if (req.params && typeof req.params === 'object') {
    for (const k of Object.keys(req.params)) {
      if (typeof req.params[k] !== 'string') req.params[k] = String(req.params[k]);
    }
  }
  next();
};

// ── 2. Basic security headers on every response ──────────────────────────────
const RISKY_FILE = /\.(html?|xhtml|svg|xml|js|mjs)$/i;

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.removeHeader('X-Powered-By');
  if (req.path.startsWith('/api/files/view') || req.path.startsWith('/api/documents/')) {
    // Private documents may be previewed inside LegalLink's own pages only
    const client = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${client}`);
  } else if (req.path.startsWith('/api/')) {
    // API answers are data only
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  } else if (RISKY_FILE.test(req.path)) {
    // An uploaded web page or SVG is downloaded, never opened, and can't run scripts
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Disposition', 'attachment');
  }
  next();
};

// ── 3. Refuse to start with a missing JWT secret, warn when it is weak ──────
const checkJwtSecret = () => {
  const secret = process.env.JWT_SECRET || '';
  if (!secret) {
    console.error('\n❌ JWT_SECRET is missing from backend/.env. The server will not start without it.\n');
    process.exit(1);
  }
  if (secret.length < 32 || /change_this|your_super_secret|secret123|changeme/i.test(secret)) {
    console.warn('\n⚠️  JWT_SECRET in backend/.env is weak or still the example value.');
    console.warn('   Anyone who guesses it can sign in as any user. Replace it with a long random value:');
    console.warn('   node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
  }
};

// ── 4. Only allow safe links for documents ───────────────────────────────────
// Accepts https://… / http://… links and files we stored under /uploads/.
// Rejects javascript:, data: and anything else that could run code when clicked.
const safeDocUrl = (url) => {
  if (typeof url !== 'string') return '';
  const u = url.trim();
  if (!u || u === '#') return '';
  if (/^https?:\/\/[^\s]+$/i.test(u)) return u;
  if (/^\/uploads\/[A-Za-z0-9._\-/]+$/.test(u) && !u.includes('..')) return u;
  return null; // not allowed
};

// ── 5. Rate limits for sign-in and verification codes ────────────────────────
const ipOf = (req) => req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
const emailOf = (req) => (req.body && typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '');
const plural = (m) => `${m} minute${m === 1 ? '' : 's'}`;

// 10 sign-in attempts per email per 15 minutes, and 30 per network address
const loginLimiterByEmail = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => (emailOf(req) ? `login:${emailOf(req)}` : null),
  message: (m) => `Too many sign-in attempts. Please wait ${plural(m)} and try again.`
});
const loginLimiterByIp = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyFn: (req) => `login-ip:${ipOf(req)}`,
  message: (m) => `Too many sign-in attempts from this network. Please wait ${plural(m)} and try again.`
});
const loginLimiter = [loginLimiterByIp, loginLimiterByEmail];

// Verification codes: 5 emails per address per 15 minutes, 20 per network address
const codeLimiter = [
  createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyFn: (req) => `code-ip:${ipOf(req)}`,
    message: (m) => `Too many code requests from this network. Please wait ${plural(m)}.`
  }),
  createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyFn: (req) => (emailOf(req) ? `code:${emailOf(req)}` : null),
    message: (m) => `Too many codes sent to this email. Please wait ${plural(m)} before asking for another.`
  })
];

// New accounts: 10 sign-ups per network address per hour
const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyFn: (req) => `signup-ip:${ipOf(req)}`,
  message: (m) => `Too many sign-ups from this network. Please wait ${plural(m)}.`
});

// ── 6. Password rule shared by every sign-up and reset ──────────────────────
const passwordProblem = (pw) => {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must include a letter and a number.';
  if (pw.length > 128) return 'Password is too long.';
  return '';
};

module.exports = {
  sanitizeInput,
  securityHeaders,
  checkJwtSecret,
  safeDocUrl,
  loginLimiter,
  codeLimiter,
  signupLimiter,
  passwordProblem
};
