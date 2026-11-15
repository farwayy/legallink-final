const express = require('express');
const { logAction } = require('../utils/auditLog');
const { requirePermission } = require('../utils/adminPermissions');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Case = require('../models/Case');
const Lawyer = require('../models/Lawyer');
const NGO = require('../models/NGO');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper to recalculate and update the aggregate rating and review count
 * for a Lawyer or NGO.
 */
async function updateAggregateRating(targetType, targetId) {
  if (!targetId) return;

  const id = new mongoose.Types.ObjectId(targetId);

  if (targetType === 'lawyer') {
    const stats = await Review.aggregate([
      { $match: { lawyerId: id, isFlagged: false } },
      {
        $group: {
          _id: '$lawyerId',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    const avgRating = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0;
    const totalReviews = stats.length > 0 ? stats[0].count : 0;

    await Lawyer.findByIdAndUpdate(id, {
      rating: avgRating,
      totalReviews: totalReviews
    });
  } else if (targetType === 'ngo') {
    const stats = await Review.aggregate([
      { $match: { ngoId: id, isFlagged: false } },
      {
        $group: {
          _id: '$ngoId',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    const avgRating = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0;
    const totalReviews = stats.length > 0 ? stats[0].count : 0;

    await NGO.findByIdAndUpdate(id, {
      rating: avgRating,
      totalReviews: totalReviews
    });
  }
}

/**
 * Helper to compute star distribution breakdown (5★, 4★, 3★, 2★, 1★)
 * for a Lawyer or NGO.
 */
async function getTargetStarDistribution(targetType, targetId) {
  if (!targetId) {
    return {
      starDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      totalReviews: 0,
      averageRating: 0
    };
  }

  const id = new mongoose.Types.ObjectId(targetId);
  const matchFilter = targetType === 'lawyer' 
    ? { lawyerId: id, isFlagged: false } 
    : { ngoId: id, isFlagged: false };

  const breakdownStats = await Review.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    }
  ]);

  const starDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalReviews = 0;
  let sumRating = 0;

  breakdownStats.forEach((item) => {
    const star = Number(item._id);
    if (star >= 1 && star <= 5) {
      starDistribution[star] = item.count;
      totalReviews += item.count;
      sumRating += star * item.count;
    }
  });

  const averageRating = totalReviews > 0 ? Math.round((sumRating / totalReviews) * 10) / 10 : 0;

  return {
    starDistribution,
    totalReviews,
    averageRating
  };
}

/**
 * POST /api/reviews
 * Submit a review for a resolved case (Citizen only)
 */
router.post('/', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const { caseId, rating, comment } = req.body;

    // 1. Validation
    if (!caseId) {
      return res.status(400).json({ message: 'Case ID is required.' });
    }

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5 stars.' });
    }

    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      return res.status(400).json({ message: 'Please provide a written review comment.' });
    }

    if (comment.trim().length > 1000) {
      return res.status(400).json({ message: 'Review comment cannot exceed 1000 characters.' });
    }

    // 2. Fetch and verify case
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({ message: 'Legal case not found.' });
    }

    if (caseData.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to review this case.' });
    }

    // Only resolved or closed cases can be reviewed
    if (!['resolved', 'closed'].includes(caseData.status)) {
      return res.status(400).json({
        message: 'Client reviews can only be submitted after a case has been officially marked as resolved or closed.'
      });
    }

    // FR_18-05: Duplicate review prevention
    const existingReview = await Review.findOne({ userId: req.user.id, caseId });
    if (existingReview) {
      return res.status(400).json({
        message: 'You have already submitted a review for this case. Duplicate reviews are not permitted.'
      });
    }

    // 3. Determine target counsel (Lawyer or NGO)
    let targetType = null;
    let lawyerId = null;
    let ngoId = null;

    if (caseData.ngoId || caseData.caseType === 'pro_bono') {
      targetType = 'ngo';
      ngoId = caseData.ngoId;
    } else if (caseData.lawyerId) {
      targetType = 'lawyer';
      lawyerId = caseData.lawyerId;
    } else {
      return res.status(400).json({
        message: 'This case has no assigned advocate or NGO legal aid society to review.'
      });
    }

    // 4. Create and save review
    const newReview = new Review({
      userId: req.user.id,
      targetType,
      lawyerId,
      ngoId,
      caseId,
      rating: Math.round(numRating),
      comment: comment.trim()
    });

    await newReview.save();

    // 5. Recalculate target aggregate rating
    await updateAggregateRating(targetType, targetType === 'lawyer' ? lawyerId : ngoId);

    // Populate user name for response
    await newReview.populate('userId', 'name');

    res.status(201).json({
      success: true,
      message: 'Thank you! Your verified review has been submitted.',
      review: newReview
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'A review for this case has already been submitted.'
      });
    }
    console.error('Error submitting review:', error);
    res.status(500).json({ message: 'Server error while submitting review', error: error.message });
  }
});

