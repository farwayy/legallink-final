const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Admin accounts.
 *
 * role     what the admin may do (see utils/adminPermissions.js)
 *          super_admin  everything, including managing other admins
 *          verifier     approve / reject advocates and NGOs
 *          moderator    citizens, disputes, reviews and announcements
 * status   invited      an invitation was sent; no password yet
 *          active       can sign in
 *          deactivated  cannot sign in; kept for the audit trail
 */
const ADMIN_ROLES = ['super_admin', 'verifier', 'moderator'];

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  // Not required while the admin is only invited
  password: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ADMIN_ROLES,
    default: 'super_admin'
  },
  status: {
    type: String,
    enum: ['invited', 'active', 'deactivated'],
    default: 'active'
  },

  // Invitation (only the SHA-256 hash of the token is stored)
  inviteTokenHash: { type: String, default: null },
  inviteExpires:   { type: Date, default: null },
  invitedBy:       { type: String, default: '' },
  invitedAt:       { type: Date, default: null },

  // Sign-in security
  lastLoginAt:         { type: Date, default: null },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil:           { type: Date, default: null },
  passwordChangedAt:   { type: Date, default: null },

  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Mongoose 9: async middleware must not use next(). Skip values that are
// already bcrypt hashes so callers that pre-hash are not double-hashed.
adminSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) return;
  if (/^\$2[aby]\$\d{2}\$/.test(this.password)) return;
  this.password = await bcrypt.hash(this.password, 10);
});

adminSchema.methods.comparePassword = async function(password) {
  if (!this.password) return false;
  return await bcrypt.compare(password, this.password);
};

adminSchema.methods.isLocked = function() {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

// What is safe to send to the browser
adminSchema.methods.toPublic = function() {
  return {
    _id: this._id,
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    status: this.status,
    invitedBy: this.invitedBy,
    invitedAt: this.invitedAt,
    inviteExpires: this.inviteExpires,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt
  };
};

const Admin = mongoose.model('Admin', adminSchema);
Admin.ADMIN_ROLES = ADMIN_ROLES;

module.exports = Admin;
