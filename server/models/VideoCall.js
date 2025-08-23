import mongoose from 'mongoose';

// Participant subdocument schema
const participantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User' // Assuming you have a User model
  },
  name: {
    type: String
  },
  username: {
    type: String
  },
  firstName: {
    type: String
  },
  lastName: {
    type: String
  },
  // Attention tracking metrics
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
    min: 0,
    max: 100,
    default: 0
  },
  attentionGrade: {
    grade: String,
    label: String,
    color: String
  },
  // Timing information
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: {
    type: Date
  },
  sessionDuration: {
    type: Number,
    default: 0
  },
  // Additional metrics that might be tracked
  attentiveFrames: {
    type: Number,
    default: 0
  },
  // Device/connection info
  deviceInfo: {
    browser: String,
    os: String,
    device: String
  },
  connectionQuality: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  }
}, { _id: false }); // Disable _id for subdocuments

// Main VideoCall schema
const videoCallSchema = new mongoose.Schema({
  // Session identification
  sessionId: {
    type: String,
    unique: true
  },
  sessionName: {
    type: String
  },
  roomId: {
    type: String
  },
  
  // Creator/host information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Session timing
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  
  // Session status
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Cancelled'],
    default: 'Active'
  },
  
  // Participants array
  participants: [participantSchema],
  
  // Overall session metrics
  totalParticipants: {
    type: Number,
    default: 0
  },
  overallAttentionScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Session settings
  settings: {
    recordSession: {
      type: Boolean,
      default: false
    },
    trackAttention: {
      type: Boolean,
      default: true
    },
    maxParticipants: {
      type: Number,
      default: 50
    }
  },
  
  // Additional metadata
  metadata: {
    sessionType: {
      type: String,
      enum: ['meeting', 'class', 'webinar', 'interview'],
      default: 'meeting'
    },
    description: String,
    tags: [String]
  }
}, {
  timestamps: true,
  collection: 'videocall' // Match your existing collection name
});

// Indexes for better performance
videoCallSchema.index({ createdBy: 1, startTime: -1 });
videoCallSchema.index({ isActive: 1 });
videoCallSchema.index({ 'participants.userId': 1 });
videoCallSchema.index({ startTime: -1 });

// Virtual for calculating session duration
videoCallSchema.virtual('calculatedDuration').get(function() {
  if (this.endTime && this.startTime) {
    return Math.round((this.endTime - this.startTime) / (1000 * 60));
  } else if (this.startTime) {
    return Math.round((new Date() - this.startTime) / (1000 * 60));
  }
  return 0;
});

// Pre-save middleware to update calculated fields
videoCallSchema.pre('save', function(next) {
  // Update total participants count
  this.totalParticipants = this.participants.length;
  
  // Calculate overall attention score
  if (this.participants.length > 0) {
    const totalScore = this.participants.reduce((sum, participant) => {
      return sum + (participant.attentionScore || 0);
    }, 0);
    this.overallAttentionScore = Math.round(totalScore / this.participants.length);
  }
  
  // Update duration if endTime is set
  if (this.endTime && this.startTime) {
    this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60));
  }
  
  next();
});

// Instance method to add participant
videoCallSchema.methods.addParticipant = function(participantData) {
  this.participants.push(participantData);
  this.totalParticipants = this.participants.length;
  return this.save();
};

// Instance method to update participant attention data
videoCallSchema.methods.updateParticipantAttention = function(userId, attentionData) {
  const participant = this.participants.find(p => p.userId.toString() === userId.toString());
  if (participant) {
    Object.assign(participant, attentionData);
    return this.save();
  }
  return null;
};

// Instance method to end session
videoCallSchema.methods.endSession = function() {
  this.endTime = new Date();
  this.isActive = false;
  this.status = 'Completed';
  this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60));
  return this.save();
};

// Static method to find active sessions
videoCallSchema.statics.findActiveSessions = function() {
  return this.find({ isActive: true }).sort({ startTime: -1 });
};

// Static method to find sessions by user
videoCallSchema.statics.findByUser = function(userId) {
  return this.find({
    $or: [
      { createdBy: userId },
      { 'participants.userId': userId }
    ]
  }).sort({ startTime: -1 });
};

const VideoCall = mongoose.model('VideoCall', videoCallSchema);

export default VideoCall;