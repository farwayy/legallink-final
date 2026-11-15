const mongoose = require('mongoose');

const focalPersonSchema = new mongoose.Schema({
  name:        { type: String, default: '' },
  designation: { type: String, default: '' },
  cnic:        { type: String, default: '' },
  phone:       { type: String, default: '' }
}, { _id: false });

const ngoMemberSchema = new mongoose.Schema({
  lawyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lawyer',
    required: true
  },
  designation: {
    type: String,
    default: 'Staff Advocate'
  },
  role: {
    type: String,
    enum: ['staff_advocate', 'panel_volunteer', 'lead_counsel'],
    default: 'staff_advocate'
  },
  status: {
    type: String,
    enum: ['pending_lawyer_approval', 'active', 'declined', 'inactive'],
    default: 'pending_lawyer_approval'
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date,
    default: null
  },
  leftAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const ngoSchema = new mongoose.Schema({
  // ── Core Identity ────────────────────────────────────────────
  name:               { type: String, required: true, trim: true },
  registrationNumber: { type: String, required: true, unique: true, trim: true },
  email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:           { type: String, required: true },
  phone:              { type: String, required: true },

  // ── Focal Person ─────────────────────────────────────────────
  focalPerson: { type: focalPersonSchema, default: () => ({}) },

  // ── Location ─────────────────────────────────────────────────
  address:  { type: String, required: true },
  city:     { type: String, required: true },
  province: { type: String, required: true },

  // ── Services ─────────────────────────────────────────────────
  focusAreas: [{
    type: String,
    enum: [
      'Human Rights',
      'Domestic Violence',
      'Child Protection',
      'Labor Rights',
      'Prisoner Aid',
      'Women Rights',
      'Refugee Rights',
      'Environmental Law',
      'Disability Rights'
    ]
  }],
  servicesOffered: [{
    type: String,
    enum: [
      'Pro Bono Legal Representation',
      'Legal Counseling',
      'Mediation',
      'Financial Bail Aid',
      'Document Assistance',
      'Court Accompaniment',
      'Awareness & Education'
    ]
  }],

  // ── Documents & Info ─────────────────────────────────────────
  officialDocument: { type: String, default: '' }, // path to uploaded file
  operatingHours:   { type: String, default: '09:00 AM - 05:00 PM' },
  website:          { type: String, default: '' },
  bio:              { type: String, default: '' },

  // ── Verification ─────────────────────────────────────────────
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: { type: String, default: '' },

  // ── Status ───────────────────────────────────────────────────
  // Latest "request more information" sent by an admin (application stays pending)
  infoRequest: { message: { type: String, default: '' }, at: { type: Date, default: null } },
  isBlocked:        { type: Boolean, default: false },
  isAcceptingCases: { type: Boolean, default: true },

  // ── Stats ────────────────────────────────────────────────────
  rating:            { type: Number, default: 0 },
  totalReviews:      { type: Number, default: 0 },
  totalCasesHandled: { type: Number, default: 0 },

  // ── Password Reset ───────────────────────────────────────────
  resetPasswordToken:   { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },

  // ── Panel Members (Lawyer Memberships) ───────────────────────
  members: [ngoMemberSchema],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NGO', ngoSchema);
