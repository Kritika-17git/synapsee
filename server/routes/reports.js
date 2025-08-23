import express from 'express';
import VideoCall from '../models/VideoCall.js';
import { authenticateToken } from '../middleware/auth.js';
import AttentionReport from '../models/AttentionReport.js';

const router = express.Router();

// GET /api/reports/session/:sessionId
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find the session by sessionId (which appears to be the MongoDB _id)
    const session = await VideoCall.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Extract session information
    const sessionInfo = {
      sessionId: session._id.toString(),
      sessionName: session.sessionName || `Video Call Session`,
      roomId: session.roomId || session._id.toString(),
      startTime: session.startTime || session.createdAt,
      endTime: session.endTime,
      status: session.isActive ? 'Active' : 'Completed',
      totalParticipants: session.participants ? session.participants.length : 0,
      overallAttentionScore: 0,
      duration: 0
    };

    // Process participants
    const participants = session.participants ? session.participants.map(participant => {
      // Calculate attention score - handle case where totalFrames might be 0
      const attentionScore = participant.totalFrames > 0 
        ? Math.round(((participant.faceDetectedFrames || 0) / participant.totalFrames) * 100)
        : 0;

      // Calculate session duration in minutes
      let sessionDuration = 0;
      if (participant.joinedAt) {
        const joinTime = new Date(participant.joinedAt);
        const leaveTime = participant.leftAt ? new Date(participant.leftAt) : new Date();
        sessionDuration = Math.round((leaveTime - joinTime) / (1000 * 60));
      }

      // Get attention grade
      const attentionGrade = getAttentionGrade(attentionScore);

      return {
        userId: participant.userId.toString(),
        name: `${participant.firstName || ''} ${participant.lastName || ''}`.trim() || participant.name || 'Unknown User',
        username: participant.username || 'unknown',
        joinedAt: participant.joinedAt || session.startTime || session.createdAt,
        leftAt: participant.leftAt,
        totalFrames: participant.totalFrames || 0,
        faceDetectedFrames: participant.faceDetectedFrames || 0,
        attentiveFrames: participant.faceDetectedFrames || 0, // Using faceDetected as proxy for attentive
        attentionScore: attentionScore,
        attentionGrade: attentionGrade,
        sessionDuration: sessionDuration
      };
    }) : [];

    // Calculate overall metrics
    if (participants.length > 0) {
      sessionInfo.overallAttentionScore = Math.round(
        participants.reduce((sum, p) => sum + p.attentionScore, 0) / participants.length
      );

      // Calculate total session duration
      if (session.startTime && session.endTime) {
        const startTime = new Date(session.startTime);
        const endTime = new Date(session.endTime);
        sessionInfo.duration = Math.round((endTime - startTime) / (1000 * 60));
      } else if (session.startTime) {
        const startTime = new Date(session.startTime);
        const endTime = new Date(); // Use current time if session is still active
        sessionInfo.duration = Math.round((endTime - startTime) / (1000 * 60));
      }
    }

    // Sort participants by attention score (highest first)
    participants.sort((a, b) => b.attentionScore - a.attentionScore);

    res.json({
      success: true,
      data: {
        sessionInfo: sessionInfo,
        participants: participants
      }
    });

  } catch (error) {
    console.error('Error fetching attention report:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/reports/user/:userId - Get all sessions for a user
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find sessions where user is creator or participant
    const sessions = await VideoCall.find({
      $or: [
        { createdBy: userId },
        { 'participants.userId': userId }
      ]
    }).sort({ startTime: -1 }).limit(20);

    const sessionSummaries = sessions.map(session => {
      const userParticipant = session.participants.find(p => p.userId.toString() === userId);
      
      return {
        sessionId: session._id.toString(),
        sessionName: session.sessionName || `Video Call Session`,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration || 0,
        status: session.isActive ? 'Active' : 'Completed',
        totalParticipants: session.participants.length,
        overallAttentionScore: session.overallAttentionScore || 0,
        userAttentionScore: userParticipant ? userParticipant.attentionScore || 0 : null,
        isCreator: session.createdBy.toString() === userId
      };
    });

    res.json({
      success: true,
      data: {
        sessions: sessionSummaries
      }
    });

  } catch (error) {
    console.error('Error fetching user reports:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper function to determine attention grade
function getAttentionGrade(score) {
  if (score >= 90) {
    return { grade: 'A+', label: 'Excellent', color: '#4CAF50' };
  } else if (score >= 85) {
    return { grade: 'A', label: 'Very Good', color: '#66BB6A' };
  } else if (score >= 80) {
    return { grade: 'B+', label: 'Good', color: '#8BC34A' };
  } else if (score >= 75) {
    return { grade: 'B', label: 'Above Average', color: '#9CCC65' };
  } else if (score >= 70) {
    return { grade: 'B-', label: 'Average', color: '#CDDC39' };
  } else if (score >= 65) {
    return { grade: 'C+', label: 'Below Average', color: '#FFC107' };
  } else if (score >= 60) {
    return { grade: 'C', label: 'Poor', color: '#FF9800' };
  } else if (score >= 50) {
    return { grade: 'D', label: 'Very Poor', color: '#FF5722' };
  } else {
    return { grade: 'F', label: 'Failing', color: '#F44336' };
  }
}
router.get('/my-reports', async (req, res) => {
  try {
    const reports = await AttentionReport.find({})
      .sort({ createdAt: -1 });
    
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/reports/:roomId - Get reports by room ID
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const reports = await AttentionReport.find({ roomId })
      .sort({ createdAt: -1 });
    
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports by room:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;