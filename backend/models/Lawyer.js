const mongoose = require('mongoose');

const lawyerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, default: '' },
  cnic: { type: String, required: true, unique: true },
  photo: { type: String, default: '' },
  password: { type: String, required: true },
  
  barCouncilId: { type: String, required: true, unique: true },
  stateOfPractice: [{ type: String, required: true }],
  experience: { type: Number, required: true },
  officialDocument: { type: String, required: true },
  specialization: [{ type: String, required: true }],
  officeAddress: { type: String, required: true },
  languages: [{ type: String, required: true }],
  bio: { type: String, default: '' },
  
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String, default: '' },
  // Latest "request more information" sent by an admin (application stays pending)
  infoRequest: { message: { type: String, default: '' }, at: { type: Date, default: null } },
  isBlocked: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  totalCases: { type: Number, default: 0 },
  
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lawyer', lawyerSchema);