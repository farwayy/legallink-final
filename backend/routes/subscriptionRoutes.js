const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const { authMiddleware } = require('../middleware/auth');
const { stripeEnabled } = require('../services/paymentService');

// Create subscription
// Demo only: with Stripe set up, access is granted only after a verified payment
router.post('/create', authMiddleware, async (req, res) => {
  try {
    if (stripeEnabled()) {
      return res.status(400).json({ success: false, message: 'Please pay by card through the secure checkout.' });
    }
    const { lawyerId, packageType, amount, transactionId, paymentMethod, paymentStatus } = req.body;
    const userId = req.user.id;

    const subscription = new Subscription({
      userId,
      lawyerId,
      packageType,
      amount,
      paymentMethod: paymentMethod || 'demo',
      paymentStatus: paymentStatus || 'completed',
      transactionId: transactionId || `DEMO-TXN-${Date.now()}`,
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    await subscription.save();
    res.json({ success: true, subscription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Check if user has active subscription for a lawyer
router.get('/check/:lawyerId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lawyerId } = req.params;

    const subscription = await Subscription.findOne({
      userId,
      lawyerId,
      status: 'active',
      $or: [
        { expiresAt: { $gt: new Date() } },
        { endDate: { $gt: new Date() } }
      ]
    });

    res.json({ hasAccess: !!subscription, subscription });
  } catch (error) {
    res.status(500).json({ hasAccess: false, message: error.message });
  }
});

// Get user's all subscriptions
router.get('/my-subscriptions', authMiddleware, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ 
      userId: req.user.id, 
      status: 'active' 
    }).populate('lawyerId', 'name specialization location photo');
    
    res.json({ subscriptions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;