/**
 * GET /api/reviews/featured
 * Public: Get verified, unflagged case-backed client reviews for homepage display
 */
router.get('/featured', async (req, res) => {
  try {
    const reviews = await Review.find({ isFlagged: false })
      .populate('userId', 'name profilePicture')
      .populate('lawyerId', 'name specialization officeAddress experience rating')
      .populate('ngoId', 'name organizationType')
      .populate('caseId', 'title category status caseType')
      .sort({ rating: -1, createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (error) {
    console.error('Error fetching featured reviews:', error);
    res.status(500).json({ message: 'Server error fetching featured reviews', error: error.message });
  }
});

/**
 * GET /api/reviews/my-reviews
 * Get all reviews submitted by the logged-in citizen
 */
router.get('/my-reviews', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user.id })
      .populate('caseId', 'title status category')
      .populate('lawyerId', 'name')
      .populate('ngoId', 'name')
      .sort({ createdAt: -1 });

    res.json({ reviews, count: reviews.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching your reviews', error: error.message });
  }
});

/**
 * GET /api/reviews/lawyer/:lawyerId
 * Public: Get all verified, unflagged reviews for a specific Lawyer with optional sort and star distribution
 */
router.get('/lawyer/:lawyerId', async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const { sort } = req.query;

    let sortCriteria = { createdAt: -1 };
    if (sort === 'highest') {
      sortCriteria = { rating: -1, createdAt: -1 };
    } else if (sort === 'lowest') {
      sortCriteria = { rating: 1, createdAt: -1 };
    }

    const reviews = await Review.find({
      lawyerId,
      isFlagged: false
    })
      .populate('userId', 'name')
      .populate('caseId', 'title category createdAt updatedAt status')
      .sort(sortCriteria);

    const { starDistribution, totalReviews, averageRating } = await getTargetStarDistribution('lawyer', lawyerId);

    res.json({
      reviews,
      count: totalReviews,
      averageRating,
      starDistribution,
      ratingBreakdown: starDistribution
    });
  } catch (error) {
    console.error('Error fetching lawyer reviews:', error);
    res.status(500).json({ message: 'Server error fetching lawyer reviews', error: error.message });
  }
});

/**
 * GET /api/reviews/ngo/:ngoId
 * Public: Get all verified, unflagged reviews for a specific NGO with optional sort and star distribution
 */
router.get('/ngo/:ngoId', async (req, res) => {
  try {
    const { ngoId } = req.params;
    const { sort } = req.query;

    let sortCriteria = { createdAt: -1 };
    if (sort === 'highest') {
      sortCriteria = { rating: -1, createdAt: -1 };
    } else if (sort === 'lowest') {
      sortCriteria = { rating: 1, createdAt: -1 };
    }

    const reviews = await Review.find({
      ngoId,
      isFlagged: false
    })
      .populate('userId', 'name')
      .populate('caseId', 'title category createdAt updatedAt status')
      .sort(sortCriteria);

    const { starDistribution, totalReviews, averageRating } = await getTargetStarDistribution('ngo', ngoId);

    res.json({
      reviews,
      count: totalReviews,
      averageRating,
      starDistribution,
      ratingBreakdown: starDistribution
    });
  } catch (error) {
    console.error('Error fetching NGO reviews:', error);
    res.status(500).json({ message: 'Server error fetching NGO reviews', error: error.message });
  }
});

/**
 * GET /api/reviews/distribution/:targetType/:targetId
 * Public: Get star distribution breakdown (5★..1★) for Lawyer or NGO
 */
