const mongoose = require('mongoose');

const hearingSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  notes: { type: String, default: '' },
  outcome: { type: String, default: '' },
  status: { type: String, enum: ['scheduled', 'completed', 'concluded', 'adjourned', 'cancelled'], default: 'scheduled' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const caseSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  lawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lawyer', default: null },
  ngoId:    { type: mongoose.Schema.Types.ObjectId, ref: 'NGO',    default: null },
  caseType: { type: String, enum: ['paid', 'pro_bono'], default: 'paid' },
  packageType: { type: String, default: null },
  paymentStatus: { type: String, enum: ['completed', 'pending', 'waived', 'failed'], default: null },
  paymentMethod: { type: String, default: null },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  status: { type: String, enum: ['pending', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  analysis: { type: String, default: '' },
  caseAnalysis: { type: String, default: '' },
  hearingDates: [hearingSchema],
  documents: [{
    name: String,
    url: String,
    fileSize: { type: String, default: '' },
    uploadedBy: { type: String, default: 'Client' },
    uploadedByType: { type: String, default: 'user' },
    uploadedAt: { type: Date, default: Date.now }
  }],
  assignments: [{
    lawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lawyer', required: true },
    lawyerName: { type: String, required: true },
    barCouncilId: { type: String, required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'NGO', required: true },
    assignedAt: { type: Date, default: Date.now },
    unassignedAt: { type: Date, default: null },
    reason: { type: String, default: 'Initial Intake Assignment' },
    isCurrent: { type: Boolean, default: true }
  }],
  messages: [{
    senderId: mongoose.Schema.Types.ObjectId,
    senderType: { type: String, enum: ['user', 'lawyer', 'ngo', 'admin'] },
    senderRoleLabel: { type: String, default: '' },
    message: String,
    timestamp: { type: Date, default: Date.now }
  }],
  // When each person last opened Messages / Documents / Hearings (drives unread counts)
  seenBy: [{
    _id: false,
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ['user', 'lawyer', 'ngo', 'admin'] },
    messages: { type: Date, default: null },
    documents: { type: Date, default: null },
    hearings: { type: Date, default: null }
  }],
  // Every status change, for the case activity timeline
  statusHistory: [{
    status: { type: String },
    at: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Record status changes made with .save()
caseSchema.pre('save', function() {
  if (this.isNew || this.isModified('status')) {
    const last = (this.statusHistory || [])[this.statusHistory.length - 1];
    if (!last || last.status !== this.status) this.statusHistory.push({ status: this.status, at: new Date() });
  }
});

// Record status changes made with findOneAndUpdate / updateOne
const recordStatusUpdate = function() {
  const u = this.getUpdate() || {};
  const status = (u.$set && u.$set.status) || u.status;
  if (typeof status === 'string') {
    u.$push = Object.assign({}, u.$push, { statusHistory: { status, at: new Date() } });
    this.setUpdate(u);
  }
};
caseSchema.pre('findOneAndUpdate', recordStatusUpdate);
caseSchema.pre('updateOne', recordStatusUpdate);

caseSchema.pre('save', function() {
  // Marking something as seen should not count as a case update
  const onlySeenChanged = !this.isNew && this.modifiedPaths().every((p) => p === 'seenBy' || p.startsWith('seenBy.'));
  if (!onlySeenChanged) this.updatedAt = Date.now();

  // Stamp hearings that were added or edited, so the client sees them as new
  (this.hearingDates || []).forEach((h) => {
    if (h.isNew || h.isModified()) h.updatedAt = new Date();
  });
});

module.exports = mongoose.model('Case', caseSchema);