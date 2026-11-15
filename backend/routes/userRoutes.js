const express = require('express');
const User = require('../models/User');
const Lawyer = require('../models/Lawyer');
const Case = require('../models/Case');
const Review = require('../models/Review');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { safeDocUrl } = require('../middleware/security');
const { uploadAvatar, getUploadedFileUrl, deleteFromCloudinary } = require('../services/cloudinaryService');

const router = express.Router();

// ============ PROFILE ROUTES ============

// Get user profile
router.get('/profile', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
router.put('/profile', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, address },
      { new: true }
    ).select('-password');
    
    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Upload profile photo (Cloudinary with local uploads fallback)
router.post('/upload-photo', authMiddleware, requireRole(['user']), uploadAvatar.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const photoUrl = getUploadedFileUrl(req.file);
    const prevUser = await User.findById(req.user.id);
    if (prevUser && prevUser.photo && prevUser.photo.startsWith('http')) {
      deleteFromCloudinary(prevUser.photo).catch(() => {});
    }

    await User.findByIdAndUpdate(req.user.id, { photo: photoUrl });
    
    res.json({ success: true, photoUrl });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============ LAWYER LISTING ROUTES ============

// Get all verified lawyers (public listing)
router.get('/lawyers', async (req, res) => {
  try {
    const { specialization, location } = req.query;
    const filter = { 
      verificationStatus: 'approved',  // ONLY approved lawyers
      isBlocked: false                  // NOT blocked
    };
    
    if (specialization) {
      filter.specialization = { $in: [specialization] };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }
    
    const lawyers = await Lawyer.find(filter)
      .select('name specialization experience location rating photo bio phone email barCouncilId totalReviews totalCases')
      .sort({ rating: -1 });

    // Populate real review count and average rating directly from the Review collection
    const lawyersWithReviews = await Promise.all(
      lawyers.map(async (lawyer) => {
        const lObj = lawyer.toObject();
        try {
          const reviews = await Review.find({ lawyerId: lawyer._id, isFlagged: false });
          if (reviews.length > 0) {
            const avgRating = reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length;
            lObj.rating = Number(avgRating.toFixed(1));
            lObj.totalReviews = reviews.length;
          } else {
            lObj.totalReviews = lawyer.totalReviews || 0;
            lObj.rating = Number((lawyer.rating || 5.0).toFixed(1));
          }
        } catch (revErr) {
          lObj.totalReviews = lawyer.totalReviews || 0;
        }
        return lObj;
      })
    );
    
    console.log(`📋 Found ${lawyersWithReviews.length} approved lawyers with real DB review counts`); // Debug log
    
    res.json({ lawyers: lawyersWithReviews, count: lawyersWithReviews.length });
  } catch (error) {
    console.error('Error fetching lawyers:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single lawyer details
router.get('/lawyers/:id', async (req, res) => {
  try {
    const lawyer = await Lawyer.findById(req.params.id)
      .select('-password -documents -isBlocked -officialDocument -cnic -resetPasswordToken -resetPasswordExpires -rejectionReason -infoRequest');
    
    if (!lawyer) {
      return res.status(404).json({ message: 'Lawyer not found' });
    }
    
    if (lawyer.verificationStatus !== 'approved') {
      return res.status(403).json({ message: 'Lawyer not verified yet' });
    }
    
    // Get lawyer's completed cases count and real DB reviews
    const completedCases = await Case.countDocuments({ 
      lawyerId: lawyer._id, 
      status: 'resolved' 
    });

    const reviews = await Review.find({ lawyerId: lawyer._id, isFlagged: false });
    const totalReviews = reviews.length > 0 ? reviews.length : (lawyer.totalReviews || 0);
    const avgRating = reviews.length > 0
      ? Number((reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length).toFixed(1))
      : Number((lawyer.rating || 5.0).toFixed(1));
    
    res.json({ ...lawyer.toObject(), completedCases, totalReviews, rating: avgRating });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get lawyer reviews/ratings
router.get('/lawyers/:id/reviews', async (req, res) => {
  try {
    const cases = await Case.find({ 
      lawyerId: req.params.id, 
      status: 'resolved' 
    }).select('rating review userId');
    
    res.json({ reviews: cases, count: cases.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ CASE ROUTES ============



// Create new case
router.post('/cases', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const { title, description, category, priority, caseType, documents } = req.body;

    // An advocate or NGO is never set here: advocates are hired through an
    // accepted, paid inquiry, and NGOs accept aid requests themselves.
    const newCase = new Case({
      userId: req.user.id,
      lawyerId: null,
      ngoId: null,
      caseType: caseType === 'pro_bono' ? 'pro_bono' : 'paid',
      title,
      description,
      category: category || 'general',
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      packageType: null,
      status: 'pending',
      documents: (Array.isArray(documents) ? documents : [])
        .slice(0, 10)
        .map((d) => ({ name: String((d && d.name) || 'Document').slice(0, 200), url: safeDocUrl(d && d.url) || '' }))
    });

    await newCase.save();
    
    res.status(201).json({
      success: true,
      message: 'Case created successfully',
      case: newCase
    });
  } catch (error) {
    console.error("Error in create case:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get user's cases
router.get('/cases', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const cases = await Case.find({ userId: req.user.id })
      .populate('lawyerId', 'name email specialization photo phone barCouncilId')
      .populate('ngoId', 'name email city phone focusAreas')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${cases.length} cases for user ${req.user.id}`);
    
    res.json({ cases, count: cases.length });
  } catch (error) {
    console.error('Error fetching user cases:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single case
router.get('/cases/:id', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const caseData = await Case.findOne({
      _id: req.params.id,
      userId: req.user.id
    })
      .populate('lawyerId', 'name email specialization photo phone barCouncilId location')
      .populate('ngoId', 'name email city phone focusAreas focalPerson address');
    
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found' });
    }
    
    res.json(caseData);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add message to case (chat)
router.post('/cases/:id/messages', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const caseData = await Case.findOne({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found' });
    }
    
    const newMsg = {
      senderId: req.user.id,
      senderType: 'user',
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

      const recipientId = (caseData.lawyerId || caseData.ngoId)?.toString();
      if (recipientId) {
        realTimeManager.notifyUser(recipientId, 'CASE_UPDATED', {
          caseId: caseData._id,
          message: `Client sent note on case "${caseData.title}": ${newMsg.message.substring(0, 60)}...`,
          requiresRefresh: false
        });
      }
    }
    
    res.json({ message: 'Message sent successfully', case: caseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add document to case
router.post('/cases/:id/documents', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const { name } = req.body;
    const url = safeDocUrl(req.body.url);
    if (!url) {
      return res.status(400).json({ message: 'Document links must start with https://' });
    }
    const caseData = await Case.findOne({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found' });
    }
    
    caseData.documents.push({
      name,
      url,
      uploadedAt: new Date()
    });
    
    await caseData.save();
    
    res.json({ message: 'Document added successfully', case: caseData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ DASHBOARD STATS ============

// Get dashboard stats for user
router.get('/dashboard/stats', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
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

    // Find upcoming court hearings
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
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ LEGAL DOCUMENT TEMPLATES ============

// Get available legal document templates
router.get('/templates', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const templates = [
      {
        id: 'affidavit',
        name: 'Affidavit Template',
        category: 'general',
        description: 'Standard affidavit format for legal declarations'
      },
      {
        id: 'complaint',
        name: 'Complaint Letter',
        category: 'complaint',
        description: 'Format for filing a formal complaint'
      },
      {
        id: 'legal_notice',
        name: 'Legal Notice',
        category: 'notice',
        description: 'Template for sending legal notice to a party'
      },
      {
        id: 'agreement',
        name: 'Simple Agreement',
        category: 'contract',
        description: 'Basic agreement template for simple contracts'
      }
    ];
    
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get specific template content
router.get('/templates/:templateId', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const templates = {
      affidavit: `AFFIDAVIT

I, [Your Full Name], son/daughter of [Father's Name], resident of [Full Address], do hereby solemnly affirm and declare as under:

1. That I am the deponent herein and fully aware of the facts stated below.
2. That [state your facts here].

DEPONENT

Verified at [City] on this [Date] that the contents of this affidavit are true and correct to the best of my knowledge.`,
      
      complaint: `To,
[Authority Name/Organization]
[Address]

Subject: Complaint regarding [Subject]

Respected Sir/Madam,

I, [Your Name], resident of [Address], wish to bring to your attention that [describe your complaint].

Therefore, I request you to kindly take appropriate action in this matter.

Thank you,
Yours sincerely,

[Your Name]
[Contact Number]
[Date]`
    };
    
    const template = templates[req.params.templateId];
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    res.json({ templateId: req.params.templateId, content: template });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;