const Admin = require('../models/Admin');

/**
 * What each admin role may change. Every admin can VIEW every admin page;
 * these permissions only control actions.
 *
 *   verify    approve / reject / block advocates and NGOs, ask them for more information
 *   moderate  deactivate or delete citizens, decide disputes, keep or remove reviews
 *   announce  publish announcements
 *   team      invite, change and deactivate admins
 */
const PERMISSIONS = {
  super_admin: ['verify', 'moderate', 'announce', 'team'],
  verifier: ['verify'],
  moderator: ['moderate', 'announce']
};

const can = (role, permission) => (PERMISSIONS[role] || []).includes(permission);

/**
 * Express middleware. Use after adminAuth (req.admin) or after
 * authMiddleware + requireRole(['admin']) (req.user).
 */
const requirePermission = (permission) => async (req, res, next) => {
  try {
    let role = req.admin?.adminRole;
    if (!role) {
      const id = req.admin?.id || req.user?.id;
      const admin = id ? await Admin.findById(id).select('role status').lean() : null;
      if (!admin || (admin.status && admin.status !== 'active')) {
        return res.status(401).json({ message: 'Your admin account is not active.' });
      }
      role = admin.role || 'super_admin';
    }
    if (!can(role, permission)) {
      return res.status(403).json({ message: "Your admin role doesn't allow this action." });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { PERMISSIONS, can, requirePermission };
