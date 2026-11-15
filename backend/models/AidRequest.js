const mongoose = require('mongoose');

/**
 * AidRequest — created when a citizen requests pro bono aid from an NGO.
 * The NGO must explicitly Accept (→ Case is then created) or Reject it.
 */
const aidRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ngoId:  { type: mongoose.Schema.Types.ObjectId, ref: 'NGO',  required: true },

  title:       { type: String, required: true },
  description: { type: String, required: true },
  category:    { type: String, required: true },

  // 'pending' → NGO has not acted yet
  // 'accepted' → NGO accepted; a Case record has been created
  // 'rejected' → NGO declined the request
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },

  rejectionReason: { type: String, default: '' },

  // Populated when the NGO accepts and a Case is created
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

aidRequestSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('AidRequest', aidRequestSchema);
