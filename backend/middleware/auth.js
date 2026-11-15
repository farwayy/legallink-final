const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

/**
 * Is this account still allowed in? A sign-in token lasts 7 days, so without
 * this check a citizen deactivated by an admin, or a blocked advocate or NGO,
 * could keep using the site until their token ran out.
 * Results are kept for 30 seconds so this doesn't slow every request.
 */
const STATUS_CACHE_MS = 30 * 1000;
const statusCache = new Map(); // `${role}:${id}` -> { ok, message, at }

const MODEL_FOR_ROLE = { user: 'User', lawyer: 'Lawyer', ngo: 'NGO', admin: 'Admin' };

const checkAccountStatus = async (id, role) => {
  const key = `${role}:${id}`;
  const cached = statusCache.get(key);
  if (cached && Date.now() - cached.at < STATUS_CACHE_MS) return cached;

  let result = { ok: true, message: '' };
  const modelName = MODEL_FOR_ROLE[role];
  if (modelName && mongoose.modelNames().includes(modelName)) {
    const doc = await mongoose.model(modelName).findById(id).select('isActive isBlocked status').lean();
    if (!doc) result = { ok: false, message: 'This account no longer exists.' };
    else if (role === 'user' && doc.isActive === false) result = { ok: false, message: 'Your account has been deactivated. Contact LegalLink support.' };
    else if ((role === 'lawyer' || role === 'ngo') && doc.isBlocked) result = { ok: false, message: 'Your account has been blocked. Contact LegalLink support.' };
    else if (role === 'admin' && doc.status && doc.status !== 'active') result = { ok: false, message: 'Your admin account is not active.' };
  }
  result.at = Date.now();
  statusCache.set(key, result);
  if (statusCache.size > 5000) statusCache.clear();
  return result;
};

// Admin actions call this so a block/deactivation applies straight away
const forgetAccountStatus = (id) => {
  for (const role of Object.keys(MODEL_FOR_ROLE)) statusCache.delete(`${role}:${id}`);
};

// General authentication middleware
const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: 'Token is not valid' });
  }

  try {
    const status = await checkAccountStatus(decoded.id, decoded.role);
    if (!status.ok) {
      return res.status(401).json({ message: status.message, accountDisabled: true });
    }
  } catch (error) {
    // Database hiccup: don't lock people out, the routes still check ownership
    console.warn('[AUTH] Account status check failed:', error.message);
  }

  req.user = decoded; // { id, role }
  next();
};

// Role-based access middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

module.exports = { authMiddleware, requireRole, checkAccountStatus, forgetAccountStatus };
