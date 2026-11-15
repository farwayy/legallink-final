const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

/**
 * Checks the admin token AND that the admin account still exists and is
 * active, so a deactivated admin is locked out immediately, not when their
 * token expires.
 *
 * Sets req.admin = { id, _id, email, name, role: 'admin', adminRole }
 */
const adminAuth = async (req, res, next) => {
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

  if (decoded.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  try {
    const admin = await Admin.findById(decoded.id).select('name email role status passwordChangedAt').lean();
    if (!admin || (admin.status && admin.status !== 'active')) {
      return res.status(401).json({ message: 'Your admin account is not active.' });
    }
    // Tokens issued before a password change stop working
    if (admin.passwordChangedAt && decoded.iat && decoded.iat * 1000 < new Date(admin.passwordChangedAt).getTime() - 1000) {
      return res.status(401).json({ message: 'Your password was changed. Please sign in again.' });
    }
    req.admin = {
      id: String(admin._id),
      _id: admin._id,
      email: admin.email,
      name: admin.name,
      role: 'admin',
      adminRole: admin.role || 'super_admin'
    };
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = adminAuth;
