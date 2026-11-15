const mongoose = require('mongoose');

/**
 * A message from the LegalLink team shown as a banner at the top of the
 * citizen, advocate and/or NGO portals between startsAt and endsAt.
 */
const announcementSchema = new mongoose.Schema({
  title:   { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, default: '', trim: true, maxlength: 600 },
  // Who sees it: 'user' (citizens), 'lawyer' (advocates), 'ngo'
  audience: {
    type: [String],
    enum: ['user', 'lawyer', 'ngo'],
    default: ['user', 'lawyer', 'ngo']
  },
  tone:     { type: String, enum: ['info', 'warning', 'success'], default: 'info' },
  linkUrl:  { type: String, default: '', trim: true },
  linkText: { type: String, default: '', trim: true, maxlength: 40 },
  startsAt: { type: Date, default: Date.now },
  endsAt:   { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' }
}, { timestamps: true });

announcementSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
