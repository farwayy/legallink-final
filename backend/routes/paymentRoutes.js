const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const User = require('../models/User');
const adminAuth = require('../middleware/adminAuth');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { feeFor, labelFor } = require('../utils/packages');
const {
  getStripe,
  stripeEnabled,
  stripeMode,
  currency,
  applyCheckoutSession
} = require('../services/paymentService');

/**
 * Payments with Stripe Checkout (Stripe's own secure payment page).
 *
 *   GET  /api/payments/config         is card payment switched on?
 *   POST /api/payments/checkout       start paying for an accepted inquiry
 *   GET  /api/payments/session/:id    check a payment after Stripe sends the citizen back
 *   POST /api/payments/webhook        Stripe tells us a payment succeeded (source of truth)
 *   GET  /api/payments/admin          all payments, for the admin console
 *
 * Card details never reach LegalLink: the citizen types them on Stripe's page.
 */

router.get('/config', (req, res) => {
  res.json({ enabled: stripeEnabled(), mode: stripeEnabled() ? stripeMode() : null, currency: currency() });
});

// Start a Stripe Checkout for an inquiry the advocate has accepted
router.post('/checkout', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ message: 'Card payments are not set up yet. Please try again later.' });
    }

    const request = await Request.findById(req.body.requestId).populate('lawyerId', 'name');
    if (!request) return res.status(404).json({ message: 'Inquiry not found.' });
    if (String(request.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You can only pay for your own inquiry.' });
    }
    if (request.status === 'completed') {
      return res.status(409).json({ message: 'This inquiry is already paid.', caseId: request.caseId });
    }
    if (request.status !== 'accepted_awaiting_payment') {
      return res.status(400).json({ message: 'You can pay once the advocate accepts your inquiry.' });
    }

    // Reuse an open checkout so double-clicks don't create two payments
    if (request.stripeSessionId) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(request.stripeSessionId);
        if (existing.status === 'open' && existing.url) return res.json({ url: existing.url, sessionId: existing.id });
        if (existing.payment_status === 'paid') {
          const result = await applyCheckoutSession(existing);
          return res.status(409).json({ message: 'This inquiry is already paid.', caseId: result.caseId });
        }
      } catch (e) {
        /* expired or unknown session: create a new one */
      }
    }

    // The price always comes from the server, never from the browser
    const amount = feeFor(request.packageType);
    if (request.amount !== amount) {
      request.amount = amount;
    }

    const user = await User.findById(req.user.id).select('email name');
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const advocate = request.lawyerId && request.lawyerId.name ? request.lawyerId.name : 'your advocate';

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: user && user.email ? user.email : undefined,
        client_reference_id: String(request._id),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: currency(),
              unit_amount: Math.round(amount * 100),
              product_data: {
                name: `${labelFor(request.packageType)} representation package`,
                description: `Legal representation by ${advocate} on LegalLink`
              }
            }
          }
        ],
        metadata: { requestId: String(request._id), userId: String(req.user.id), lawyerId: String(request.lawyerId._id || request.lawyerId) },
        payment_intent_data: {
          receipt_email: user && user.email ? user.email : undefined,
          metadata: { requestId: String(request._id) },
          description: `LegalLink ${labelFor(request.packageType)} package · ${advocate}`
        },
        success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/payment/cancelled?request=${request._id}`,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60 // 1 hour
      }
    );

    request.stripeSessionId = session.id;
    request.paymentStatus = 'pending';
    request.currency = currency();
    await request.save();

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[PAYMENT] Checkout error:', error.message);
    res.status(500).json({ message: 'Could not start the payment. Please try again.' });
  }
});

// After Stripe sends the citizen back. Also activates the case if the webhook
// hasn't arrived yet (useful when running locally without the Stripe CLI).
router.get('/session/:id', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ message: 'Card payments are not set up.' });

    const session = await stripe.checkout.sessions.retrieve(req.params.id, { expand: ['payment_intent.latest_charge'] });
    if (!session || !session.metadata || String(session.metadata.userId) !== String(req.user.id)) {
      return res.status(404).json({ message: 'Payment not found.' });
    }

    const request = await Request.findById(session.metadata.requestId).populate('lawyerId', 'name');
    const base = {
      status: session.payment_status, // 'paid' | 'unpaid' | 'no_payment_required'
      amount: session.amount_total != null ? session.amount_total / 100 : request && request.amount,
      currency: session.currency,
      packageType: request && request.packageType,
      advocate: request && request.lawyerId ? request.lawyerId.name : '',
      requestId: request && request._id
    };

    if (session.payment_status !== 'paid') return res.json({ ...base, caseId: null });

    const result = await applyCheckoutSession(session);
    const fresh = await Request.findById(session.metadata.requestId).select('receiptUrl paidAt caseId');
    res.json({ ...base, caseId: result.caseId || (fresh && fresh.caseId), receiptUrl: fresh && fresh.receiptUrl, paidAt: fresh && fresh.paidAt });
  } catch (error) {
    console.error('[PAYMENT] Session check error:', error.message);
    res.status(500).json({ message: 'Could not check the payment. Refresh to try again.' });
  }
});

// Stripe webhook. Needs the raw request body (see server.js: express.json verify).
router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(503).send('Webhook not configured');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody || req.body, req.headers['stripe-signature'], secret);
  } catch (err) {
    console.warn('[PAYMENT] Webhook signature check failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await applyCheckoutSession(event.data.object);
        break;
      case 'checkout.session.expired': {
        const s = event.data.object;
        if (s.metadata && s.metadata.requestId) {
          await Request.updateOne(
            { _id: s.metadata.requestId, stripeSessionId: s.id, status: 'accepted_awaiting_payment' },
            { $set: { paymentStatus: 'unpaid', stripeSessionId: '' } }
          );
        }
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object;
        if (s.metadata && s.metadata.requestId) {
          await Request.updateOne({ _id: s.metadata.requestId, status: 'accepted_awaiting_payment' }, { $set: { paymentStatus: 'failed' } });
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent && charge.payment_intent.id;
        if (piId && charge.refunded) {
          await Request.updateOne({ stripePaymentIntentId: piId }, { $set: { paymentStatus: 'refunded' } });
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (error) {
    // 500 makes Stripe retry later
    console.error('[PAYMENT] Webhook handling error:', error.message);
    res.status(500).send('Webhook handling failed');
  }
});

// Admin: every payment attempt and its status
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const payments = await Request.find({ paymentStatus: { $in: ['pending', 'completed', 'failed', 'refunded'] } })
      .populate('userId', 'name email')
      .populate('lawyerId', 'name email')
      .sort({ paidAt: -1, createdAt: -1 })
      .lean();
    res.json({ payments, mode: stripeEnabled() ? stripeMode() : 'demo', currency: currency() });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
