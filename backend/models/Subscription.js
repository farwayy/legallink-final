const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lawyer', required: true },
  packageType: { type: String, enum: ['gold', 'platinum'], required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, default: 'demo' },
  paymentStatus: { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' },
  transactionId: { type: String, required: true },
  status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);