router.get('/distribution/:targetType/:targetId', async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!['lawyer', 'ngo'].includes(targetType)) {
      return res.status(400).json({ message: 'Invalid target type. Must be "lawyer" or "ngo".' });
    }

    const result = await getTargetStarDistribution(targetType, targetId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching star distribution:', error);
    res.status(500).json({ message: 'Server error fetching rating distribution', error: error.message });
  }
});

/**
 * PATCH /api/reviews/:id/flag
 * Authenticated: Flag a review for inappropriate or abusive content (FR_18-04)
 */
router.patch('/:id/flag', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    review.isFlagged = true;
    review.flagReason = reason || 'Reported by user as inappropriate or false';
    review.flaggedBy = req.user.id;
    review.flaggedAt = new Date();

    await review.save();

    // Recalculate average rating excluding this flagged review
    await updateAggregateRating(
      review.targetType,
      review.targetType === 'lawyer' ? review.lawyerId : review.ngoId
    );

    res.json({
      success: true,
      message: 'Review has been reported to administration for moderation review.',
      review
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error flagging review', error: error.message });
  }
});

/**
 * PATCH /api/reviews/:id
 * Citizen only: Edit rating and comment within 48 hours of initial submission
 */
router.patch('/:id', authMiddleware, requireRole(['user']), async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    // Only the original author can edit
    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are only authorized to edit your own review.' });
    }

    // Flagged reviews under admin review cannot be edited
    if (review.isFlagged) {
      return res.status(400).json({
        message: 'Flagged reviews currently under administrative moderation cannot be modified.'
      });
    }

    // 48-Hour edit window enforcement
    const reviewCreatedMs = new Date(review.createdAt).getTime();
    const hoursElapsed = (Date.now() - reviewCreatedMs) / (1000 * 60 * 60);

    if (hoursElapsed > 48) {
      return res.status(403).json({
        message: 'The 48-hour editing window has expired. Reviews are permanently locked to preserve judicial integrity.'
      });
    }

    // Validation
    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5 stars.' });
    }

    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      return res.status(400).json({ message: 'Please provide written review feedback.' });
    }

    if (comment.trim().length > 1000) {
      return res.status(400).json({ message: 'Review comment cannot exceed 1000 characters.' });
    }

    const oldRating = review.rating;
    const newRating = Math.round(numRating);

    review.rating = newRating;
    review.comment = comment.trim();
    review.isEdited = true;
    review.editedAt = new Date();

    await review.save();

    // Recalculate target aggregate rating if rating value changed
    if (oldRating !== newRating) {
      await updateAggregateRating(
        review.targetType,
        review.targetType === 'lawyer' ? review.lawyerId : review.ngoId
      );
    }

    await review.populate('userId', 'name');

    res.json({
      success: true,
      message: 'Your verified review has been successfully updated.',
      review
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: 'Server error updating review', error: error.message });
  }
});

/**
 * POST /api/reviews/:id/reply
 * Lawyer or NGO only: Post a single public reply to a review targeting themselves
 */
router.post('/:id/reply', authMiddleware, requireRole(['lawyer', 'ngo']), async (req, res) => {
  try {
    const { comment } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    // Scoped authorization: lawyer can only reply to review targeting themselves
    if (req.user.role === 'lawyer') {
      if (review.targetType !== 'lawyer' || review.lawyerId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You are only authorized to reply to reviews targeting your own advocate profile.' });
      }
    } else if (req.user.role === 'ngo') {
      if (review.targetType !== 'ngo' || review.ngoId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'You are only authorized to reply to reviews targeting your own organization.' });
      }
    }

    // Enforce single public reply rule (no back-and-forth thread)
    if (review.reply && review.reply.comment && review.reply.comment.trim()) {
      return res.status(400).json({
        message: 'A public reply has already been published for this review. Only a single public response is permitted.'
      });
    }

    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      return res.status(400).json({ message: 'Please provide a non-empty reply text.' });
    }

    if (comment.trim().length > 1000) {
      return res.status(400).json({ message: 'Reply text cannot exceed 1000 characters.' });
    }

    let authorName = '';
    if (req.user.role === 'lawyer') {
      const lawyer = await Lawyer.findById(req.user.id).select('name');
      authorName = lawyer?.name || 'Advocate';
    } else {
      const ngo = await NGO.findById(req.user.id).select('name');
      authorName = ngo?.name || 'Legal Aid Society';
    }

    review.reply = {
      comment: comment.trim(),
      repliedAt: new Date(),
      repliedBy: req.user.id,
      authorRole: req.user.role,
      authorName
    };

    await review.save();

    res.json({
      success: true,
      message: 'Your official response has been published successfully.',
      review
    });
  } catch (error) {
    console.error('Error posting review reply:', error);
    res.status(500).json({ message: 'Server error posting review reply', error: error.message });
  }
});

