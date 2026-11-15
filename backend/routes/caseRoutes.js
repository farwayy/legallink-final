const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Case = require('../models/Case');
const { authMiddleware } = require('../middleware/auth');
const { safeDocUrl } = require('../middleware/security');

const CASE_STATUSES = ['pending', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected'];

// Documents sent with a new case: keep only a name and a safe link
const cleanDocs = (docs) =>
  (Array.isArray(docs) ? docs : [])
    .slice(0, 10)
    .map((d) => ({ name: String((d && d.name) || 'Document').slice(0, 200), url: safeDocUrl(d && d.url) || '' }))
    .filter((d) => d.name);
const { triggerCaseResolvedReviewPrompt } = require('../services/reviewPromptService');
const { uploadCaseDoc, getUploadedFileUrl } = require('../services/cloudinaryService');

const router = express.Router();

// Helper to safely extract string ID from either ObjectId, raw string, or populated Mongoose document
const extractId = (entity) => {
  if (!entity) return null;
  if (entity._id) return entity._id.toString();
  return entity.toString();
};

// Create new case (User only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'Only users can create cases' });
    }
    
    const { title, description, category, priority, documents, caseType } = req.body;

    // An advocate or NGO is never set here: advocates are hired through an
    // accepted, paid inquiry, and NGOs accept aid requests themselves.
    const newCase = new Case({
      userId: req.user.id,
      lawyerId: null,
      ngoId: null,
      caseType: caseType === 'pro_bono' ? 'pro_bono' : 'paid',
      title,
      description,
      category,
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      documents: cleanDocs(documents)
    });
    
    await newCase.save();
    
    res.status(201).json({
      message: 'Case created successfully',
      case: newCase
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's cases
router.get('/my-cases', authMiddleware, async (req, res) => {
  try {
    let cases;
    if (req.user.role === 'user') {
      cases = await Case.find({ userId: req.user.id })
        .populate('lawyerId', 'name email specialization photo phone barCouncilId')
        .populate('ngoId', 'name email city phone focusAreas')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'lawyer') {
      cases = await Case.find({ lawyerId: req.user.id })
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'ngo') {
      cases = await Case.find({ ngoId: req.user.id })
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 });
    } else {
      return res.status(403).json({ message: 'Invalid role' });
    }
    
    res.json({ cases, count: cases.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get case stats for user
router.get('/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const totalCases = await Case.countDocuments({ userId: req.user.id });
    const activeCases = await Case.countDocuments({ 
      userId: req.user.id, 
      status: { $in: ['assigned', 'in_progress', 'under_review'] } 
    });
    const resolvedCases = await Case.countDocuments({ 
      userId: req.user.id, 
      status: 'resolved' 
    });
    const ngoCasesCount = await Case.countDocuments({
      userId: req.user.id,
      $or: [
        { caseType: 'pro_bono' },
        { ngoId: { $ne: null } }
      ]
    });
    const lawyerCasesCount = await Case.countDocuments({
      userId: req.user.id,
      lawyerId: { $ne: null }
    });

    const userCases = await Case.find({
      userId: req.user.id,
      'hearingDates.0': { $exists: true }
    });
    let upcomingHearingsCount = 0;
    const now = new Date();
    userCases.forEach(c => {
      if (c.hearingDates && Array.isArray(c.hearingDates)) {
        c.hearingDates.forEach(h => {
          if (new Date(h.date) >= now && h.status !== 'cancelled') {
            upcomingHearingsCount++;
          }
        });
      }
    });

    res.json({
      totalCases,
      activeCases,
      resolvedCases,
      ngoCasesCount,
      lawyerCasesCount,
      upcomingHearingsCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single case (Dedicated Case Details API)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const caseData = await Case.findById(req.params.id)
      .populate('userId', 'name email phone cnic address')
      .populate('lawyerId', 'name email specialization photo phone barCouncilId bio rating casesCompleted hourlyRate')
      .populate('ngoId', 'name email city phone focusAreas focalPerson registrationNumber address');
    
    if (!caseData) {
      return res.status(404).json({ message: 'Case file not found' });
    }
    
    // Strict Authorization check: client owner, assigned lawyer, panel advocate, assigned NGO, open pending pro bono preview, or admin
    const currentUserId = req.user.id?.toString();
    const caseUserId = extractId(caseData.userId);
    const caseLawyerId = extractId(caseData.lawyerId);
    const caseNgoId = extractId(caseData.ngoId);

    // Check if user is a panel advocate assigned via Case.assignments
    const isPanelLawyer = req.user.role === 'lawyer' && Array.isArray(caseData.assignments) && caseData.assignments.some(
      a => a.isCurrent && extractId(a.lawyerId) === currentUserId
    );

    // Allow verified NGOs & Lawyers to preview unassigned pending cases to review facts before claiming
    const isOpenPendingCase = (req.user.role === 'ngo' || req.user.role === 'lawyer') && 
      caseData.status === 'pending' && !caseData.ngoId && !caseData.lawyerId;

    const isAuthorized =
      (req.user.role === 'user' && caseUserId === currentUserId) ||
      (req.user.role === 'lawyer' && (caseLawyerId === currentUserId || isPanelLawyer || isOpenPendingCase)) ||
      (req.user.role === 'ngo' && (caseNgoId === currentUserId || isOpenPendingCase)) ||
      req.user.role === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Access denied: You are not authorized to view this legal docket.' });
    }
    
    const caseObj = caseData.toObject();
    // Normalize aliases so frontend can access either property seamlessly
    caseObj.hearings = caseObj.hearingDates || [];
    caseObj.caseAnalysis = caseObj.analysis || caseObj.caseAnalysis || '';

    res.json(caseObj);
  } catch (error) {
    console.error('Error fetching case:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark a section of the case as seen by the current person (clears unread counts)
// body: { section: 'messages' | 'documents' | 'hearings' }
router.post('/:id/seen', authMiddleware, async (req, res) => {
  try {
    const section = req.body?.section;
    if (!['messages', 'documents', 'hearings'].includes(section)) {
      return res.status(400).json({ message: 'Unknown section' });
    }

    const caseData = await Case.findById(req.params.id);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });

    const me = req.user.id?.toString();
    const isParty =
      extractId(caseData.userId) === me ||
      extractId(caseData.lawyerId) === me ||
      extractId(caseData.ngoId) === me ||
      (Array.isArray(caseData.assignments) && caseData.assignments.some((a) => a.isCurrent && extractId(a.lawyerId) === me)) ||
      req.user.role === 'admin';
    if (!isParty) return res.status(403).json({ message: 'Access denied' });

    const now = new Date();
    let marker = (caseData.seenBy || []).find((s) => s.userId?.toString() === me);
    if (!marker) {
      caseData.seenBy.push({ userId: me, role: req.user.role, [section]: now });
    } else {
      marker[section] = now;
    }
    await caseData.save();

    res.json({ ok: true, section, seenAt: now });
  } catch (error) {
    console.error('Error marking case section seen:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update case status (Lawyer, NGO, or Admin)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!CASE_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Choose a valid case status.' });
    }
    const caseData = await Case.findById(req.params.id);
    
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found' });
    }
    
    const currentUserId = req.user.id?.toString();
    const caseLawyerId = extractId(caseData.lawyerId);
    const caseNgoId = extractId(caseData.ngoId);
    const isPanelLawyer = req.user.role === 'lawyer' && Array.isArray(caseData.assignments) && caseData.assignments.some(
      a => a.isCurrent && extractId(a.lawyerId) === currentUserId
    );

    const isAssignedLawyer = req.user.role === 'lawyer' && (caseLawyerId === currentUserId || isPanelLawyer);
    const isAssignedNgo = req.user.role === 'ngo' && (caseNgoId === currentUserId);
    const isAdmin = req.user.role === 'admin';

    if (!isAssignedLawyer && !isAssignedNgo && !isAdmin) {
      return res.status(403).json({ message: 'Access denied: You cannot alter this case status.' });
    }
    
    const wasResolvedOrClosed = ['resolved', 'closed'].includes(caseData.status);
    caseData.status = status;
    caseData.updatedAt = Date.now();
    await caseData.save();

    // Trigger proactive review prompt to citizen if transitioning to resolved or closed
    if (!wasResolvedOrClosed && ['resolved', 'closed'].includes(status)) {
      const realTimeManager = req.app.get('realTimeManager');
      triggerCaseResolvedReviewPrompt(caseData, realTimeManager);
    }

    // Real-time update notification
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager && realTimeManager.io) {
      realTimeManager.io.to(`case:${caseData._id}`).emit('case-status-updated', {
        caseId: caseData._id.toString(),
        status,
        notes
      });
      if (caseData.userId) {
        realTimeManager.notifyUser(caseData.userId.toString(), 'CASE_UPDATED', {
          caseId: caseData._id,
          message: `Case "${caseData.title}" status changed to ${status.replace('_', ' ').toUpperCase()}`,
          requiresRefresh: false
        });
      }
    }
    
    res.json({ message: 'Case status updated successfully', case: caseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add court hearing proceedings (Lawyer, NGO, or Admin)
router.post('/:id/hearing', authMiddleware, async (req, res) => {
  try {
    const { date, notes, outcome, status: hearingStatus } = req.body;
    if (!date) {
      return res.status(400).json({ message: 'Hearing date is required' });
    }

    const caseData = await Case.findById(req.params.id);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });

    const currentUserId = req.user.id?.toString();
    const caseLawyerId = extractId(caseData.lawyerId);
    const caseNgoId = extractId(caseData.ngoId);
    const isPanelLawyer = req.user.role === 'lawyer' && Array.isArray(caseData.assignments) && caseData.assignments.some(
      a => a.isCurrent && extractId(a.lawyerId) === currentUserId
    );

    const isAssignedLawyer = req.user.role === 'lawyer' && (caseLawyerId === currentUserId || isPanelLawyer);
    const isAssignedNgo = req.user.role === 'ngo' && (caseNgoId === currentUserId);
    const isAdmin = req.user.role === 'admin';

    if (!isAssignedLawyer && !isAssignedNgo && !isAdmin) {
      return res.status(403).json({ message: 'Only assigned legal counsel can schedule courtroom proceedings.' });
    }

    if (caseData.status === 'resolved' || caseData.status === 'closed') {
      return res.status(400).json({ message: 'Cannot schedule hearings on a resolved or closed case docket.' });
    }

    const newHearing = {
      date: new Date(date),
      notes: notes || '',
      outcome: outcome || '',
      status: hearingStatus || 'scheduled'
    };

    caseData.hearingDates.push(newHearing);
    // Moving into court: an assigned case becomes in progress with its first hearing
    if (caseData.status === 'assigned') caseData.status = 'in_progress';
    caseData.updatedAt = Date.now();
    await caseData.save();

    // Real-time update notification
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager && realTimeManager.io) {
      realTimeManager.io.to(`case:${caseData._id}`).emit('case-hearing-added', {
        caseId: caseData._id.toString(),
        hearing: newHearing
      });
      const userNotificationId = extractId(caseData.userId);
      if (userNotificationId) {
        realTimeManager.notifyUser(userNotificationId, 'CASE_UPDATED', {
          caseId: caseData._id,
          message: `New court hearing scheduled for case "${caseData.title}" on ${new Date(date).toLocaleDateString()}`,
          requiresRefresh: false
        });
      }
    }

    res.json({ message: 'Hearing proceedings scheduled successfully', case: caseData, hearing: newHearing });
  } catch (error) {
    console.error('Error adding hearing:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update court hearing proceedings (Lawyer, NGO, or Admin)
router.patch('/:id/hearing/:hearingId', authMiddleware, async (req, res) => {
  try {
    const { date, notes, outcome, status: hearingStatus } = req.body;
    const caseData = await Case.findById(req.params.id);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });

    const currentUserId = req.user.id?.toString();
    const caseLawyerId = extractId(caseData.lawyerId);
    const caseNgoId = extractId(caseData.ngoId);
    const isPanelLawyer = req.user.role === 'lawyer' && Array.isArray(caseData.assignments) && caseData.assignments.some(
      a => a.isCurrent && extractId(a.lawyerId) === currentUserId
    );

    const isAssignedLawyer = req.user.role === 'lawyer' && (caseLawyerId === currentUserId || isPanelLawyer);
    const isAssignedNgo = req.user.role === 'ngo' && (caseNgoId === currentUserId);
    const isAdmin = req.user.role === 'admin';

    if (!isAssignedLawyer && !isAssignedNgo && !isAdmin) {
      return res.status(403).json({ message: 'Only assigned legal counsel or administrator can update courtroom proceedings.' });
    }

    const hearing = caseData.hearingDates.id(req.params.hearingId) ||
      caseData.hearingDates.find(h => h._id.toString() === req.params.hearingId);

    if (!hearing) {
      return res.status(404).json({ message: 'Hearing record not found in docket.' });
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

    // Real-time update notification
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager && realTimeManager.io) {
      realTimeManager.io.to(`case:${caseData._id}`).emit('case-hearing-updated', {
        caseId: caseData._id.toString(),
        hearingId: req.params.hearingId,
        hearing: hearing
      });
      const userNotificationId = extractId(caseData.userId);
      if (userNotificationId) {
        realTimeManager.notifyUser(userNotificationId, 'CASE_UPDATED', {
          caseId: caseData._id,
          message: `Court hearing proceedings updated for case "${caseData.title}" (${hearing.status || 'scheduled'})`,
          requiresRefresh: false
        });
      }
    }

    res.json({ message: 'Hearing proceedings updated successfully', case: caseData, hearing });
  } catch (error) {
    console.error('Error updating hearing:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update legal strategy & case analysis (Lawyer, NGO, or Admin)
router.patch('/:id/analysis', authMiddleware, async (req, res) => {
  try {
    const { analysis } = req.body;
    const caseData = await Case.findById(req.params.id);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });

    const currentUserId = req.user.id?.toString();
    const caseLawyerId = extractId(caseData.lawyerId);
    const caseNgoId = extractId(caseData.ngoId);
    const isPanelLawyer = req.user.role === 'lawyer' && Array.isArray(caseData.assignments) && caseData.assignments.some(
      a => a.isCurrent && extractId(a.lawyerId) === currentUserId
    );

    const isAssignedLawyer = req.user.role === 'lawyer' && (caseLawyerId === currentUserId || isPanelLawyer);
    const isAssignedNgo = req.user.role === 'ngo' && (caseNgoId === currentUserId);
    const isAdmin = req.user.role === 'admin';

    if (!isAssignedLawyer && !isAssignedNgo && !isAdmin) {
      return res.status(403).json({ message: 'Only assigned legal counsel can update case strategy.' });
    }

    caseData.analysis = analysis || '';
    caseData.caseAnalysis = analysis || '';
    caseData.updatedAt = Date.now();
    await caseData.save();

    res.json({ message: 'Legal analysis updated successfully', case: caseData });
  } catch (error) {
    console.error('Error updating analysis:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Attach evidence document to case (Citizen, Lawyer, NGO, or Admin)
router.post('/:id/documents', authMiddleware, uploadCaseDoc.single('file'), async (req, res) => {
  try {
    const caseData = await Case.findById(req.params.id);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });

    const currentUserId = req.user.id?.toString();
    const caseUserId = extractId(caseData.userId);
    const caseLawyerId = extractId(caseData.lawyerId);
    const caseNgoId = extractId(caseData.ngoId);
    const isPanelLawyer = req.user.role === 'lawyer' && Array.isArray(caseData.assignments) && caseData.assignments.some(
      a => a.isCurrent && extractId(a.lawyerId) === currentUserId
    );

    const isOwner = req.user.role === 'user' && (caseUserId === currentUserId);
    const isAssignedLawyer = req.user.role === 'lawyer' && (caseLawyerId === currentUserId || isPanelLawyer);
    const isAssignedNgo = req.user.role === 'ngo' && (caseNgoId === currentUserId);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAssignedLawyer && !isAssignedNgo && !isAdmin) {
      return res.status(403).json({ message: 'Access denied: You cannot upload evidence to this docket.' });
    }

    if (caseData.status === 'resolved' || caseData.status === 'closed') {
      return res.status(400).json({ message: 'This case docket has been resolved and archived. New evidence cannot be attached.' });
    }

    let docName = req.body.name || (req.file ? req.file.originalname : 'Evidence Document');
    let docUrl = req.body.url;
    let fileSizeStr = '';

    if (req.file) {
      const fileUrl = getUploadedFileUrl(req.file);
      // Local files are stored as /uploads/<name> so the link works on any server address
      docUrl = fileUrl.startsWith('http') ? fileUrl : `/uploads/${req.file.filename}`;
      const bytes = req.file.size || req.file.bytes || 0;
      fileSizeStr = bytes > 1024 * 1024
        ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(bytes / 1024)} KB`;
    } else if (!docUrl) {
      return res.status(400).json({ message: 'Either a file upload or a valid document URL is required' });
    } else {
      docUrl = safeDocUrl(docUrl);
      if (!docUrl) {
        return res.status(400).json({ message: 'Document links must start with https://' });
      }
    }

    let uploaderRoleName = 'Client';
    if (req.user.role === 'lawyer') uploaderRoleName = 'Assigned Advocate';
    else if (req.user.role === 'ngo') uploaderRoleName = 'NGO Legal Representative';
    else if (req.user.role === 'admin') uploaderRoleName = 'Administrator';

    const newDoc = {
      name: docName,
      url: docUrl,
      fileSize: fileSizeStr || req.body.fileSize || 'Attached',
      uploadedBy: uploaderRoleName,
      uploadedByType: req.user.role,
      uploadedAt: new Date()
    };

    caseData.documents.push(newDoc);
    caseData.updatedAt = Date.now();
    await caseData.save();

    // Real-time update notification
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager && realTimeManager.io) {
      realTimeManager.io.to(`case:${caseData._id}`).emit('case-document-added', {
        caseId: caseData._id.toString(),
        document: newDoc
      });
      const recipientId = req.user.role === 'user'
        ? (caseLawyerId || caseNgoId)
        : caseUserId;
      if (recipientId) {
        realTimeManager.notifyUser(recipientId, 'CASE_UPDATED', {
          caseId: caseData._id,
          message: `${uploaderRoleName} uploaded evidence "${docName}" to case "${caseData.title}"`,
          requiresRefresh: false
        });
      }
    }

    res.json({ message: 'Evidence document securely attached', case: caseData, document: newDoc });
  } catch (error) {
    console.error('Error attaching evidence document:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add message to case
router.post('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const caseData = await Case.findById(req.params.id);
    
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found' });
    }

    const currentUserId = req.user.id?.toString();
    const caseUserId = extractId(caseData.userId);
    const caseLawyerId = extractId(caseData.lawyerId);
    const caseNgoId = extractId(caseData.ngoId);
    const isPanelLawyer = req.user.role === 'lawyer' && Array.isArray(caseData.assignments) && caseData.assignments.some(
      a => a.isCurrent && extractId(a.lawyerId) === currentUserId
    );

    // Check authorization
    if (req.user.role === 'user' && caseUserId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'lawyer' && caseLawyerId !== currentUserId && !isPanelLawyer) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'ngo' && caseNgoId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (caseData.status === 'resolved' || caseData.status === 'closed') {
      return res.status(400).json({ message: 'This case docket has been resolved and archived. New messages cannot be appended.' });
    }
    
    let senderRoleLabel = '';
    if (req.user.role === 'ngo') {
      const NGO = require('../models/NGO');
      const ngo = await NGO.findById(req.user.id);
      senderRoleLabel = `${ngo?.name || 'NGO'} • Legal Aid Case Officer`;
    } else if (req.user.role === 'lawyer' && (caseData.caseType === 'pro_bono' || caseData.ngoId)) {
      const NGO = require('../models/NGO');
      const Lawyer = require('../models/Lawyer');
      const ngo = await NGO.findById(caseData.ngoId);
      const l = await Lawyer.findById(req.user.id);
      const advName = l?.name || 'Legal Aid Counsel';
      const formattedAdv = advName.startsWith('Adv') ? advName : `Adv. ${advName}`;
      senderRoleLabel = `${formattedAdv} • Panel Counsel (${ngo?.name || 'Legal Aid NGO'})`;
    } else if (req.user.role === 'lawyer') {
      const Lawyer = require('../models/Lawyer');
      const l = await Lawyer.findById(req.user.id);
      const lawyerName = l?.name || 'Counsel';
      const formattedLawyer = lawyerName.startsWith('Adv') ? lawyerName : `Adv. ${lawyerName}`;
      senderRoleLabel = `${formattedLawyer} • Retainer Counsel`;
    } else if (req.user.role === 'user') {
      const User = require('../models/User');
      const u = await User.findById(req.user.id);
      senderRoleLabel = `${u?.name || 'Client'} • Petitioner / Client`;
    } else if (req.user.role === 'admin') {
      senderRoleLabel = 'Judicial Registrar • Platform Administrator';
    }

    const newMsg = {
      senderId: req.user.id,
      senderType: req.user.role,
      senderRoleLabel,
      message: message.trim(),
      timestamp: new Date()
    };

    caseData.messages.push(newMsg);
    caseData.updatedAt = Date.now();
    await caseData.save();

    // Real-time Socket.IO event emission
    const realTimeManager = req.app.get('realTimeManager');
    if (realTimeManager && realTimeManager.io) {
      const payload = {
        caseId: caseData._id.toString(),
        message: newMsg
      };

      // Broadcast to specific case room as well as global case-message channel
      realTimeManager.io.to(`case:${caseData._id}`).emit('case-message', payload);
      realTimeManager.io.emit('case-message', payload);

      // In-app notification to the counterpart recipient
      const recipientId = req.user.role === 'user'
        ? (caseLawyerId || caseNgoId)
        : caseUserId;

      if (recipientId) {
        realTimeManager.notifyUser(recipientId, 'CASE_UPDATED', {
          caseId: caseData._id,
          message: `New message on case "${caseData.title}": ${newMsg.message.substring(0, 60)}...`,
          requiresRefresh: false
        });
      }
    }
    
    res.json({ message: 'Message added', case: caseData });
  } catch (error) {
    console.error('Error adding case message:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;