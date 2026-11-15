const mongoose = require('mongoose');

/**
 * Dispute — filed by a citizen against a case (lawyer or NGO assignment).
 * Separate from the review flag system; this is a formal complaint queue.
 */
const disputeSchema = new mongoose.Schema({
  // Filed by
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Case being disputed
  caseId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },

  // Who is the dispute against
  againstType: { type: String, enum: ['lawyer', 'ngo'], required: true },
  againstId:   { type: mongoose.Schema.Types.ObjectId, required: true },

  // Dispute details
  category: {
    type: String,
    enum: [
      'Misconduct',
      'Abandoned Case',
      'Overcharging / Fee Dispute',
      'Breach of Confidentiality',
      'Poor Representation',
      'Harassment',
      'Other'
    ],
    required: true
  },
  description: { type: String, required: true },

  // Admin investigation
  status: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'dismissed'],
    default: 'open'
  },
  adminNote: { type: String, default: '' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  resolvedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

disputeSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Dispute', disputeSchema);
