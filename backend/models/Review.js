const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetType: {
    type: String,
    enum: ['lawyer', 'ngo'],
    required: true
  },
  lawyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lawyer',
    default: null
  },
  ngoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NGO',
    default: null
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxLength: 1000
  },
  isFlagged: {
    type: Boolean,
    default: false
  },
  flagReason: {
    type: String,
    default: '',
    trim: true
  },
  flaggedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  flaggedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // 48-Hour edit window tracking
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  // One-time public reply by target Lawyer or NGO
  reply: {
    comment: {
      type: String,
      trim: true,
      maxLength: 1000,
      default: ''
    },
    repliedAt: {
      type: Date,
      default: null
    },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    authorRole: {
      type: String,
      enum: ['lawyer', 'ngo', null],
      default: null
    },
    authorName: {
      type: String,
      trim: true,
      default: ''
    }
  }
});

// Compound unique index to prevent multiple reviews per case (FR_18-05)
reviewSchema.index({ userId: 1, caseId: 1 }, { unique: true });
reviewSchema.index({ lawyerId: 1, isFlagged: 1 });
reviewSchema.index({ ngoId: 1, isFlagged: 1 });

module.exports = mongoose.model('Review', reviewSchema);
