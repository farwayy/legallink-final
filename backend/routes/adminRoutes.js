const express = require('express');
const User = require('../models/User');
const Lawyer = require('../models/Lawyer');
const Case = require('../models/Case');
const Admin = require('../models/Admin');
const NGO = require('../models/NGO');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const adminAuth = require('../middleware/adminAuth');
const { forgetAccountStatus } = require('../middleware/auth');
const Announcement = require('../models/Announcement');
const { requirePermission, PERMISSIONS } = require('../utils/adminPermissions');
const {
  sendApprovalNotification,
  sendRejectionNotification,
  sendNGOApprovalNotification,
  sendNGORejectionNotification,
  sendInfoRequestEmail,
  sendAdminInviteEmail
} = require('../services/verificationService');

// ── Helper: fire-and-forget audit log entry ──────────────────────────────────
// The admin token only carries { id, role }, so look up the email to record
// who did what (previously every entry said "unknown").
const { logAction } = require('../utils/auditLog');

const router = express.Router();

// ============ PUBLIC ROUTES (No middleware) ============

// First-time setup: creates the first super admin.
// Only works while there are NO admins at all; after that it is refused,
// so nobody can use it to create an admin account. New admins are invited
// from Settings > Admin team.
router.post('/setup', async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) {
      return res.status(403).json({ message: 'Setup is already complete. New admins must be invited by a super admin.' });
    }

    const admin = new Admin({
      name: 'Super Admin',
      email: 'admin@legallink.com',
      password: await bcrypt.hash('Admin@123', 10),
      role: 'super_admin',
      status: 'active',
      createdAt: new Date()
    });
    await admin.save();

    res.json({
      message: 'First admin created. Sign in and change this password straight away.',
      email: 'admin@legallink.com',
      password: 'Admin@123'
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ── Admin invitations (public: the invitee is not signed in yet) ─────────────
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const INVITE_HOURS = 48;

const findInvite = async (token) => {
  if (!token) return null;
  const admin = await Admin.findOne({ inviteTokenHash: hashToken(token), status: 'invited' });
  if (!admin) return null;
  if (!admin.inviteExpires || admin.inviteExpires < new Date()) return { expired: true, admin };
  return { admin };
};

// Check an invitation link before showing the form
router.get('/invite/:token', async (req, res) => {
  try {
    const found = await findInvite(req.params.token);
    if (!found) return res.status(404).json({ message: 'This invitation link is not valid or has already been used.' });
    if (found.expired) return res.status(410).json({ message: 'This invitation has expired. Ask a super admin to send a new one.' });
    res.json({ email: found.admin.email, role: found.admin.role, invitedBy: found.admin.invitedBy, expiresAt: found.admin.inviteExpires });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept: set name and password, activate the account
router.post('/invite/:token/accept', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const password = String(req.body.password || '');
    if (name.length < 2) return res.status(400).json({ message: 'Enter your full name.' });
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ message: 'Use at least 8 characters with a letter and a number.' });
    }
    const found = await findInvite(req.params.token);
    if (!found) return res.status(404).json({ message: 'This invitation link is not valid or has already been used.' });
    if (found.expired) return res.status(410).json({ message: 'This invitation has expired. Ask a super admin to send a new one.' });

    const admin = found.admin;
    admin.name = name;
    admin.password = password; // hashed by the model
    admin.status = 'active';
    admin.inviteTokenHash = null;
    admin.inviteExpires = null;
    admin.passwordChangedAt = new Date();
    await admin.save();

    logAction({ admin: { id: admin._id, email: admin.email } }, 'ACCEPT_INVITE', 'Admin', admin._id, admin.email, `Joined as ${admin.role.replace('_', ' ')}`);
    res.json({ message: 'Your admin account is ready. Sign in to continue.', email: admin.email });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Active announcements for a portal (public; shown as a banner)
router.get('/announcements/active', async (req, res) => {
  try {
    const audience = ['user', 'lawyer', 'ngo'].includes(req.query.audience) ? req.query.audience : null;
    if (!audience) return res.json({ announcements: [] });
    const now = new Date();
    const announcements = await Announcement.find({
      isActive: true,
      audience,
      startsAt: { $lte: now },
      $or: [{ endsAt: null }, { endsAt: { $gt: now } }]
    })
      .select('title message tone linkUrl linkText startsAt endsAt updatedAt')
      .sort({ startsAt: -1 })
      .limit(3)
      .lean();
    res.json({ announcements });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ PROTECTED ROUTES (adminAuth middleware required) ============

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users, count: users.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID
router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user status
router.patch('/users/:id/status', adminAuth, requirePermission('moderate'), async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    forgetAccountStatus(user._id);
    logAction(req, isActive ? 'UNBLOCK_USER' : 'BLOCK_USER', 'User', user._id, user.name || user.email, isActive ? 'Account activated' : 'Account deactivated');
    res.json({ message: `User ${isActive ? 'activated' : 'deactivated'}`, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user
router.delete('/users/:id', adminAuth, requirePermission('moderate'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    forgetAccountStatus(user._id);
    logAction(req, 'DELETE_USER', 'User', user._id, user.name || user.email);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all lawyers
router.get('/lawyers', adminAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.verificationStatus = status;
    
    const lawyers = await Lawyer.find(filter).select('-password').sort({ createdAt: -1 });
    res.json({ lawyers, count: lawyers.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify lawyer
router.patch('/lawyers/:id/verify', adminAuth, requirePermission('verify'), async (req, res) => {
  try {
    const { verificationStatus, rejectionReason } = req.body;
    
    const lawyer = await Lawyer.findByIdAndUpdate(
      req.params.id,
      { verificationStatus, rejectionReason: rejectionReason || '' },
      { new: true }
    ).select('-password');
    
    if (!lawyer) return res.status(404).json({ message: 'Lawyer not found' });
    
    // Audit log
    logAction(
      req,
      verificationStatus === 'approved' ? 'APPROVE_LAWYER' : 'REJECT_LAWYER',
      'Lawyer', lawyer._id, lawyer.email,
      rejectionReason || ''
    );

    // Send email notification to lawyer
    try {
      if (verificationStatus === 'approved') {
        await sendApprovalNotification(lawyer.email, lawyer.name, lawyer.phone, lawyer.barCouncilId);
        console.log(`📧 Lawyer approval email sent to: ${lawyer.email}`);
      } else if (verificationStatus === 'rejected') {
        await sendRejectionNotification(lawyer.email, lawyer.name, lawyer.phone, rejectionReason);
        console.log(`📧 Lawyer rejection email sent to: ${lawyer.email}`);
      }
    } catch (emailErr) {
      console.error('❌ Lawyer verification email dispatch error:', emailErr);
    }

    // Send real-time notification
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager) {
      const message = verificationStatus === 'approved'
        ? 'Your profile has been verified! You can now accept cases.'
        : `Your application was rejected. Reason: ${rejectionReason}`;
      
      await realTimeManager.notifyUser(lawyer._id.toString(), 'VERIFICATION_STATUS', {
        status: verificationStatus,
        message,
        rejectionReason: rejectionReason || null,
        requiresRefresh: true
      });
    }
    
    res.json({ message: `Lawyer ${verificationStatus}`, lawyer });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Block/unblock lawyer
router.patch('/lawyers/:id/block', adminAuth, requirePermission('verify'), async (req, res) => {
  try {
    const { isBlocked } = req.body;
    const lawyer = await Lawyer.findByIdAndUpdate(
      req.params.id,
      { isBlocked },
      { new: true }
    ).select('-password');
    
    if (!lawyer) return res.status(404).json({ message: 'Lawyer not found' });
    forgetAccountStatus(lawyer._id);
    logAction(req, isBlocked ? 'BLOCK_LAWYER' : 'UNBLOCK_LAWYER', 'Lawyer', lawyer._id, lawyer.email);
    res.json({ message: `Lawyer ${isBlocked ? 'blocked' : 'unblocked'}`, lawyer });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete lawyer
router.delete('/lawyers/:id', adminAuth, requirePermission('verify'), async (req, res) => {
  try {
    const lawyer = await Lawyer.findByIdAndDelete(req.params.id);
    if (!lawyer) return res.status(404).json({ message: 'Lawyer not found' });
    forgetAccountStatus(lawyer._id);
    logAction(req, 'DELETE_LAWYER', 'Lawyer', lawyer._id, lawyer.email);
    res.json({ message: 'Lawyer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all cases
router.get('/cases', adminAuth, async (req, res) => {
  try {
    const cases = await Case.find()
      .populate('userId', 'name email')
      .populate('lawyerId', 'name email')
      .populate('ngoId', 'name')
      .sort({ createdAt: -1 });
    res.json({ cases, count: cases.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Ask an applicant for more information; the application stays pending
const requestInfoHandler = (Model, kind, targetType) => async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ message: 'Write what you need from the applicant.' });
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: `${targetType} not found` });
    doc.infoRequest = { message, at: new Date() };
    await doc.save();
    sendInfoRequestEmail({ email: doc.email, name: doc.name, message, kind }).catch(() => {});
    logAction(req, `REQUEST_INFO_${targetType.toUpperCase()}`, targetType, doc._id, doc.name, message);
    res.json({ message: 'Request sent', infoRequest: doc.infoRequest });
  } catch (error) {
    console.error('Request info error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
router.patch('/lawyers/:id/request-info', adminAuth, requirePermission('verify'), requestInfoHandler(Lawyer, 'advocate', 'Lawyer'));
router.patch('/ngos/:id/request-info', adminAuth, requirePermission('verify'), requestInfoHandler(NGO, 'organisation', 'NGO'));

// Get dashboard stats
router.get('/dashboard/stats', adminAuth, async (req, res) => {
  try {
    const [totalUsers, totalLawyers, pendingLawyers, totalCases, activeNGOs, pendingNGOs] = await Promise.all([
      User.countDocuments(),
      Lawyer.countDocuments(),
      Lawyer.countDocuments({ verificationStatus: 'pending' }),
      Case.countDocuments(),
      NGO.countDocuments({
        $or: [
          { verificationStatus: 'approved' },
          { status: 'approved' },
          { status: 'active' },
          { isAccredited: true }
        ]
      }),
      NGO.countDocuments({
        $or: [
          { verificationStatus: 'pending' },
          { status: 'pending' }
        ]
      })
    ]);

    // Compute real 8-interval monthly timeline metrics from MongoDB
    const now = new Date();
    const intervals = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthLabel = start.toLocaleString('en-US', { month: 'short' });
      intervals.push({ id: 8 - i, month: monthLabel, year: start.getFullYear(), start, end });
    }

    const timeline = await Promise.all(
      intervals.map(async (interval) => {
        const [usersInPeriod, casesInPeriod, cumulativeUsers, cumulativeCases] = await Promise.all([
          User.countDocuments({ createdAt: { $gte: interval.start, $lte: interval.end } }),
          Case.countDocuments({ createdAt: { $gte: interval.start, $lte: interval.end } }),
          User.countDocuments({ createdAt: { $lte: interval.end } }),
          Case.countDocuments({ createdAt: { $lte: interval.end } })
        ]);
        return {
          id: interval.id,
          month: interval.month,
          year: interval.year,
          users: usersInPeriod,
          cases: casesInPeriod,
          cumulativeUsers,
          cumulativeCases
        };
      })
    );
    
    res.json({
      totalUsers,
      totalLawyers,
      pendingLawyers,
      totalCases,
      totalNGOs: activeNGOs,
      activeNGOs,
      pendingNGOs,
      timeline
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ NGO MANAGEMENT ============

// Get all NGOs (filter by ?status=pending|approved|rejected)
router.get('/ngos', adminAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.verificationStatus = status;

    const ngos = await NGO.find(filter).select('-password').sort({ createdAt: -1 });
    res.json({ ngos, count: ngos.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify (approve / reject) NGO
router.put('/ngos/:id/verify', adminAuth, requirePermission('verify'), async (req, res) => {
  try {
    const { verificationStatus, rejectionReason } = req.body;

    const ngo = await NGO.findByIdAndUpdate(
      req.params.id,
      { verificationStatus, rejectionReason: rejectionReason || '' },
      { new: true }
    ).select('-password');

    if (!ngo) return res.status(404).json({ message: 'NGO not found' });

    // Audit log
    logAction(
      req,
      verificationStatus === 'approved' ? 'APPROVE_NGO' : 'REJECT_NGO',
      'NGO', ngo._id, ngo.email,
      rejectionReason || ''
    );

    // Send email notification to NGO
    try {
      if (verificationStatus === 'approved') {
        await sendNGOApprovalNotification({
          email: ngo.email,
          name: ngo.name,
          registrationNumber: ngo.registrationNumber,
          focalName: ngo.focalPerson?.name
        });
        console.log(`📧 NGO approval email sent to: ${ngo.email}`);
      } else if (verificationStatus === 'rejected') {
        await sendNGORejectionNotification({
          email: ngo.email,
          name: ngo.name,
          registrationNumber: ngo.registrationNumber,
          focalName: ngo.focalPerson?.name,
          reason: rejectionReason
        });
        console.log(`📧 NGO rejection email sent to: ${ngo.email}`);
      }
    } catch (emailErr) {
      console.error('❌ NGO verification email dispatch error:', emailErr);
    }

    // Send real-time notification
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager) {
      const message = verificationStatus === 'approved'
        ? 'Your NGO has been verified! You can now receive pro bono cases.'
        : `Your NGO application was rejected. Reason: ${rejectionReason || 'No reason provided.'}`;

      await realTimeManager.notifyUser(ngo._id.toString(), 'VERIFICATION_STATUS', {
        status: verificationStatus,
        message,
        rejectionReason: rejectionReason || null,
        requiresRefresh: true
      });
    }

    res.json({ message: `NGO ${verificationStatus}`, ngo });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Block / Unblock NGO
router.put('/ngos/:id/toggle-status', adminAuth, requirePermission('verify'), async (req, res) => {
  try {
    const { isBlocked } = req.body;
    const ngo = await NGO.findByIdAndUpdate(
      req.params.id,
      { isBlocked },
      { new: true }
    ).select('-password');

    if (!ngo) return res.status(404).json({ message: 'NGO not found' });
    forgetAccountStatus(ngo._id);
    logAction(req, isBlocked ? 'BLOCK_NGO' : 'UNBLOCK_NGO', 'NGO', ngo._id, ngo.email);
    res.json({ message: `NGO ${isBlocked ? 'blocked' : 'unblocked'}`, ngo });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Audit Logs ─────────────────────────────────────────────────────────────────
/**
 * GET /api/admin/audit-logs
 * Optional query params: ?action=APPROVE_LAWYER&targetType=Lawyer&adminEmail=x&from=ISO&to=ISO&page=1&limit=50
 */
router.get('/audit-logs', adminAuth, async (req, res) => {
  try {
    const { action, targetType, adminEmail, from, to, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (action)      filter.action      = action;
    if (targetType)  filter.targetType  = targetType;
    if (adminEmail)  filter.adminEmail  = { $regex: adminEmail, $options: 'i' };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AuditLog.countDocuments(filter)
    ]);

    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ MY ACCOUNT ============

// Who am I (role + permissions for the admin console)
router.get('/me', adminAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json({ admin: admin.toPublic(), permissions: PERMISSIONS[admin.role || 'super_admin'] || [] });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update my name
router.patch('/me', adminAuth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (name.length < 2) return res.status(400).json({ message: 'Enter your full name.' });
    const admin = await Admin.findByIdAndUpdate(req.admin.id, { name }, { new: true });
    res.json({ message: 'Profile updated', admin: admin.toPublic() });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Change my password (signs out other sessions; returns a fresh token)
router.patch('/me/password', adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!(await admin.comparePassword(currentPassword || ''))) {
      return res.status(400).json({ message: 'Your current password is not correct.' });
    }
    const pw = String(newPassword || '');
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
      return res.status(400).json({ message: 'Use at least 8 characters with a letter and a number.' });
    }
    if (await admin.comparePassword(pw)) {
      return res.status(400).json({ message: 'Choose a password you are not already using.' });
    }
    admin.password = pw;
    admin.passwordChangedAt = new Date();
    await admin.save();
    const jwt = require('jsonwebtoken');
    // A fresh token for this browser; older tokens stop working
    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    logAction(req, 'CHANGE_PASSWORD', 'Admin', admin._id, admin.email);
    res.json({ message: 'Password changed. Other signed-in sessions have been signed out.', token });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ ADMIN TEAM (super admins only) ============

const createInvite = async (admin, invitedBy) => {
  const token = crypto.randomBytes(32).toString('hex');
  admin.inviteTokenHash = hashToken(token);
  admin.inviteExpires = new Date(Date.now() + INVITE_HOURS * 3600 * 1000);
  admin.invitedAt = new Date();
  admin.invitedBy = invitedBy;
  await admin.save();
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const link = `${clientUrl}/admin/accept-invite?token=${token}`;
  const mail = await sendAdminInviteEmail({ email: admin.email, role: admin.role, invitedBy, link, expiresHours: INVITE_HOURS }).catch(() => ({ success: false }));
  return { link, emailSent: Boolean(mail && mail.success) };
};

const activeSuperAdmins = (exceptId) =>
  Admin.countDocuments({ role: 'super_admin', status: { $in: ['active', null] }, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });

router.get('/team', adminAuth, async (req, res) => {
  try {
    const admins = await Admin.find().sort({ createdAt: 1 });
    res.json({ admins: admins.map((a) => a.toPublic()) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/team/invite', adminAuth, requirePermission('team'), async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const role = req.body.role;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (!Admin.ADMIN_ROLES.includes(role)) return res.status(400).json({ message: 'Choose a role.' });

    let admin = await Admin.findOne({ email });
    if (admin && admin.status !== 'invited') {
      return res.status(409).json({ message: 'This person already has an admin account.' });
    }
    if (!admin) admin = new Admin({ email, role, status: 'invited', name: '' });
    else admin.role = role;

    const { link, emailSent } = await createInvite(admin, req.admin.email);
    logAction(req, 'INVITE_ADMIN', 'Admin', admin._id, email, `Role: ${role.replace('_', ' ')}`);
    res.status(201).json({
      message: emailSent ? `Invitation sent to ${email}.` : `Invitation created. The email could not be sent, so copy the link and share it with ${email}.`,
      admin: admin.toPublic(),
      inviteLink: link,
      emailSent
    });
  } catch (error) {
    console.error('Invite admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/team/:id/resend', adminAuth, requirePermission('team'), async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin || admin.status !== 'invited') return res.status(404).json({ message: 'No pending invitation for this admin.' });
    const { link, emailSent } = await createInvite(admin, req.admin.email);
    logAction(req, 'INVITE_ADMIN', 'Admin', admin._id, admin.email, 'Invitation sent again');
    res.json({
      message: emailSent ? `A new invitation was sent to ${admin.email}.` : 'New link created. The email could not be sent, so copy the link and share it.',
      admin: admin.toPublic(),
      inviteLink: link,
      emailSent
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Change role, or deactivate / reactivate
router.patch('/team/:id', adminAuth, requirePermission('team'), async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const isSelf = String(admin._id) === String(req.admin.id);
    const { role, status } = req.body;

    if (role !== undefined && role !== admin.role) {
      if (!Admin.ADMIN_ROLES.includes(role)) return res.status(400).json({ message: 'Choose a valid role.' });
      if (isSelf) return res.status(400).json({ message: "You can't change your own role. Ask another super admin." });
      if (admin.role === 'super_admin' && (await activeSuperAdmins(admin._id)) === 0) {
        return res.status(400).json({ message: 'LegalLink needs at least one active super admin.' });
      }
      const from = admin.role;
      admin.role = role;
      await admin.save();
      logAction(req, 'UPDATE_ADMIN', 'Admin', admin._id, admin.email, `Role: ${from.replace('_', ' ')} → ${role.replace('_', ' ')}`);
    }

    if (status !== undefined && status !== admin.status) {
      if (!['active', 'deactivated'].includes(status) || admin.status === 'invited') {
        return res.status(400).json({ message: 'This change is not allowed.' });
      }
      if (isSelf) return res.status(400).json({ message: "You can't deactivate your own account." });
      if (status === 'deactivated' && admin.role === 'super_admin' && (await activeSuperAdmins(admin._id)) === 0) {
        return res.status(400).json({ message: 'LegalLink needs at least one active super admin.' });
      }
      admin.status = status;
      await admin.save();
      logAction(req, status === 'active' ? 'REACTIVATE_ADMIN' : 'DEACTIVATE_ADMIN', 'Admin', admin._id, admin.email);
    }

    res.json({ message: 'Saved', admin: admin.toPublic() });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel an invitation that hasn't been accepted
router.delete('/team/:id', adminAuth, requirePermission('team'), async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (admin.status !== 'invited') {
      return res.status(400).json({ message: 'Only pending invitations can be cancelled. Deactivate active admins instead.' });
    }
    await admin.deleteOne();
    logAction(req, 'REVOKE_INVITE', 'Admin', admin._id, admin.email);
    res.json({ message: 'Invitation cancelled' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ ANNOUNCEMENTS ============

const cleanAnnouncement = (body) => {
  const out = {};
  if (body.title !== undefined) out.title = String(body.title).trim().slice(0, 120);
  if (body.message !== undefined) out.message = String(body.message).trim().slice(0, 600);
  if (body.audience !== undefined) {
    const list = (Array.isArray(body.audience) ? body.audience : [body.audience]).filter((a) => ['user', 'lawyer', 'ngo'].includes(a));
    out.audience = [...new Set(list)];
  }
  if (body.tone !== undefined) out.tone = ['info', 'warning', 'success'].includes(body.tone) ? body.tone : 'info';
  if (body.linkUrl !== undefined) {
    const url = String(body.linkUrl).trim();
    out.linkUrl = /^(https?:\/\/|\/)/.test(url) ? url : '';
  }
  if (body.linkText !== undefined) out.linkText = String(body.linkText).trim().slice(0, 40);
  if (body.startsAt !== undefined) out.startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
  if (body.endsAt !== undefined) out.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  return out;
};

router.get('/announcements', adminAuth, async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 }).lean();
    res.json({ announcements });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/announcements', adminAuth, requirePermission('announce'), async (req, res) => {
  try {
    const data = cleanAnnouncement(req.body);
    if (!data.title) return res.status(400).json({ message: 'Add a title.' });
    if (!data.audience || data.audience.length === 0) return res.status(400).json({ message: 'Choose who should see it.' });
    if (data.endsAt && data.startsAt && data.endsAt <= data.startsAt) return res.status(400).json({ message: 'The end date must be after the start date.' });
    const a = await Announcement.create({ ...data, createdBy: req.admin.email, updatedBy: req.admin.email });
    logAction(req, 'CREATE_ANNOUNCEMENT', 'Announcement', a._id, a.title, `For: ${a.audience.map((x) => ({ user: 'citizens', lawyer: 'advocates', ngo: 'NGOs' }[x])).join(', ')}`);
    res.status(201).json({ message: 'Announcement published', announcement: a });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/announcements/:id', adminAuth, requirePermission('announce'), async (req, res) => {
  try {
    const data = cleanAnnouncement(req.body);
    if (data.title === '') return res.status(400).json({ message: 'Add a title.' });
    if (data.audience && data.audience.length === 0) return res.status(400).json({ message: 'Choose who should see it.' });
    const a = await Announcement.findById(req.params.id);
    if (!a) return res.status(404).json({ message: 'Announcement not found' });
    Object.assign(a, data, { updatedBy: req.admin.email });
    if (a.endsAt && a.startsAt && a.endsAt <= a.startsAt) return res.status(400).json({ message: 'The end date must be after the start date.' });
    await a.save();
    const detail = data.isActive !== undefined && Object.keys(data).length === 1 ? (data.isActive ? 'Turned on' : 'Turned off') : 'Edited';
    logAction(req, 'UPDATE_ANNOUNCEMENT', 'Announcement', a._id, a.title, detail);
    res.json({ message: 'Announcement saved', announcement: a });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/announcements/:id', adminAuth, requirePermission('announce'), async (req, res) => {
  try {
    const a = await Announcement.findByIdAndDelete(req.params.id);
    if (!a) return res.status(404).json({ message: 'Announcement not found' });
    logAction(req, 'DELETE_ANNOUNCEMENT', 'Announcement', a._id, a.title);
    res.json({ message: 'Announcement deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;