const express = require('express');
const Lawyer = require('../models/Lawyer');
const Case = require('../models/Case');
const User = require('../models/User');
const NGO = require('../models/NGO');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { triggerCaseResolvedReviewPrompt } = require('../services/reviewPromptService');

const router = express.Router();

// ============ PROFILE ROUTES ============

// Get lawyer profile
router.get('/profile', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const lawyer = await Lawyer.findById(req.user.id).select('-password');
    if (!lawyer) {
      return res.status(404).json({ message: 'Lawyer not found' });
    }
    res.json(lawyer);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update lawyer profile
router.put('/profile', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const { name, phone, location, officeAddress, languages, bio, specialization, experience, profilePicture } = req.body;
    const lawyer = await Lawyer.findByIdAndUpdate(
      req.user.id,
      { name, phone, location, officeAddress, languages, bio, specialization, experience, profilePicture },
      { new: true }
    ).select('-password');
    
    res.json({ message: 'Profile updated successfully', lawyer });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ CASE ROUTES ============

// Get lawyer's assigned cases
router.get('/cases', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    console.log("Fetching cases for lawyer:", req.user.id);
    
    const cases = await Case.find({ lawyerId: req.user.id })
      .populate('userId', 'name email phone cnic')
      .populate('ngoId', 'name city focusAreas registrationNumber')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${cases.length} cases`);
    
    res.json({ cases, count: cases.length });
  } catch (error) {
    console.error('Error fetching lawyer cases:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/test', (req, res) => {
  res.json({ message: 'Lawyer routes are working!' });
});

// Get pending cases available for lawyers to accept
router.get('/cases/pending/available', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const lawyer = await Lawyer.findById(req.user.id);
    const pendingCases = await Case.find({
      status: 'pending',
      lawyerId: null,
      category: { $in: lawyer.specialization }
    }).populate('userId', 'name email phone');
    
    res.json({ cases: pendingCases, count: pendingCases.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Accept a case — atomic to prevent race conditions (two lawyers claiming same case)
router.post('/cases/:id/accept', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    // Atomically claim the case: only succeeds if status is still 'pending' and unassigned
    const caseData = await Case.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'pending',
        lawyerId: null
      },
      {
        $set: {
          lawyerId: req.user.id,
          status:   'assigned'
        }
      },
      { new: true }
    );

    if (!caseData) {
      // Either case doesn't exist, or it was already claimed by another lawyer
      return res.status(409).json({ message: 'Case is no longer available or was already claimed.' });
    }

    // Update lawyer's total cases count
    await Lawyer.findByIdAndUpdate(req.user.id, { $inc: { totalCases: 1 } });

    res.json({ message: 'Case accepted successfully', case: caseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Get single case
router.get('/cases/:id', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const caseData = await Case.findOne({
      _id: req.params.id,
      lawyerId: req.user.id
    })
      .populate('userId', 'name email phone address cnic')
      .populate('ngoId', 'name city focusAreas registrationNumber');
    
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found or not assigned to you' });
    }
    
    res.json(caseData);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update case status
router.patch('/cases/:id/status', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const caseData = await Case.findOne({
      _id: req.params.id,
      lawyerId: req.user.id
    });
    
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found or not assigned to you' });
    }
    
    const wasResolvedOrClosed = ['resolved', 'closed'].includes(caseData.status);
    caseData.status = status;
    
    // Add hearing date if status is in_progress and notes provided
    if (status === 'in_progress' && notes) {
      caseData.hearingDates.push({
        date: new Date(),
        notes: notes,
        status: 'scheduled'
      });
    }
    
    await caseData.save();

    // Trigger proactive review prompt to citizen if transitioning to resolved or closed
    if (!wasResolvedOrClosed && ['resolved', 'closed'].includes(status)) {
      const realTimeManager = req.app.get('realTimeManager');
      triggerCaseResolvedReviewPrompt(caseData, realTimeManager);
    }
    
    res.json({ message: 'Case status updated successfully', case: caseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add message to case (chat)
router.post('/cases/:id/messages', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const caseData = await Case.findOne({
      _id: req.params.id,
      lawyerId: req.user.id
    });
    
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found or not assigned to you' });
    }
    
    const newMsg = {
      senderId: req.user.id,
      senderType: 'lawyer',
      message: message.trim(),
      timestamp: new Date()
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
          message: `Advocate replied to case "${caseData.title}": ${newMsg.message.substring(0, 60)}...`,
          requiresRefresh: false
        });
      }
    }
    
    res.json({ message: 'Message sent successfully', case: caseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/cases/:id/hearing', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const { date, notes, outcome } = req.body;
    const caseData = await Case.findOne({ _id: req.params.id, lawyerId: req.user.id });
    
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    
    caseData.hearingDates.push({ date: new Date(date), notes, outcome });
    if (caseData.status === 'assigned') caseData.status = 'in_progress';
    caseData.updatedAt = Date.now();
    await caseData.save();
    
    res.json({ message: 'Hearing added successfully', case: caseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/cases/:id/hearing/:hearingId', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const { date, notes, outcome, status: hearingStatus } = req.body;
    const caseData = await Case.findOne({ _id: req.params.id, lawyerId: req.user.id });
    
    if (!caseData) return res.status(404).json({ message: 'Case not found' });

    const hearing = caseData.hearingDates.id(req.params.hearingId) ||
      caseData.hearingDates.find(h => h._id.toString() === req.params.hearingId);

    if (!hearing) {
      return res.status(404).json({ message: 'Hearing record not found' });
    }

    if (date) hearing.date = new Date(date);
    if (notes !== undefined) hearing.notes = notes;
    if (outcome !== undefined) hearing.outcome = outcome;
    if (hearingStatus !== undefined) {
      const validStatuses = ['scheduled', 'completed', 'concluded', 'adjourned', 'cancelled'];
      if (validStatuses.includes(hearingStatus)) {
        hearing.status = hearingStatus;
      }
    }

    caseData.updatedAt = Date.now();
    await caseData.save();

    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager && realTimeManager.io) {
      realTimeManager.io.to(`case:${caseData._id}`).emit('case-hearing-updated', {
        caseId: caseData._id.toString(),
        hearingId: req.params.hearingId,
        hearing
      });
      const userNotificationId = caseData.userId?.toString();
      if (userNotificationId) {
        realTimeManager.notifyUser(userNotificationId, 'CASE_UPDATED', {
          caseId: caseData._id,
          message: `Court hearing proceedings updated for case "${caseData.title}" (${hearing.status || 'scheduled'})`,
          requiresRefresh: false
        });
      }
    }

    res.json({ message: 'Hearing updated successfully', case: caseData, hearing });
  } catch (error) {
    console.error('Error updating lawyer hearing:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update case analysis
router.patch('/cases/:id/analysis', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const { analysis } = req.body;
    const caseData = await Case.findOne({ _id: req.params.id, lawyerId: req.user.id });
    
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    
    caseData.analysis = analysis;
    caseData.updatedAt = Date.now();
    await caseData.save();
    
    res.json({ message: 'Analysis updated', case: caseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ DASHBOARD STATS ============

// Get dashboard stats for lawyer
router.get('/dashboard/stats', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const totalCases = await Case.countDocuments({ lawyerId: req.user.id });
    const activeCases = await Case.countDocuments({ 
      lawyerId: req.user.id, 
      status: { $in: ['assigned', 'in_progress'] } 
    });
    const resolvedCases = await Case.countDocuments({ 
      lawyerId: req.user.id, 
      status: 'resolved' 
    });
    const pendingRequests = await Case.countDocuments({ 
      status: 'pending',
      category: { $in: (await Lawyer.findById(req.user.id)).specialization }
    });
    
    const lawyer = await Lawyer.findById(req.user.id).select('verificationStatus rating totalCases');
    
    // Get recent cases
    const recentCases = await Case.find({ lawyerId: req.user.id })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.json({
      totalCases,
      activeCases,
      resolvedCases,
      pendingRequests,
      verificationStatus: lawyer.verificationStatus,
      rating: lawyer.rating,
      totalCasesCompleted: lawyer.totalCases,
      recentCases
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ EARNINGS/STATS ============

// Get lawyer's case statistics by category
router.get('/stats/categories', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const casesByCategory = await Case.aggregate([
      { $match: { lawyerId: req.user.id } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    res.json({ categories: casesByCategory });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ PANEL INVITATION ROUTES ============

// Get lawyer's NGO panel invitations (pending and history)
router.get('/panel-invitations', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const ngos = await NGO.find({ 'members.lawyerId': req.user.id })
      .select('name email phone city focusAreas registrationNumber members')
      .lean();

    const invitations = [];
    ngos.forEach(ngo => {
      if (Array.isArray(ngo.members)) {
        const matching = ngo.members.filter(m => m.lawyerId && m.lawyerId.toString() === req.user.id.toString());
        matching.forEach(m => {
          invitations.push({
            _id: m._id,
            ngoId: {
              _id: ngo._id,
              name: ngo.name,
              email: ngo.email,
              phone: ngo.phone,
              city: ngo.city,
              focusAreas: ngo.focusAreas,
              registrationNumber: ngo.registrationNumber
            },
            designation: m.designation,
            role: m.role,
            status: m.status,
            invitedAt: m.invitedAt,
            respondedAt: m.respondedAt,
            leftAt: m.leftAt,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt
          });
        });
      }
    });

    invitations.sort((a, b) => new Date(b.invitedAt) - new Date(a.invitedAt));
    const pendingCount = invitations.filter(inv => inv.status === 'pending_lawyer_approval').length;

    res.json({ invitations, pendingCount });
  } catch (error) {
    console.error('Error fetching panel invitations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Respond to an NGO panel invitation (accept or decline)
router.post('/panel-invitations/:membershipId/respond', authMiddleware, requireRole(['lawyer']), async (req, res) => {
  try {
    const { action } = req.body;
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ message: 'Action must be "accept" or "decline".' });
    }

    const ngo = await NGO.findOne({ 'members._id': req.params.membershipId });
    if (!ngo) {
      return res.status(404).json({ message: 'Panel invitation not found.' });
    }

    const membership = ngo.members.id(req.params.membershipId);
    if (!membership) {
      return res.status(404).json({ message: 'Panel invitation not found.' });
    }

    // Verify ownership
    if (membership.lawyerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Forbidden: You cannot respond to another lawyer\'s invitation.' });
    }

    if (membership.status !== 'pending_lawyer_approval') {
      return res.status(400).json({
        message: `This invitation has already been ${membership.status === 'active' ? 'accepted' : membership.status}.`
      });
    }

    const newStatus = action === 'accept' ? 'active' : 'declined';
    membership.status = newStatus;
    membership.respondedAt = new Date();
    await ngo.save();

    const lawyer = await Lawyer.findById(req.user.id).select('name email barCouncilId specialization');
    const membershipObj = {
      ...membership.toObject(),
      ngoId: {
        _id: ngo._id,
        name: ngo.name,
        email: ngo.email,
        phone: ngo.phone,
        city: ngo.city,
        focusAreas: ngo.focusAreas
      },
      lawyerId: lawyer
    };

    // Notify NGO
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager) {
      const lawyerName = lawyer?.name || 'Advocate';
      const actionText = action === 'accept' ? 'accepted' : 'declined';
      await realTimeManager.notifyUser(ngo._id.toString(), 'NGO_PANEL_RESPONSE', {
        message: `Adv. ${lawyerName} has ${actionText} your invitation to join the Legal Aid Panel as ${membership.designation}.`,
        membershipId: membership._id,
        action: newStatus,
        lawyerName
      });
    }

    res.json({
      message: `You have successfully ${action === 'accept' ? 'accepted' : 'declined'} the panel invitation.`,
      membership: membershipObj
    });
  } catch (error) {
    console.error('Error responding to panel invitation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;