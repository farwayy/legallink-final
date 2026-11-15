/**
 * Simple in-memory rate limiter (no external dependency).
 *
 * Counts requests per key inside a sliding time window. When the limit is
 * reached the request is rejected with HTTP 429 and a friendly message that
 * says how long to wait.
 *
 * Note: counts live in this server process's memory, so they reset when the
 * server restarts and are not shared between multiple server instances. For a
 * multi-instance deployment, move the store to Redis or MongoDB.
 */
const createRateLimiter = ({ windowMs, max, keyFn, message }) => {
  const hits = new Map(); // key -> array of request timestamps

  // Periodically drop expired entries so the map doesn't grow forever
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, times] of hits) {
      const recent = times.filter((t) => now - t < windowMs);
      if (recent.length) hits.set(key, recent);
      else hits.delete(key);
    }
  }, Math.min(windowMs, 10 * 60 * 1000));
  cleanup.unref(); // don't keep the process alive just for this timer

  return (req, res, next) => {
    const key = keyFn(req);
    if (!key) return next(); // nothing to count (e.g. missing email); let the route validate

    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const retryAfterMs = windowMs - (now - recent[0]);
      const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
      res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({
        success: false,
        message: message(minutes),
        retryAfterMinutes: minutes,
      });
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
};

// Password reset: max 3 requests per email address per hour
const forgotPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyFn: (req) => {
    const email = req.body && typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return email ? `forgot:${email}` : null;
  },
  message: (minutes) =>
    `Too many password reset requests for this email. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
});

module.exports = { createRateLimiter, forgotPasswordLimiter };