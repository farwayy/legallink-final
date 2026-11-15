const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const NGO = require('../models/NGO');
const Case = require('../models/Case');
const AidRequest = require('../models/AidRequest');
const User = require('../models/User');
const Lawyer = require('../models/Lawyer');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { loginLimiter, signupLimiter, passwordProblem } = require('../middleware/security');
const { sendNGOUnderReviewNotification, sendMailSafe } = require('../services/verificationService');
const { triggerCaseResolvedReviewPrompt } = require('../services/reviewPromptService');
const { uploadLegalDoc, getUploadedFileUrl } = require('../services/cloudinaryService');

const router = express.Router();

// ─── JWT Helper ──────────────────────────────────────────────────────────────
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ─── NGO Auth Middleware ─────────────────────────────────────────────────────
const ngoAuth = [authMiddleware, requireRole(['ngo'])];

// ═══════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/ngo/register
 * Multipart form — creates NGO with status 'pending'
 */
router.post('/register', signupLimiter, uploadLegalDoc.single('officialDocument'), async (req, res) => {
  try {
    const {
      name, registrationNumber, email, password, phone,
      address, city, province, operatingHours, website, bio,
      focusAreas, servicesOffered,
      // focalPerson fields
      focalName, focalDesignation, focalCnic, focalPhone
    } = req.body;

    const pwProblem = passwordProblem(password);
    if (pwProblem) return res.status(400).json({ message: pwProblem });

    // Duplicate check
    const exists = await NGO.findOne({
      $or: [{ email }, { registrationNumber }]
    });
    if (exists) {
      return res.status(400).json({
        message: exists.email === email
          ? 'An NGO with this email is already registered.'
          : 'An NGO with this registration number is already registered.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Parse array fields (sent as JSON strings from FormData)
    let parsedFocusAreas    = [];
    let parsedServicesOffered = [];
    try { parsedFocusAreas = typeof focusAreas === 'string' ? JSON.parse(focusAreas) : (focusAreas || []); } catch {}
    try { parsedServicesOffered = typeof servicesOffered === 'string' ? JSON.parse(servicesOffered) : (servicesOffered || []); } catch {}

    const documentPath = req.file ? getUploadedFileUrl(req.file) : '';

    const ngo = new NGO({
      name,
      registrationNumber,
      email,
      password: hashedPassword,
      phone,
      focalPerson: {
        name:        focalName        || '',
        designation: focalDesignation || '',
        cnic:        focalCnic        || '',
        phone:       focalPhone       || ''
      },
      address,
      city,
      province,
      focusAreas:      parsedFocusAreas,
      servicesOffered: parsedServicesOffered,
      officialDocument: documentPath,
      operatingHours: operatingHours || '09:00 AM - 05:00 PM',
      website: website || '',
      bio:     bio     || ''
    });

    await ngo.save();

    // Send confirmation email to the NGO that their registration is under review
    try {
      await sendNGOUnderReviewNotification({
        email: ngo.email,
        name: ngo.name,
        registrationNumber: ngo.registrationNumber,
        focalName: ngo.focalPerson?.name,
        city: ngo.city,
        province: ngo.province
      });
      console.log(`📧 NGO under-review confirmation email sent to: ${ngo.email}`);
    } catch (emailErr) {
      console.error('❌ NGO under-review email notification error:', emailErr);
    }

    res.status(201).json({
      message: 'Registration submitted successfully. Your account is pending admin verification.',
      ngoId: ngo._id
    });
  } catch (error) {
    console.error('NGO register error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/ngo/login
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    const ngo = await NGO.findOne({ email });
    if (!ngo) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Check the password first, so the account's status is only shown to its owner
    const isMatch = await bcrypt.compare(password, ngo.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    if (ngo.verificationStatus === 'pending') {
      return res.status(403).json({
        message: 'Your account is pending admin verification. Please check back soon.'
      });
    }
    if (ngo.verificationStatus === 'rejected') {
      return res.status(403).json({
        message: `Your registration was rejected. Reason: ${ngo.rejectionReason || 'No reason provided.'}`
      });
    }
    if (ngo.isBlocked) {
      return res.status(403).json({
        message: 'Your account has been blocked. Please contact the administrator.'
      });
    }


    const token = generateToken(ngo._id, 'ngo');

    res.json({
      message: 'Login successful',
      token,
      ngo: {
        id:   ngo._id,
        name: ngo.name,
        email: ngo.email,
        city: ngo.city,
        verificationStatus: ngo.verificationStatus,
        role: 'ngo'
      }
    });
  } catch (error) {
    console.error('NGO login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/ngo/directory
 * Public — search approved NGOs with optional ?keyword, ?city, ?focusArea filters
 */
router.get('/directory', async (req, res) => {
  try {
    const { keyword, city, focusArea } = req.query;
    const filter = { verificationStatus: 'approved', isBlocked: false };

    if (city)      filter.city = { $regex: city, $options: 'i' };
    if (focusArea) filter.focusAreas = focusArea;
    if (keyword) {
      filter.$or = [
        { name:    { $regex: keyword, $options: 'i' } },
        { bio:     { $regex: keyword, $options: 'i' } },
        { city:    { $regex: keyword, $options: 'i' } },
        { address: { $regex: keyword, $options: 'i' } }
      ];
    }

    const ngos = await NGO.find(filter)
      .select('-password -rejectionReason -officialDocument -cnic -focalPerson.cnic -resetPasswordToken -resetPasswordExpires -infoRequest')
      .sort({ createdAt: -1 });

    res.json({ ngos, count: ngos.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/ngo/directory/:id
 * Public — single approved NGO profile
 */
router.get('/directory/:id', async (req, res) => {
  try {
    const ngo = await NGO.findOne({
      _id: req.params.id,
      verificationStatus: 'approved',
      isBlocked: false
    }).select('-password -rejectionReason -officialDocument -cnic -focalPerson.cnic -resetPasswordToken -resetPasswordExpires -infoRequest');

    if (!ngo) return res.status(404).json({ message: 'NGO not found or not verified.' });

    res.json(ngo);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/ngo/request-aid/:id
 * Authenticated citizen submits a pro bono aid request (creates AidRequest, NOT a Case yet)
 * The NGO must explicitly accept it from their dashboard before a Case is created.
 */
router.post('/request-aid/:id', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const ngo = await NGO.findOne({
      _id: req.params.id,
      verificationStatus: 'approved',
      isBlocked: false,
      isAcceptingCases: true
    });
    if (!ngo) {
      return res.status(404).json({ message: 'NGO not found or not accepting cases.' });
    }

    const { title, description, category } = req.body;

    const aidRequest = new AidRequest({
      userId:      req.user.id,
      ngoId:       ngo._id,
      title,
      description,
      category,
      status:      'pending'
    });
    await aidRequest.save();

    // Notify NGO via Socket.io if available
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager) {
      await realTimeManager.notifyUser(ngo._id.toString(), 'NEW_AID_REQUEST', {
        message: `New pro bono aid request pending your review: "${title}"`,
        aidRequestId: aidRequest._id
      });
    }

    res.status(201).json({
      message: 'Your pro bono aid request has been submitted. The NGO will review and respond shortly.',
      aidRequest
    });
  } catch (error) {
    console.error('Aid request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/ngo/my-aid-requests
 * Citizen views their own AidRequests (pending/accepted/rejected) so they can track status
 */
router.get('/my-aid-requests', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const requests = await AidRequest.find({ userId: req.user.id })
      .populate('ngoId', 'name city verificationStatus')
      .sort({ createdAt: -1 });
    res.json({ requests, count: requests.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  PROTECTED — NGO PORTAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/ngo/profile
 */
router.get('/profile', ngoAuth, async (req, res) => {
  try {
    const ngo = await NGO.findById(req.user.id).select('-password');
    if (!ngo) return res.status(404).json({ message: 'NGO not found.' });
    res.json(ngo);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PUT /api/ngo/profile
 */
router.put('/profile', ngoAuth, async (req, res) => {
  try {
    const {
      bio, operatingHours, website, isAcceptingCases,
      focusAreas, servicesOffered,
      focalName, focalDesignation, focalCnic, focalPhone,
      phone, address, city, province
    } = req.body;

    const update = {
      bio, operatingHours, website, isAcceptingCases,
      phone, address, city, province,
      'focalPerson.name':        focalName,
      'focalPerson.designation': focalDesignation,
      'focalPerson.cnic':        focalCnic,
      'focalPerson.phone':       focalPhone
    };

    if (focusAreas)      update.focusAreas      = typeof focusAreas === 'string' ? JSON.parse(focusAreas) : focusAreas;
    if (servicesOffered) update.servicesOffered = typeof servicesOffered === 'string' ? JSON.parse(servicesOffered) : servicesOffered;

    // Remove undefined keys
    Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

    const ngo = await NGO.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
    res.json({ message: 'Profile updated successfully.', ngo });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/ngo/cases
 * Pro bono cases assigned to this NGO
 */
router.get('/cases', ngoAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { ngoId: req.user.id, caseType: 'pro_bono' };
    if (status) filter.status = status;

    const cases = await Case.find(filter)
      .populate('userId', 'name email phone cnic address')
      .populate('lawyerId', 'name email phone barCouncilId specialization photo rating')
      .sort({ createdAt: -1 });

    res.json({ cases, count: cases.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/ngo/aid-requests
 * NGO views incoming AidRequests (pending/accepted/rejected)
 */
router.get('/aid-requests', ngoAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { ngoId: req.user.id };
    if (status) filter.status = status;

    const requests = await AidRequest.find(filter)
      .populate('userId', 'name email phone cnic address')
      .sort({ createdAt: -1 });

    res.json({ requests, count: requests.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/ngo/aid-requests/:id/accept
 * NGO accepts an AidRequest → optionally assigns an active panel lawyer, creates a Case record
 */
router.post('/aid-requests/:id/accept', ngoAuth, async (req, res) => {
  try {
    const { lawyerId } = req.body;
    const aidReq = await AidRequest.findOne({ _id: req.params.id, ngoId: req.user.id, status: 'pending' });
    if (!aidReq) {
      return res.status(404).json({ message: 'Aid request not found or already processed.' });
    }

    let assignedLawyer = null;
    const assignments = [];

    if (lawyerId) {
      // Verify lawyer is an active member of this NGO's panel
      const currentNgo = await NGO.findById(req.user.id);
      const isMemberActive = currentNgo && Array.isArray(currentNgo.members) && currentNgo.members.some(
        m => m.lawyerId.toString() === lawyerId.toString() && m.status === 'active'
      );

      if (!isMemberActive) {
        return res.status(400).json({
          message: 'Selected advocate is not an active member of your panel roster. Only active panel members can be assigned cases.'
        });
      }

      assignedLawyer = await Lawyer.findById(lawyerId);
      if (!assignedLawyer) {
        return res.status(404).json({ message: 'Advocate profile not found.' });
      }

      assignments.push({
        lawyerId: assignedLawyer._id,
        lawyerName: assignedLawyer.name,
        barCouncilId: assignedLawyer.barCouncilId || 'N/A',
        assignedBy: req.user.id,
        assignedAt: new Date(),
        unassignedAt: null,
        reason: 'Initial Intake Assignment',
        isCurrent: true
      });
    }

    // Create the Case atomically
    const newCase = new Case({
      userId:   aidReq.userId,
      ngoId:    req.user.id,
      lawyerId: assignedLawyer ? assignedLawyer._id : null,
      caseType: 'pro_bono',
      title:    aidReq.title,
      description: aidReq.description,
      category:    aidReq.category,
      status:   assignedLawyer ? 'assigned' : 'under_review',
      assignments
    });
    await newCase.save();

    // Mark the AidRequest as accepted and link the Case
    aidReq.status = 'accepted';
    aidReq.caseId = newCase._id;
    await aidReq.save();

    // Increment NGO stats
    const ngo = await NGO.findByIdAndUpdate(req.user.id, { $inc: { totalCasesHandled: 1 } }, { new: true });

    // Notify citizen
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager) {
      const advocateNotice = assignedLawyer ? ` Assigned Counsel: Adv. ${assignedLawyer.name}.` : '';
      await realTimeManager.notifyUser(aidReq.userId.toString(), 'AID_REQUEST_ACCEPTED', {
        message: `Your pro bono aid request "${aidReq.title}" has been accepted by ${ngo?.name || 'NGO'}. A case docket has been opened.${advocateNotice}`,
        caseId: newCase._id
      });

      // If lawyer was assigned, push clear distinct notification to that lawyer
      if (assignedLawyer) {
        await realTimeManager.notifyUser(assignedLawyer._id.toString(), 'PRO_BONO_ASSIGNMENT', {
          message: `A new pro bono case "${aidReq.title}" has been assigned to you by ${ngo?.name || 'NGO'}.`,
          caseId: newCase._id,
          ngoId: req.user.id,
          ngoName: ngo?.name || 'NGO'
        });
      }
    }

    res.json({
      message: assignedLawyer
        ? `Aid request accepted and assigned to Adv. ${assignedLawyer.name}.`
        : 'Aid request accepted. Case created (Awaiting counsel assignment).',
      case: newCase,
      aidRequest: aidReq
    });
  } catch (error) {
    console.error('Accept aid request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/ngo/aid-requests/:id/reject
 * NGO rejects an AidRequest
 */
router.post('/aid-requests/:id/reject', ngoAuth, async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const aidReq = await AidRequest.findOne({ _id: req.params.id, ngoId: req.user.id, status: 'pending' });
    if (!aidReq) {
      return res.status(404).json({ message: 'Aid request not found or already processed.' });
    }

    aidReq.status = 'rejected';
    aidReq.rejectionReason = rejectionReason || '';
    await aidReq.save();

    // Notify citizen
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager) {
      await realTimeManager.notifyUser(aidReq.userId.toString(), 'AID_REQUEST_REJECTED', {
        message: `Your pro bono aid request "${aidReq.title}" was not accepted by the NGO.`,
        reason: rejectionReason || ''
      });
    }

    res.json({ message: 'Aid request rejected.', aidRequest: aidReq });
  } catch (error) {
    console.error('Reject aid request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/ngo/dashboard/stats
 */
router.get('/dashboard/stats', ngoAuth, async (req, res) => {
  try {
    const ngoId = req.user.id;
    const [total, active, resolved, pendingAidRequests] = await Promise.all([
      Case.countDocuments({ ngoId, caseType: 'pro_bono' }),
      Case.countDocuments({ ngoId, caseType: 'pro_bono', status: { $in: ['assigned', 'in_progress'] } }),
      Case.countDocuments({ ngoId, caseType: 'pro_bono', status: 'resolved' }),
      AidRequest.countDocuments({ ngoId, status: 'pending' })
    ]);

    const recentCases = await Case.find({ ngoId, caseType: 'pro_bono' })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentAidRequests = await AidRequest.find({ ngoId, status: 'pending' })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalCases: total,
      activeCases: active,
      resolvedCases: resolved,
      pendingRequests: pendingAidRequests,
      recentCases,
      recentAidRequests
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PUT /api/ngo/cases/:id/status
 */
router.put('/cases/:id/status', ngoAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['under_review', 'assigned', 'in_progress', 'resolved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const caseData = await Case.findOne({ _id: req.params.id, ngoId: req.user.id });
    if (!caseData) return res.status(404).json({ message: 'Case not found.' });

    const wasResolvedOrClosed = ['resolved', 'closed'].includes(caseData.status);
    caseData.status = status;
    if (status === 'resolved' || status === 'closed') {
      await NGO.findByIdAndUpdate(req.user.id, { $inc: { totalCasesHandled: 1 } });
    }
    await caseData.save();

    // Trigger proactive review prompt to citizen if transitioning to resolved or closed
    if (!wasResolvedOrClosed && ['resolved', 'closed'].includes(status)) {
      const realTimeManager = req.app.get('realTimeManager');
      triggerCaseResolvedReviewPrompt(caseData, realTimeManager);
    }

    res.json({ message: 'Case status updated.', case: caseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/ngo/cases/:id/hearing
 */
router.post('/cases/:id/hearing', ngoAuth, async (req, res) => {
  try {
    const { date, notes, outcome } = req.body;
    const caseData = await Case.findOne({ _id: req.params.id, ngoId: req.user.id });
    if (!caseData) return res.status(404).json({ message: 'Case not found.' });

    caseData.hearingDates.push({ date: new Date(date), notes: notes || '', outcome: outcome || '' });
    // Moving into court: an assigned case becomes in progress with its first hearing
    if (caseData.status === 'assigned') caseData.status = 'in_progress';
    caseData.updatedAt = Date.now();
    await caseData.save();

    res.json({ message: 'Hearing scheduled successfully.', case: caseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/ngo/cases/:id/message and /cases/:id/messages
 */
const handleNgoMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message content is required.' });
    }

    const caseData = await Case.findOne({ _id: req.params.id, ngoId: req.user.id });
    if (!caseData) return res.status(404).json({ message: 'Case not found.' });

    if (caseData.status === 'resolved' || caseData.status === 'closed') {
      return res.status(400).json({ message: 'This case docket has been resolved and archived. New messages cannot be sent.' });
    }

    const ngo = await NGO.findById(req.user.id);
    const newMsg = {
      senderId:   req.user.id,
      senderType: 'ngo',
      senderRoleLabel: `${ngo?.name || 'NGO'} • Legal Aid Case Officer`,
      message:    message.trim(),
      timestamp:  new Date()
    };

    caseData.messages.push(newMsg);
    caseData.updatedAt = Date.now();
    await caseData.save();

    // Real-time Socket.IO emission
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager && realTimeManager.io) {
      const payload = {
        caseId: caseData._id.toString(),
        message: newMsg
      };
      realTimeManager.io.to(`case:${caseData._id}`).emit('case-message', payload);
      realTimeManager.io.emit('case-message', payload);

      if (caseData.userId) {
        realTimeManager.notifyUser(caseData.userId.toString(), 'CASE_UPDATED', {
          caseId: caseData._id,
          message: `NGO representative sent instructions on case "${caseData.title}": ${newMsg.message.substring(0, 60)}...`,
          requiresRefresh: false
        });
      }
    }

    res.json({ message: 'Message sent.', case: caseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

router.post('/cases/:id/message', ngoAuth, handleNgoMessage);
router.post('/cases/:id/messages', ngoAuth, handleNgoMessage);

/**
 * POST /api/ngo/members/invite
 * Protected: NGO only
 * Look up lawyer by Bar Council ID or email.
 * Verifies verificationStatus: 'approved'.
 * Creates member entry with status 'pending_lawyer_approval' or reactivates existing.
 * Sends realtime notification + email.
 */
router.post('/members/invite', ngoAuth, async (req, res) => {
  try {
    const { identifier, designation, role } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ message: 'Bar Council ID or lawyer email is required.' });
    }

    const trimmed = identifier.trim();
    const lawyer = await Lawyer.findOne({
      $or: [
        { email: { $regex: `^${trimmed}$`, $options: 'i' } },
        { barCouncilId: { $regex: `^${trimmed}$`, $options: 'i' } }
      ]
    });

    if (!lawyer) {
      return res.status(404).json({ message: 'No registered lawyer found with this Bar Council ID or email.' });
    }

    if (lawyer.verificationStatus !== 'approved') {
      return res.status(400).json({
        message: `Lawyer "${lawyer.name}" cannot be invited because their credentials are not yet approved (Current status: ${lawyer.verificationStatus}).`
      });
    }

    const ngo = await NGO.findById(req.user.id);
    if (!ngo) {
      return res.status(404).json({ message: 'NGO organization not found.' });
    }

    if (!Array.isArray(ngo.members)) {
      ngo.members = [];
    }

    // Check existing membership in NGO.members
    let membership = ngo.members.find(
      m => m.lawyerId && m.lawyerId.toString() === lawyer._id.toString()
    );

    const chosenDesignation = (designation && designation.trim()) || 'Staff Advocate';
    const chosenRole = ['staff_advocate', 'panel_volunteer', 'lead_counsel'].includes(role) ? role : 'staff_advocate';

    if (membership) {
      if (membership.status === 'active') {
        return res.status(400).json({ message: `Adv. ${lawyer.name} is already an active member of your panel.` });
      }
      if (membership.status === 'pending_lawyer_approval') {
        return res.status(400).json({ message: `An invitation is already pending for Adv. ${lawyer.name}.` });
      }

      // If declined or inactive, re-invite
      membership.status = 'pending_lawyer_approval';
      membership.designation = chosenDesignation;
      membership.role = chosenRole;
      membership.invitedAt = new Date();
      membership.respondedAt = null;
      membership.leftAt = null;
      await ngo.save();
    } else {
      ngo.members.push({
        lawyerId: lawyer._id,
        designation: chosenDesignation,
        role: chosenRole,
        status: 'pending_lawyer_approval',
        invitedAt: new Date()
      });
      await ngo.save();
      membership = ngo.members[ngo.members.length - 1];
    }

    const membershipObj = {
      ...membership.toObject(),
      lawyerId: {
        _id: lawyer._id,
        name: lawyer.name,
        email: lawyer.email,
        phone: lawyer.phone,
        barCouncilId: lawyer.barCouncilId,
        specialization: lawyer.specialization,
        photo: lawyer.photo,
        rating: lawyer.rating
      }
    };

    // Realtime notification
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager) {
      await realTimeManager.notifyUser(lawyer._id.toString(), 'NGO_PANEL_INVITE', {
        message: `${ngo.name} has invited you to join their Legal Aid Panel as ${chosenDesignation}.`,
        ngoId: ngo._id,
        ngoName: ngo.name,
        membershipId: membership._id,
        designation: chosenDesignation
      });
    }

    // Email notification
    if (lawyer.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #0f3d2e;">Legal Aid Panel Invitation</h2>
          <p>Dear Adv. ${lawyer.name},</p>
          <p><strong>${ngo.name}</strong> has invited you to join their Pro Bono Legal Aid Panel as <strong>${chosenDesignation}</strong>.</p>
          <p>You can review and accept or decline this invitation directly from your LegalLink Lawyer Dashboard under <strong>Panel Invitations</strong>.</p>
          <br/>
          <p>Best regards,<br/>LegalLink Team</p>
        </div>
      `;
      sendMailSafe({
        to: lawyer.email,
        subject: `Legal Aid Panel Invitation: ${ngo.name}`,
        html: emailHtml
      }).catch(err => console.error('Error sending lawyer invite email:', err));
    }

    res.status(201).json({
      message: `Panel invitation sent to Adv. ${lawyer.name}. Awaiting their acceptance.`,
      membership: membershipObj
    });
  } catch (error) {
    console.error('Invite panel member error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/ngo/members
 * Protected: NGO only
 * Retrieves all lawyers affiliated with this NGO, populated with lawyer details.
 */
router.get('/members', ngoAuth, async (req, res) => {
  try {
    const ngo = await NGO.findById(req.user.id)
      .populate('members.lawyerId', 'name email phone barCouncilId specialization photo rating city experienceYears');

    const members = (ngo?.members || []).slice().reverse();

    res.json({ members, count: members.length });
  } catch (error) {
    console.error('Get NGO members error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PATCH /api/ngo/members/:id/status
 * Protected: NGO only
 * Allows NGO to toggle an active membership to inactive, or cancel a pending invitation.
 * Cannot force pending/declined to active unilaterally.
 */
router.patch('/members/:id/status', ngoAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (status === 'active') {
      return res.status(400).json({
        message: 'NGOs cannot unilaterally activate a membership. Lawyer acceptance is required.'
      });
    }

    const validStatuses = ['inactive', 'declined'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid target status. You can only set status to inactive.' });
    }

    const ngo = await NGO.findById(req.user.id);
    if (!ngo) {
      return res.status(404).json({ message: 'NGO not found.' });
    }

    const membership = ngo.members.id(req.params.id);
    if (!membership) {
      return res.status(404).json({ message: 'Panel membership record not found.' });
    }

    membership.status = 'inactive';
    membership.leftAt = new Date();
    await ngo.save();

    await ngo.populate('members.lawyerId', 'name email phone barCouncilId specialization photo rating');
    const updatedMembership = ngo.members.id(req.params.id);

    res.json({
      message: 'Panel member status updated to inactive.',
      membership: updatedMembership
    });
  } catch (error) {
    console.error('Update member status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PATCH /api/ngo/cases/:id/reassign
 * Protected: NGO only
 * Verifies req.user.id === case.ngoId explicitly.
 * Verifies new lawyer has active membership with this NGO.
 * Closes previous assignment (isCurrent: false, unassignedAt).
 * Appends new assignment record with custom reason.
 * Updates Case.lawyerId.
 * Notifies citizen, outgoing lawyer (if exists), and incoming lawyer.
 */
router.patch('/cases/:id/reassign', ngoAuth, async (req, res) => {
  try {
    const { lawyerId, reason } = req.body;
    if (!lawyerId) {
      return res.status(400).json({ message: 'New lawyer ID is required for reassignment.' });
    }

    const caseData = await Case.findById(req.params.id);
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found.' });
    }

    // Explicit authorization check: only the NGO that owns this specific case
    if (!caseData.ngoId || caseData.ngoId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Forbidden. You do not own this pro bono case.' });
    }

    // Check if new lawyer is an active member of this NGO's panel
    const ngo = await NGO.findById(req.user.id);
    const membership = ngo && Array.isArray(ngo.members) ? ngo.members.find(
      m => m.lawyerId && m.lawyerId.toString() === lawyerId.toString() && m.status === 'active'
    ) : null;

    if (!membership) {
      return res.status(400).json({
        message: 'The selected advocate is not an active member of your Legal Aid Panel.'
      });
    }

    const incomingLawyer = await Lawyer.findById(lawyerId).select('name barCouncilId email');
    if (!incomingLawyer) {
      return res.status(404).json({ message: 'Advocate profile not found.' });
    }
    const previousLawyerId = caseData.lawyerId ? caseData.lawyerId.toString() : null;

    if (previousLawyerId === incomingLawyer._id.toString()) {
      return res.status(400).json({ message: 'Advocate is already assigned to this case.' });
    }

    // Close any currently active assignments in assignments[]
    if (caseData.assignments && caseData.assignments.length > 0) {
      caseData.assignments.forEach(a => {
        if (a.isCurrent) {
          a.isCurrent = false;
          a.unassignedAt = new Date();
        }
      });
    } else {
      caseData.assignments = [];
    }

    // Append new assignment
    const reassignmentReason = (reason && reason.trim()) || 'Counsel Reassignment by NGO';
    caseData.assignments.push({
      lawyerId: incomingLawyer._id,
      lawyerName: incomingLawyer.name,
      barCouncilId: incomingLawyer.barCouncilId,
      assignedBy: req.user.id,
      assignedAt: new Date(),
      unassignedAt: null,
      reason: reassignmentReason,
      isCurrent: true
    });

    // Update case.lawyerId
    caseData.lawyerId = incomingLawyer._id;
    if (caseData.status === 'under_review' || caseData.status === 'pending') {
      caseData.status = 'assigned';
    }
    caseData.updatedAt = new Date();
    await caseData.save();

    const realTimeManager = req.app.get('realTimeManager');

    if (realTimeManager) {
      // 1. Notify Citizen
      if (caseData.userId) {
        await realTimeManager.notifyUser(caseData.userId.toString(), 'CASE_REASSIGNED', {
          message: `Legal aid counsel for your case "${caseData.title}" has been reassigned to Adv. ${incomingLawyer.name} (${membership.designation}). Reason: ${reassignmentReason}.`,
          caseId: caseData._id,
          newLawyerName: incomingLawyer.name
        });
      }

      // 2. Notify Outgoing Lawyer (if one was previously assigned)
      if (previousLawyerId) {
        await realTimeManager.notifyUser(previousLawyerId, 'PRO_BONO_UNASSIGNED', {
          message: `You have been relieved of counsel duties on pro bono case "${caseData.title}" by ${ngo?.name || 'NGO'}. Reason: ${reassignmentReason}.`,
          caseId: caseData._id
        });
      }

      // 3. Notify Incoming Lawyer
      await realTimeManager.notifyUser(incomingLawyer._id.toString(), 'PRO_BONO_ASSIGNMENT', {
        message: `A new pro bono case "${caseData.title}" has been assigned to you by ${ngo?.name || 'NGO'}.`,
        caseId: caseData._id,
        ngoId: req.user.id,
        ngoName: ngo?.name || 'NGO'
      });
    }

    await caseData.populate([
      { path: 'userId', select: 'name email phone' },
      { path: 'lawyerId', select: 'name email phone barCouncilId specialization photo rating' },
      { path: 'ngoId', select: 'name city focusAreas registrationNumber' }
    ]);

    res.json({
      message: `Case reassigned successfully to Adv. ${incomingLawyer.name}.`,
      case: caseData
    });
  } catch (error) {
    console.error('Reassign case error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
