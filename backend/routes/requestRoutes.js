const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const Case = require('../models/Case');
const Lawyer = require('../models/Lawyer');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Notification = require('../models/Notification');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { feeFor } = require('../utils/packages');
const { stripeEnabled, activatePaidRequest } = require('../services/paymentService');
const { 
  sendInquiryAcceptedEmail, 
  sendInquiryDeclinedEmail 
} = require('../services/verificationService');

// ── 1. SEND HIRE / REPRESENTATION INQUIRY (Citizen - Zero upfront payment) ──
router.post('/send', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const { lawyerId, packageType, title, description, category } = req.body;
    const userId = req.user.id;
    
    if (!lawyerId) {
      return res.status(400).json({ message: 'Target Lawyer ID is required' });
    }

    const pkg = (packageType || 'gold').toLowerCase();
    if (!['gold', 'platinum'].includes(pkg)) {
      return res.status(400).json({ message: 'Invalid package type. Must be gold or platinum.' });
    }

    // The fee always comes from the server's package list, never from the browser
    const feeAmount = feeFor(pkg);

    // Verify target lawyer exists
    const lawyer = await Lawyer.findById(lawyerId);
    if (!lawyer) {
      return res.status(404).json({ message: 'Target lawyer could not be found' });
    }

    // Check if citizen already has an active pending or awaiting-payment request for this counsel
    const existingRequest = await Request.findOne({ 
      userId, 
      lawyerId, 
      status: { $in: ['pending', 'accepted_awaiting_payment'] }
    });
    
    if (existingRequest) {
      return res.status(400).json({ 
        message: 'You already have an active representation inquiry with this advocate. Please wait for counsel review or complete payment on your accepted offer.' 
      });
    }

    // Saves new Request with status: 'pending', paymentStatus: 'unpaid'
    // Does NOT create a Case or Subscription yet!
    const request = new Request({
      userId,
      lawyerId,
      title: (title && title.trim()) ? title.trim() : `Legal Consultation - ${pkg.toUpperCase()} Package`,
      description: (description && description.trim()) ? description.trim() : '',
      category: (category && category.trim()) ? category.trim() : 'General Legal Consultation',
      packageType: pkg,
      amount: feeAmount,
      paymentMethod: 'demo',
      paymentStatus: 'unpaid',
      transactionId: '',
      status: 'pending'
    });
    
    await request.save();

    // Push in-app notification to the Lawyer
    try {
      const citizen = await User.findById(userId);
      const citizenName = citizen?.name || 'Citizen';

      await Notification.create({
        userId: lawyerId,
        userType: 'Lawyer',
        type: 'new_inquiry',
        title: 'New Client Inquiry',
        message: `New Client Inquiry from ${citizenName} for ${pkg.toUpperCase()} Package`,
        data: { 
          requestId: request._id,
          citizenId: userId,
          citizenName,
          packageType: pkg,
          amount: feeAmount
        }
      });
    } catch (notifErr) {
      console.warn('[NOTIF WARNING] Failed to create lawyer in-app notification:', notifErr.message);
    }

    res.json({ 
      success: true, 
      message: 'Representation inquiry submitted successfully. Counsel has been notified for intake review.', 
      requestId: request._id,
      request
    });
  } catch (error) {
    console.error('Error sending representation inquiry:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ── 2. GET PENDING & AWAITING PAYMENT INQUIRIES (Lawyer) ──
router.get('/pending', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const requests = await Request.find({ 
      lawyerId: req.user.id, 
      status: { $in: ['pending', 'accepted_awaiting_payment'] }
    })
      .populate('userId', 'name email phone photo')
      .sort({ createdAt: -1 });
    
    res.json({ requests, count: requests.length });
  } catch (error) {
    console.error('Error fetching lawyer inquiries:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── 3. GET CITIZEN'S INQUIRIES & RETAINER OFFERS (Citizen) ──
router.get('/my-requests', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const requests = await Request.find({ userId: req.user.id })
      .populate('lawyerId', 'name photo specialization phone email location')
      .sort({ createdAt: -1 });
    
    res.json({ requests, count: requests.length });
  } catch (error) {
    console.error('Error fetching citizen inquiries:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── 4. ACCEPT INQUIRY (Lawyer accepts inquiry) ──
router.post('/:id/accept', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ message: 'Representation inquiry not found' });
    }

    // Protected: verify req.user.id === request.lawyerId — 403 otherwise
    if (request.lawyerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Forbidden: You are not authorized to accept an inquiry addressed to another counsel.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Inquiry cannot be accepted because it is currently "${request.status}".` });
    }
    
    // Updates request.status = 'accepted_awaiting_payment'
    request.status = 'accepted_awaiting_payment';
    await request.save();

    // Fetch lawyer and citizen for notifications
    const lawyer = await Lawyer.findById(req.user.id);
    const citizen = await User.findById(request.userId);
    const lawyerName = lawyer?.name || 'Legal Counsel';
    const citizenName = citizen?.name || 'Citizen';

    // Push in-app notification to Citizen
    try {
      await Notification.create({
        userId: request.userId,
        userType: 'User',
        type: 'inquiry_accepted',
        title: 'Representation Inquiry Accepted!',
        message: `Advocate ${lawyerName} has accepted your representation inquiry! Please complete payment to activate your case.`,
        data: {
          requestId: request._id,
          lawyerId: lawyer?._id,
          lawyerName,
          packageType: request.packageType,
          amount: request.amount
        }
      });
    } catch (notifErr) {
      console.warn('[NOTIF WARNING] Failed to create citizen in-app notification:', notifErr.message);
    }

    // Push email to Citizen
    if (citizen?.email) {
      sendInquiryAcceptedEmail({
        email: citizen.email,
        citizenName,
        lawyerName,
        packageType: request.packageType,
        amount: request.amount,
        requestId: request._id
      }).catch((emailErr) => {
        console.warn('[EMAIL WARNING] Failed to dispatch inquiry accepted email:', emailErr.message);
      });
    }
    
    res.json({ 
      success: true, 
      message: `Inquiry accepted! Citizen has been notified to complete retainer payment for ${request.packageType.toUpperCase()} Package.`, 
      request 
    });
  } catch (error) {
    console.error('Error accepting inquiry:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── 5. REJECT / DECLINE INQUIRY (Lawyer declines inquiry) ──
// Audited and adapted from existing POST /api/requests/:id/reject
router.post('/:id/reject', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const { rejectionReason, reason } = req.body || {};
    const request = await Request.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ message: 'Representation inquiry not found' });
    }

    // Protected: verify req.user.id === request.lawyerId — 403 otherwise
    if (request.lawyerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Forbidden: You are not authorized to decline an inquiry addressed to another counsel.' });
    }

    if (request.status === 'completed' || request.status === 'rejected') {
      return res.status(400).json({ message: `Inquiry is already marked as "${request.status}".` });
    }
    
    const declineReason = rejectionReason || reason || 'Advocate is currently unavailable for new retainers';

    // Updates request.status = 'rejected'. Zero payment taken, nothing to reverse.
    request.status = 'rejected';
    request.rejectionReason = declineReason;
    request.paymentStatus = 'unpaid';
    await request.save();

    // Fetch lawyer and citizen for notifications
    const lawyer = await Lawyer.findById(req.user.id);
    const citizen = await User.findById(request.userId);
    const lawyerName = lawyer?.name || 'Legal Counsel';
    const citizenName = citizen?.name || 'Citizen';

    // Push in-app notification to Citizen
    try {
      await Notification.create({
        userId: request.userId,
        userType: 'User',
        type: 'inquiry_declined',
        title: 'Inquiry Notice',
        message: `Advocate ${lawyerName} was unable to accept your inquiry.`,
        data: {
          requestId: request._id,
          lawyerId: lawyer?._id,
          lawyerName,
          reason: declineReason
        }
      });
    } catch (notifErr) {
      console.warn('[NOTIF WARNING] Failed to create citizen in-app decline notification:', notifErr.message);
    }

    // Push email to Citizen
    if (citizen?.email) {
      sendInquiryDeclinedEmail({
        email: citizen.email,
        citizenName,
        lawyerName,
        reason: declineReason
      }).catch((emailErr) => {
        console.warn('[EMAIL WARNING] Failed to dispatch inquiry declined email:', emailErr.message);
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Inquiry declined. The applicant has been notified with zero billing impact.',
      request 
    });
  } catch (error) {
    console.error('Error rejecting inquiry:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── 6. COMPLETE PAYMENT & ACTIVATE CASE (Citizen completes demo checkout) ──
// Demo payment (only when Stripe is NOT set up). With Stripe, payment goes
// through /api/payments/checkout and the case opens only after Stripe confirms it.
router.post('/:id/complete-payment', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    if (stripeEnabled()) {
      return res.status(400).json({ message: 'Please pay by card through the secure checkout.' });
    }

    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Representation inquiry not found' });
    }
    if (request.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Forbidden: You are only authorized to complete payment for your own representation inquiry.' });
    }
    if (request.status !== 'accepted_awaiting_payment') {
      return res.status(400).json({
        message: `Payment cannot be processed. Current inquiry status is "${request.status}". Counsel must formally accept the inquiry first.`
      });
    }

    const txn = `DEMO-LL-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { caseId } = await activatePaidRequest(request._id, { method: 'demo', transactionId: txn });

    res.json({
      success: true,
      message: `Payment successful! Case #${String(caseId).slice(-6).toUpperCase()} is now active.`,
      caseId,
      requestId: request._id
    });
  } catch (error) {
    console.error('Error completing inquiry payment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;