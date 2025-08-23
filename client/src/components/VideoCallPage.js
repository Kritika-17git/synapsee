// src/components/VideoCallPage.js - Enhanced with face recognition
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoCall from './VideoCall.js';
import Controls from './Controls.js';
import FaceRecognitionPanel from './FaceRecognitionPanel.js';
import useWebRTC from '../hooks/useWebRTC.js';
import { useAuth } from '../context/AuthContext.js';

const VideoCallPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hasJoined, setHasJoined] = useState(false);
  const [faceRecognitionEnabled, setFaceRecognitionEnabled] = useState(true);
  const [participantFaceData, setParticipantFaceData] = useState(new Map());
  const [personalFaceData, setPersonalFaceData] = useState(null);
  const canvasRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const wsRef = useRef(null);

  const {
    localStream,
    remoteStreams,
    isConnected,
    error,
    peers,
    roomInfo,
    connect,
    disconnect,
    toggleVideo,
    toggleAudio,
    retryMediaAccess, // Add the new retry function
    socket
  } = useWebRTC(roomId);

  // Connect to Python WebSocket server for face recognition
  useEffect(() => {
    if (!faceRecognitionEnabled || !user) return;

    const connectToFaceRecognition = async () => {
      try {
        const ws = new WebSocket('ws://localhost:8001');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Connected to face recognition service');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.frame_processed) {
              setPersonalFaceData({
                ...data,
                timestamp: Date.now()
              });
            }
          } catch (error) {
            console.error('Error parsing face recognition data:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('Face recognition WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('Face recognition WebSocket closed');
        };

      } catch (error) {
        console.error('Failed to connect to face recognition service:', error);
      }
    };

    connectToFaceRecognition();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [faceRecognitionEnabled, user]);

  // Auto-connect when component mounts
  useEffect(() => {
    if (!hasJoined && user) {
      connect();
      setHasJoined(true);
    }
  }, [connect, hasJoined, user]);

  // Setup face recognition listeners for Socket.IO (for other participants)
  useEffect(() => {
    if (!socket) return;

    socket.on('face-recognition-data', (data) => {
      setParticipantFaceData(prev => new Map(prev.set(data.socketId, {
        ...data,
        timestamp: Date.now()
      })));
    });

    return () => {
      socket.off('face-recognition-data');
    };
  }, [socket]);

  // Setup face recognition frame capture and send to Python server
  useEffect(() => {
    if (!localStream || !faceRecognitionEnabled || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 480;
    canvasRef.current = canvas;

    const video = document.createElement('video');
    video.srcObject = localStream;
    video.play();

    const captureFrame = () => {
      if (!video.videoWidth || !video.videoHeight || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (!blob || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        const reader = new FileReader();
        reader.onload = () => {
          // Create message with header and image data
          const header = JSON.stringify({
            participant_id: user._id,
            session_id: roomId,
            name: `${user.firstName} ${user.lastName}`,
            timestamp: Date.now()
          });

          // Convert base64 to binary
          const base64Data = reader.result.split(',')[1];
          const binaryData = atob(base64Data);
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
          }

          // Combine header and image data
          const headerBytes = new TextEncoder().encode(header + '\n');
          const message = new Uint8Array(headerBytes.length + bytes.length);
          message.set(headerBytes);
          message.set(bytes, headerBytes.length);

          wsRef.current.send(message);
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.8);
    };

    // Capture frames at 2 FPS to avoid overwhelming the system
    frameIntervalRef.current = setInterval(captureFrame, 500);

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [localStream, faceRecognitionEnabled, user, roomId]);

  const handleToggleFaceRecognition = () => {
    const newState = !faceRecognitionEnabled;
    setFaceRecognitionEnabled(newState);

    if (!newState) {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      setPersonalFaceData(null);
    }
  };

  const handleRetryConnection = async () => {
    try {
      await retryMediaAccess();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const handleEndCall = async () => {
    // Clean up face recognition
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Save session data to Node.js database before leaving
    if (personalFaceData) {
      try {
        await fetch('/api/reports/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            sessionId: roomId,
            roomId: roomId,
            sessionName: `Meeting - ${new Date().toLocaleDateString()}`,
            participants: [{
              userId: user._id,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              totalFrames: personalFaceData.total_frames || 0,
              faceDetectedFrames: personalFaceData.face_detected_frames || 0,
              attentionScore: personalFaceData.attention_score || 0,
              joinedAt: new Date(),
              sessionDuration: Math.round((personalFaceData.session_duration_seconds || 0) / 60)
            }]
          })
        });
      } catch (error) {
        console.error('Failed to save session data:', error);
      }
    }

    disconnect();
    navigate('/dashboard');
  };

  const handleViewAttentionReport = async () => {
    try {
      // First save current session data
      if (personalFaceData) {
        await fetch('/api/reports/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            sessionId: roomId,
            roomId: roomId,
            sessionName: `Meeting - ${new Date().toLocaleDateString()}`,
            participants: [{
              userId: user._id,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              totalFrames: personalFaceData.total_frames || 0,
              faceDetectedFrames: personalFaceData.face_detected_frames || 0,
              attentionScore: personalFaceData.attention_score || 0,
              joinedAt: new Date(),
              sessionDuration: Math.round((personalFaceData.session_duration_seconds || 0) / 60)
            }]
          })
        });
      }

      // Then try to get the report from Python server
      const pythonResponse = await fetch(`http://localhost:8000/session/${roomId}/report`);
      const pythonData = await pythonResponse.json();
      
      if (pythonData.success) {
        // Open report in new tab using Python data
        const reportWindow = window.open('', '_blank');
        reportWindow.document.write(generateReportHTML(pythonData));
      } else {
        // Fallback to Node.js report
        const nodeResponse = await fetch(`/api/reports/session/${roomId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const nodeData = await nodeResponse.json();
        
        if (nodeData.success) {
          navigate(`/reports/${roomId}`);
        } else {
          alert('No attention data available yet. Continue using the system to generate reports.');
        }
      }
    } catch (error) {
      console.error('Error fetching attention report:', error);
      alert('Failed to fetch attention report. Please try again.');
    }
  };

  const generateReportHTML = (report) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attention Analysis Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .score-section { background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 15px; text-align: center; margin-bottom: 20px; }
          .score-value { font-size: 3rem; font-weight: bold; margin: 10px 0; }
          .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .detail-card { background: #f8f9fa; padding: 15px; border-radius: 10px; border: 1px solid #e9ecef; }
          .participant-card { margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Attention Analysis Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>Session ID: ${report.session_id}</p>
          </div>
          
          <div class="score-section">
            <h2>Overall Attention Score</h2>
            <div class="score-value">${report.overall_attention_score}/100</div>
            <div style="font-size: 1.2rem; color: ${report.grade.color};">${report.grade.grade} - ${report.grade.label}</div>
          </div>
          
          <div class="details-grid">
            <div class="detail-card">
              <h3>📈 Session Summary</h3>
              <div><strong>Participants:</strong> ${report.participant_count}</div>
              <div><strong>Generated:</strong> ${new Date(report.generated_at).toLocaleString()}</div>
            </div>
            
            <div class="detail-card">
              <h3>⏱️ Statistics</h3>
              <div><strong>Overall Score:</strong> ${report.overall_attention_score}%</div>
              <div><strong>Grade:</strong> ${report.grade.grade}</div>
            </div>
          </div>
          
          <div style="margin-top: 20px;">
            <h3>👥 Participants</h3>
            ${report.participants.map(p => `
              <div class="participant-card">
                <h4>${p.name} (${p.participant_id})</h4>
                <div><strong>Attention Score:</strong> ${p.attention_score}%</div>
                <div><strong>Total Frames:</strong> ${p.total_frames}</div>
                <div><strong>Face Detected:</strong> ${p.face_detected_frames}</div>
                <div><strong>Session Start:</strong> ${new Date(p.session_start).toLocaleString()}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Styles
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    display: 'flex',
    flexDirection: 'column'
  };

  const headerStyle = {
    textAlign: 'center',
    color: 'white',
    marginBottom: '20px'
  };

  const roomInfoStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    padding: '15px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    marginBottom: '20px',
    textAlign: 'center',
    color: 'white'
  };

  const mainContentStyle = {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '20px',
    flex: 1,
    minHeight: '500px'
  };

  const videoSectionStyle = {
    display: 'flex',
    flexDirection: 'column'
  };

  const videoGridStyle = {
    display: 'grid',
    gap: '15px',
    marginBottom: '20px',
    flex: 1,
    gridTemplateColumns: remoteStreams.size === 0 
      ? '1fr' 
      : remoteStreams.size === 1 
        ? '1fr 1fr' 
        : `repeat(${Math.min(remoteStreams.size + 1, 3)}, 1fr)`,
    minHeight: '400px'
  };

  const sidePanelStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  };

  const errorStyle = {
    background: 'rgba(255, 0, 0, 0.1)',
    border: '1px solid rgba(255, 0, 0, 0.3)',
    color: '#ff6b6b',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'center'
  };

  const retryButtonStyle = {
    background: 'linear-gradient(45deg, #ff6b6b, #ee5a52)',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '10px',
    transition: 'all 0.2s ease',
    fontWeight: '600'
  };

  const statusStyle = {
    textAlign: 'center',
    color: 'white',
    marginBottom: '10px',
    fontSize: '14px'
  };

  const loadingStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '60vh',
    fontSize: '1.5rem',
    color: 'white'
  };

  // Show loading while connecting
  if (!isConnected && !error) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>
          Connecting to room...
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>
          Enhanced Video Call Room
        </h1>
        <p style={{ fontSize: '1rem', opacity: 0.8 }}>
          Room ID: {roomId.substring(0, 8)}... | Face Recognition: {faceRecognitionEnabled ? 'ON' : 'OFF'}
        </p>
      </div>

      {/* Room Info */}
      {roomInfo && (
        <div style={roomInfoStyle}>
          <p style={{ margin: 0, fontSize: '14px' }}>
            <strong>{roomInfo.userCount} user{roomInfo.userCount !== 1 ? 's' : ''} in room</strong>
            {roomInfo.users && roomInfo.users.length > 0 && (
              <span style={{ marginLeft: '10px' }}>
                • {roomInfo.users.map(u => `${u.firstName} ${u.lastName}`).join(', ')}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Enhanced Error Display with Retry Button */}
      {error && (
        <div style={errorStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: '10px' }}>
              <strong>Error:</strong> {error}
            </div>
            <button 
              onClick={handleRetryConnection}
              style={retryButtonStyle}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div style={statusStyle}>
        {isConnected ? (
          <span style={{ color: '#4CAF50' }}>✓ Connected</span>
        ) : (
          <span style={{ color: '#FFA726' }}>⏳ Connecting...</span>
        )}
      </div>

      {/* Main Content */}
      <div style={mainContentStyle}>
        {/* Video Section */}
        <div style={videoSectionStyle}>
          <div style={videoGridStyle}>
            {/* Local Video */}
            {localStream && (
              <VideoCall
                stream={localStream}
                isLocal={true}
                muted={true}
                userId={`${user?.firstName} ${user?.lastName} (You)`}
                className="video-container"
                faceData={personalFaceData}
                showFaceOverlay={faceRecognitionEnabled}
              />
            )}

            {/* Remote Videos */}
            {Array.from(remoteStreams.entries()).map(([socketId, stream]) => {
              const peer = peers.get(socketId);
              const userName = peer?.user 
                ? `${peer.user.firstName} ${peer.user.lastName}` 
                : `User ${socketId.substring(0, 8)}`;
              
              return (
                <VideoCall
                  key={socketId}
                  stream={stream}
                  isLocal={false}
                  muted={false}
                  userId={userName}
                  className="video-container"
                  faceData={participantFaceData.get(socketId)}
                  showFaceOverlay={faceRecognitionEnabled}
                />
              );
            })}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Controls
              onToggleVideo={toggleVideo}
              onToggleAudio={toggleAudio}
              onToggleFaceRecognition={handleToggleFaceRecognition}
              onViewReport={handleViewAttentionReport}
              onEndCall={handleEndCall}
              isConnected={isConnected}
              faceRecognitionEnabled={faceRecognitionEnabled}
            />
          </div>
        </div>

        {/* Side Panel */}
        <div style={sidePanelStyle}>
          <FaceRecognitionPanel
            personalData={personalFaceData}
            participantData={participantFaceData}
            enabled={faceRecognitionEnabled}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoCallPage;