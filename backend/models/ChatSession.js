const mongoose = require('mongoose');

// A saved Mizan conversation. Only signed-in users have conversations saved;
// visitors who are not signed in keep their chat in the browser tab only.
const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'model'], required: true },
  content: { type: String, required: true },
  // Extra details shown with an answer: category, urgency, suggested advocates/NGOs
  meta: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const chatSessionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  ownerRole: { type: String, enum: ['user', 'lawyer', 'ngo', 'admin'], required: true },
  title: { type: String, default: 'New conversation' },
  messages: { type: [chatMessageSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

chatSessionSchema.index({ owner: 1, updatedAt: -1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
