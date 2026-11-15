const AuditLog = require('../models/AuditLog');
const Admin = require('../models/Admin');

/**
 * Records an admin action. Never blocks or fails the request.
 * Works with req.admin (adminAuth) or req.user (authMiddleware with role admin).
 */
const logAction = (req, action, targetType, targetId, targetName, detail = '') => {
  (async () => {
    const who = req.admin || req.user || {};
    let adminEmail = who.email;
    const adminId = who._id || who.id || null;
    if (!adminEmail && adminId) {
      const a = await Admin.findById(adminId).select('email').lean().catch(() => null);
      adminEmail = a?.email;
    }
    await AuditLog.create({
      adminId,
      adminEmail: adminEmail || 'unknown',
      action,
      targetType,
      targetId: targetId || null,
      targetName: targetName || '',
      detail
    });
  })().catch(err => console.error('AuditLog write error:', err));
};

module.exports = { logAction };
