const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Request = require('../models/Request');
const Case = require('../models/Case');
const Lawyer = require('../models/Lawyer');
const Subscription = require('../models/Subscription');
const Notification = require('../models/Notification');
const { labelFor } = require('../utils/packages');

/**
 * Stripe client, or null when STRIPE_SECRET_KEY is not set.
 * Without a key LegalLink falls back to the demo payment screen.
 */
let stripeClient = null;
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) {
    const Stripe = require('stripe');
    stripeClient = new Stripe(key);
  }
  return stripeClient;
};

const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);
const stripeMode = () => (String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live_') ? 'live' : 'test');
const currency = () => (process.env.STRIPE_CURRENCY || 'pkr').toLowerCase();

/**
 * Turns a paid inquiry into an active case. Safe to call more than once for
 * the same payment (the webhook and the success page can both call it):
 * only the first call creates the case, later calls return the same case.
 *
 * payment = { method, transactionId, sessionId, paymentIntentId, receiptUrl }
 * Returns { caseId, created }
 */
const activatePaidRequest = async (requestId, payment = {}) => {
  // Claim the request atomically so two callers can't both create a case
  const claimed = await Request.findOneAndUpdate(
    { _id: requestId, status: 'accepted_awaiting_payment' },
    {
      $set: {
        status: 'completed',
        paymentStatus: 'completed',
        paymentMethod: payment.method || 'stripe',
        transactionId: payment.transactionId || '',
        stripeSessionId: payment.sessionId || '',
        stripePaymentIntentId: payment.paymentIntentId || '',
        receiptUrl: payment.receiptUrl || '',
        paidAt: new Date()
      }
    },
    { new: true }
  );

  if (!claimed) {
    const existing = await Request.findById(requestId);
    if (existing && existing.status === 'completed') {
      return { caseId: existing.caseId, created: false };
    }
    throw new Error(`Request ${requestId} is not waiting for payment (status: ${existing ? existing.status : 'missing'})`);
  }

  const request = claimed;
  try {
    const pkgLabel = labelFor(request.packageType);
    const txn = request.transactionId || request.stripePaymentIntentId || request.stripeSessionId;

    const subscription = await Subscription.create({
      userId: request.userId,
      lawyerId: request.lawyerId,
      packageType: request.packageType,
      amount: request.amount,
      paymentMethod: request.paymentMethod,
      paymentStatus: 'completed',
      transactionId: txn || `LL-${Date.now()}`,
      status: 'active'
    });

    const newCase = await Case.create({
      userId: request.userId,
      lawyerId: request.lawyerId,
      title: request.title && request.title.trim() ? request.title.trim() : `Legal representation - ${pkgLabel} package`,
      description:
        request.description && request.description.trim()
          ? request.description.trim()
          : `Client retainer for the ${pkgLabel} package. Fee: PKR ${Number(request.amount).toLocaleString()}.`,
      category: request.category && request.category.trim() ? request.category.trim() : 'General Legal Consultation',
      caseType: 'paid',
      packageType: request.packageType,
      paymentStatus: 'completed',
      paymentMethod: request.paymentMethod,
      status: 'assigned',
      priority: 'medium'
    });

    request.caseId = newCase._id;
    await request.save();
    await Lawyer.findByIdAndUpdate(request.lawyerId, { $inc: { totalCases: 1 } });

    const ref = `#${newCase._id.toString().slice(-6).toUpperCase()}`;
    const amountText = `PKR ${Number(request.amount).toLocaleString()}`;
    await Notification.create([
      {
        userId: request.lawyerId,
        userType: 'Lawyer',
        type: 'case_activated',
        title: 'New paid case',
        message: `Case ${ref} is open. The client paid ${amountText} for the ${pkgLabel} package.`,
        data: { caseId: newCase._id, requestId: request._id, subscriptionId: subscription._id }
      },
      {
        userId: request.userId,
        userType: 'User',
        type: 'case_activated',
        title: 'Payment received',
        message: `We received your payment of ${amountText}. Case ${ref} is now open.`,
        data: { caseId: newCase._id, requestId: request._id, subscriptionId: subscription._id, receiptUrl: request.receiptUrl }
      }
    ]).catch((e) => console.warn('[PAYMENT] Notification failed:', e.message));

    console.log(`💳 [PAYMENT] ${request.paymentMethod} payment for request ${request._id} → case ${newCase._id}`);
    return { caseId: newCase._id, created: true };
  } catch (error) {
    // Undo the claim so the payment can be applied again (the webhook retries)
    await Request.findByIdAndUpdate(request._id, { $set: { status: 'accepted_awaiting_payment', paymentStatus: 'pending' } }).catch(() => {});
    throw error;
  }
};

/**
 * Applies a Stripe Checkout Session if it has been paid.
 * Returns { paid, caseId, requestId }
 */
const applyCheckoutSession = async (session) => {
  const requestId = session.metadata && session.metadata.requestId;
  if (!requestId) return { paid: false };
  if (session.payment_status !== 'paid') return { paid: false, requestId };

  let paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent && session.payment_intent.id;
  let receiptUrl = '';
  const pi = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  const charge = pi && pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  if (charge && charge.receipt_url) receiptUrl = charge.receipt_url;

  if (!receiptUrl && paymentIntentId && getStripe()) {
    try {
      const full = await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
      receiptUrl = (full.latest_charge && full.latest_charge.receipt_url) || '';
    } catch (e) {
      /* receipt link is optional */
    }
  }

  const { caseId } = await activatePaidRequest(requestId, {
    method: 'stripe',
    transactionId: paymentIntentId || session.id,
    sessionId: session.id,
    paymentIntentId,
    receiptUrl
  });
  return { paid: true, caseId, requestId };
};

module.exports = { getStripe, stripeEnabled, stripeMode, currency, activatePaidRequest, applyCheckoutSession };
