import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  totalFrames: {
    type: Number,
    default: 0
  },
  faceDetectedFrames: {
    type: Number,
    default: 0
  },
  attentionScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  attentionGrade: {
    grade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E', 'F'],
      default: 'F'
    },
    label: {
      type: String,
      enum: ['Excellent', 'Good', 'Average', 'Below Average', 'Poor', 'Very Poor'],
      default: 'Very Poor'
    },
    color: {
      type: String,
      default: '#F44336'
    }
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: {
    type: Date,
    default: null
  },
  sessionDuration: {
    type: Number, // in minutes
    default: 0
  }
}, { _id: false });

const attentionReportSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  roomId: {
    type: String,
    required: true
  },
  sessionName: {
    type: String,
    required: true
  },
  participants: [participantSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Ended'],
    default: 'Active'
  },
  overallAttentionScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  totalParticipants: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted session info
attentionReportSchema.virtual('sessionInfo').get(function() {
  return {
    sessionId: this.sessionId,
    sessionName: this.sessionName,
    roomId: this.roomId,
    startTime: this.startTime,
    endTime: this.endTime,
    duration: this.duration,
    status: this.status,
    overallAttentionScore: this.overallAttentionScore,
    totalParticipants: this.totalParticipants,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
});

// Index for better query performance
attentionReportSchema.index({ createdBy: 1, startTime: -1 });
attentionReportSchema.index({ sessionId: 1, isActive: 1 });
attentionReportSchema.index({ 'participants.userId': 1 });

const AttentionReport = mongoose.model('AttentionReport', attentionReportSchema);

export default AttentionReport;