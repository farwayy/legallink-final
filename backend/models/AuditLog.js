const mongoose = require('mongoose');

/**
 * AuditLog — records every critical admin action for accountability.
 * Immutable: once created, audit entries must not be edited.
 */
const auditLogSchema = new mongoose.Schema({
  // Who performed the action
  adminId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  adminEmail: { type: String, default: 'system' },

  // What action was performed
  action: {
    type: String,
    enum: [
      'APPROVE_LAWYER',   'REJECT_LAWYER',   'BLOCK_LAWYER',   'UNBLOCK_LAWYER',   'DELETE_LAWYER',
      'APPROVE_NGO',      'REJECT_NGO',       'BLOCK_NGO',      'UNBLOCK_NGO',
      'BLOCK_USER',       'UNBLOCK_USER',     'DELETE_USER',
      'DELETE_REVIEW',    'DISMISS_FLAG',
      'CLOSE_DISPUTE',    'REJECT_DISPUTE',   'UPDATE_DISPUTE',
      'REQUEST_INFO_LAWYER', 'REQUEST_INFO_NGO',
      'INVITE_ADMIN',     'ACCEPT_INVITE',    'REVOKE_INVITE',    'UPDATE_ADMIN',   'DEACTIVATE_ADMIN', 'REACTIVATE_ADMIN', 'CHANGE_PASSWORD',
      'CREATE_ANNOUNCEMENT', 'UPDATE_ANNOUNCEMENT', 'DELETE_ANNOUNCEMENT',
      'SYSTEM'
    ],
    required: true
  },

  // What entity was acted upon
  targetType: { type: String, enum: ['Lawyer', 'NGO', 'User', 'Review', 'Dispute', 'Admin', 'Announcement', 'System'], required: true },
  targetId:   { type: mongoose.Schema.Types.ObjectId, default: null },
  targetName: { type: String, default: '' }, // human-readable name/email of target

  // Optional detail (reason, note, etc.)
  detail: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now }
}, {
  // Prevent updates — audit logs are append-only
  strict: true
});

// Prevent .save() from overwriting; only insertOne/create is allowed
auditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('AuditLog entries are immutable.');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