/**
 * GET /api/reviews/flagged
 * Admin only: Fetch all reviews currently flagged for moderation with fast-resolution indicator
 */
router.get('/flagged', authMiddleware, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const rawReviews = await Review.find({ isFlagged: true })
      .populate('userId', 'name email')
      .populate('lawyerId', 'name email specialization')
      .populate('ngoId', 'name email city')
      .populate('caseId', 'title category status createdAt updatedAt')
      .populate('flaggedBy', 'name email role')
      .sort({ flaggedAt: -1 });

    const reviews = rawReviews.map((doc) => {
      const r = doc.toObject();
      const c = r.caseId;
      let isFastResolution = false;
      let resolutionDurationHours = null;

      if (c && c.status === 'resolved' && c.createdAt && c.updatedAt) {
        const diffMs = new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime();
        const hours = diffMs / (1000 * 60 * 60);
        if (hours < 24) {
          isFastResolution = true;
          resolutionDurationHours = Math.max(0.1, Math.round(hours * 10) / 10);
        }
      }

      return {
        ...r,
        isFastResolution,
        resolutionDurationHours
      };
    });

    res.json({
      reviews,
      count: reviews.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching flagged reviews', error: error.message });
  }
});

/**
 * GET /api/reviews/admin/all
 * Admin only: Fetch all reviews across the platform with fast-resolution indicator
 */
router.get('/admin/all', authMiddleware, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const rawReviews = await Review.find({})
      .populate('userId', 'name email')
      .populate('lawyerId', 'name email specialization')
      .populate('ngoId', 'name email city')
      .populate('caseId', 'title category status createdAt updatedAt')
      .sort({ createdAt: -1 });

    const reviews = rawReviews.map((doc) => {
      const r = doc.toObject();
      const c = r.caseId;
      let isFastResolution = false;
      let resolutionDurationHours = null;

      if (c && c.status === 'resolved' && c.createdAt && c.updatedAt) {
        const diffMs = new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime();
        const hours = diffMs / (1000 * 60 * 60);
        if (hours < 24) {
          isFastResolution = true;
          resolutionDurationHours = Math.max(0.1, Math.round(hours * 10) / 10);
        }
      }

      return {
        ...r,
        isFastResolution,
        resolutionDurationHours
      };
    });

    res.json({ reviews, count: reviews.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching reviews for admin', error: error.message });
  }
});

/**
 * PATCH /api/reviews/:id/dismiss-flag
 * Admin only: Dismiss the report and restore the review as verified
 */
router.patch('/:id/dismiss-flag', authMiddleware, requireRole(['admin', 'super_admin']), requirePermission('moderate'), async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    review.isFlagged = false;
    review.flagReason = '';
    review.flaggedBy = null;
    review.flaggedAt = null;

    await review.save();

    // Recalculate aggregate rating
    await updateAggregateRating(
      review.targetType,
      review.targetType === 'lawyer' ? review.lawyerId : review.ngoId
    );

    logAction(req, 'DISMISS_FLAG', 'Review', review._id, `${review.rating}★ review`, (review.comment || '').slice(0, 140));

    res.json({
      success: true,
      message: 'Review report dismissed and review reinstated.',
      review
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error dismissing review report', error: error.message });
  }
});

/**
 * DELETE /api/reviews/:id
 * Admin only: Permanently remove a fraudulent or abusive review
 */
router.delete('/:id', authMiddleware, requireRole(['admin', 'super_admin']), requirePermission('moderate'), async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    const { targetType, lawyerId, ngoId } = review;

    await Review.findByIdAndDelete(req.params.id);
    logAction(req, 'DELETE_REVIEW', 'Review', review._id, `${review.rating}★ review`, (review.comment || '').slice(0, 140));

    // Recalculate aggregate rating
    await updateAggregateRating(targetType, targetType === 'lawyer' ? lawyerId : ngoId);

    res.json({
      success: true,
      message: 'Review has been permanently removed by administrator.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting review', error: error.message });
  }
});

module.exports = router;
