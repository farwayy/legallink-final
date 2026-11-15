const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lawyer', required: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  category: { type: String, default: 'General Legal Consultation' },
  packageType: { type: String, enum: ['gold', 'platinum'], required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, default: 'demo' },
  paymentStatus: { type: String, enum: ['unpaid', 'pending', 'completed', 'failed', 'refunded'], default: 'unpaid' },
  transactionId: { type: String, default: '' },
  // Stripe
  currency: { type: String, default: 'pkr' },
  stripeSessionId: { type: String, default: '' },
  stripePaymentIntentId: { type: String, default: '' },
  receiptUrl: { type: String, default: '' },
  paidAt: { type: Date, default: null },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', default: null },
  status: { 
    type: String, 
    enum: ['pending', 'accepted_awaiting_payment', 'completed', 'rejected'], 
    default: 'pending' 
  },
  rejectionReason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Request', requestSchema);