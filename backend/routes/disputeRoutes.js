const express = require('express');
const Dispute = require('../models/Dispute');
const { logAction } = require('../utils/auditLog');
const { requirePermission } = require('../utils/adminPermissions');
const Case    = require('../models/Case');
const { authMiddleware, requireRole } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
//  CITIZEN ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/disputes
 * Citizen files a dispute against a case
 */
router.post('/', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const { caseId, category, description } = req.body;

    const caseData = await Case.findOne({ _id: caseId, userId: req.user.id });
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found or you are not the owner.' });
    }

    const againstType = caseData.lawyerId ? 'lawyer' : 'ngo';
    const againstId   = caseData.lawyerId || caseData.ngoId;

    if (!againstId) {
      return res.status(400).json({ message: 'This case has no assigned lawyer or NGO to dispute.' });
    }

    // Prevent duplicate open disputes for same case
    const existing = await Dispute.findOne({ caseId, userId: req.user.id, status: 'open' });
    if (existing) {
      return res.status(409).json({ message: 'You already have an open dispute for this case.' });
    }

    const dispute = await Dispute.create({
      userId: req.user.id,
      caseId,
      againstType,
      againstId,
      category,
      description
    });

    res.status(201).json({ message: 'Dispute filed successfully.', dispute });
  } catch (error) {
    console.error('File dispute error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/disputes/mine
 * Citizen views their own disputes
 */
router.get('/mine', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const disputes = await Dispute.find({ userId: req.user.id })
      .populate('caseId', 'title status category')
      .sort({ createdAt: -1 });
    res.json({ disputes, count: disputes.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/disputes/admin
 * Admin views all disputes with optional ?status=open|under_review|resolved|dismissed
 */
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [disputes, total] = await Promise.all([
      Dispute.find(filter)
        .populate('userId',  'name email')
        .populate('caseId',  'title status category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Dispute.countDocuments(filter)
    ]);

    res.json({ disputes, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PATCH /api/disputes/admin/:id/status
 * Admin updates a dispute status (under_review / resolved / dismissed) + optional note
 */
router.patch('/admin/:id/status', adminAuth, requirePermission('moderate'), async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const validStatuses = ['under_review', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ message: 'Dispute not found.' });

    dispute.status    = status;
    dispute.adminNote = adminNote || dispute.adminNote;
    if (status === 'resolved' || status === 'dismissed') {
      dispute.resolvedAt = new Date();
    }
    await dispute.save();

    // Audit log
    const caseDoc = await Case.findById(dispute.caseId).select('title').lean().catch(() => null);
    logAction(
      req,
      status === 'dismissed' ? 'REJECT_DISPUTE' : status === 'resolved' ? 'CLOSE_DISPUTE' : 'UPDATE_DISPUTE',
      'Dispute',
      dispute._id,
      `${dispute.category} · ${caseDoc?.title || 'Case'}`,
      adminNote || ''
    );

    res.json({ message: `Dispute marked ${status}.`, dispute });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
