
// src/components/VideoCallPage.js - Classic Dark Blue Theme with Face Recognition
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
// src/components/VideoCallPage.js - Classic Dark Blue Theme with Face Recognition
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
    retryMediaAccess,
    socket
  } = useWebRTC(roomId);

  // ---- Face recognition WebSocket setup ----
  useEffect(() => {
    if (!faceRecognitionEnabled || !user) return;

    try {
      const ws = new WebSocket('ws://localhost:8001');
      wsRef.current = ws;

      ws.onopen = () => console.log('✅ Connected to face recognition service');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.frame_processed) {
            setPersonalFaceData({ ...data, timestamp: Date.now() });
          }
        } catch (err) {
          console.error('Face recognition parse error:', err);
        }
      };
      ws.onclose = () => console.log('⚠️ Face recognition WebSocket closed');
    } catch (err) {
      console.error('❌ Failed to connect face recognition:', err);
    }

    return () => wsRef.current?.close();
  }, [faceRecognitionEnabled, user]);

  // ---- Auto-join call ----
  useEffect(() => {
    if (!hasJoined && user) {
      connect();
      setHasJoined(true);
    }
  }, [connect, hasJoined, user]);

  // ---- Handle incoming socket face data ----
  useEffect(() => {
    if (!socket) return;
    socket.on('face-recognition-data', (data) => {
      setParticipantFaceData(prev =>
        new Map(prev.set(data.socketId, { ...data, timestamp: Date.now() }))
      );
    });
    return () => socket.off('face-recognition-data');
  }, [socket]);

  // ---- Capture frames for face recognition ----
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
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          const header = JSON.stringify({
            participant_id: user._id,
            session_id: roomId,
            name: `${user.firstName} ${user.lastName}`,
            timestamp: Date.now()
          });

          const base64Data = reader.result.split(',')[1];
          const binaryData = atob(base64Data);
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) bytes[i] = binaryData.charCodeAt(i);

          const headerBytes = new TextEncoder().encode(header + '\n');
          const message = new Uint8Array(headerBytes.length + bytes.length);
          message.set(headerBytes);
          message.set(bytes, headerBytes.length);

          wsRef.current?.send(message);
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.8);
    };

    frameIntervalRef.current = setInterval(captureFrame, 500);
    return () => clearInterval(frameIntervalRef.current);
  }, [localStream, faceRecognitionEnabled, user, roomId]);

  // ---- Handlers ----
  const handleToggleFaceRecognition = () => {
    const newState = !faceRecognitionEnabled;
    setFaceRecognitionEnabled(newState);
    if (!newState) {
      clearInterval(frameIntervalRef.current);
      wsRef.current?.close();
      setPersonalFaceData(null);
    }
  };

  const handleRetryConnection = async () => {
    try {
      await retryMediaAccess();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  const handleEndCall = async () => {
    clearInterval(frameIntervalRef.current);
    wsRef.current?.close();
    disconnect();
    navigate('/dashboard');
  };

  // ---- Styles (dark blue classic) ----
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a192f 0%, #0f2944 100%)',
    padding: '20px',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    display: 'flex',
    flexDirection: 'column'
  };

  const headerStyle = {
    textAlign: 'center',
    color: '#e0f7fa',
    marginBottom: '20px'
  };

  const roomInfoStyle = {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(12px)',
    padding: '15px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    marginBottom: '20px',
    textAlign: 'center',
    color: '#bbdefb'
  };

  const mainContentStyle = {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '20px',
    flex: 1,
    minHeight: '500px'
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

  const errorStyle = {
    background: 'rgba(255, 77, 77, 0.12)',
    border: '1px solid rgba(255, 77, 77, 0.3)',
    color: '#ff6b6b',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'center'
  };

  const retryButtonStyle = {
    background: 'linear-gradient(45deg, #00c6ff, #0072ff)',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '10px',
    fontWeight: '600',
    boxShadow: '0 4px 12px rgba(0, 114, 255, 0.3)'
  };

  const loadingStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '60vh',
    fontSize: '1.5rem',
    color: '#e0f7fa'
  };

  // ---- Loading screen ----
  if (!isConnected && !error) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>⏳ Connecting to room...</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>🎥 Video Call Room</h1>
        <p style={{ fontSize: '1rem', opacity: 0.85 }}>
          Room: {roomId.substring(0, 8)} | Face Recognition: {faceRecognitionEnabled ? 'ON' : 'OFF'}
        </p>
      </div>

      {/* Room Info */}
      {roomInfo && (
        <div style={roomInfoStyle}>
          <p style={{ margin: 0, fontSize: '14px' }}>
            <strong>{roomInfo.userCount} participant(s)</strong>
            {roomInfo.users?.length > 0 && (
              <span style={{ marginLeft: '10px' }}>
                • {roomInfo.users.map(u => `${u.firstName} ${u.lastName}`).join(', ')}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={errorStyle}>
          <div>
            <div><strong>Error:</strong> {error}</div>
            <button onClick={handleRetryConnection} style={retryButtonStyle}>
              🔄 Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={mainContentStyle}>
        {/* Video Grid */}
        <div>
          <div style={videoGridStyle}>
            {localStream && (
              <VideoCall
                stream={localStream}
                isLocal
                muted
                userId={`${user?.firstName} ${user?.lastName} (You)`}
                faceData={personalFaceData}
                showFaceOverlay={faceRecognitionEnabled}
              />
            )}
            {Array.from(remoteStreams.entries()).map(([socketId, stream]) => {
              const peer = peers.get(socketId);
              const name = peer?.user ? `${peer.user.firstName} ${peer.user.lastName}` : `User ${socketId.substring(0, 8)}`;
              return (
                <VideoCall
                  key={socketId}
                  stream={stream}
                  isLocal={false}
                  muted={false}
                  userId={name}
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
              onEndCall={handleEndCall}
              isConnected={isConnected}
              faceRecognitionEnabled={faceRecognitionEnabled}
            />
          </div>
        </div>

        {/* Side Panel */}
        <div>
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
    retryMediaAccess,
    socket
  } = useWebRTC(roomId);

  // ---- Face recognition WebSocket setup ----
  useEffect(() => {
    if (!faceRecognitionEnabled || !user) return;

    try {
      const ws = new WebSocket('ws://localhost:8001');
      wsRef.current = ws;

      ws.onopen = () => console.log('✅ Connected to face recognition service');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.frame_processed) {
            setPersonalFaceData({ ...data, timestamp: Date.now() });
          }
        } catch (err) {
          console.error('Face recognition parse error:', err);
        }
      };
      ws.onclose = () => console.log('⚠️ Face recognition WebSocket closed');
    } catch (err) {
      console.error('❌ Failed to connect face recognition:', err);
    }

    return () => wsRef.current?.close();
  }, [faceRecognitionEnabled, user]);

  // ---- Auto-join call ----
  useEffect(() => {
    if (!hasJoined && user) {
      connect();
      setHasJoined(true);
    }
  }, [connect, hasJoined, user]);

  // ---- Handle incoming socket face data ----
  useEffect(() => {
    if (!socket) return;
    socket.on('face-recognition-data', (data) => {
      setParticipantFaceData(prev =>
        new Map(prev.set(data.socketId, { ...data, timestamp: Date.now() }))
      );
    });
    return () => socket.off('face-recognition-data');
  }, [socket]);

  // ---- Capture frames for face recognition ----
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
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          const header = JSON.stringify({
            participant_id: user._id,
            session_id: roomId,
            name: `${user.firstName} ${user.lastName}`,
            timestamp: Date.now()
          });

          const base64Data = reader.result.split(',')[1];
          const binaryData = atob(base64Data);
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) bytes[i] = binaryData.charCodeAt(i);

          const headerBytes = new TextEncoder().encode(header + '\n');
          const message = new Uint8Array(headerBytes.length + bytes.length);
          message.set(headerBytes);
          message.set(bytes, headerBytes.length);

          wsRef.current?.send(message);
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.8);
    };

    frameIntervalRef.current = setInterval(captureFrame, 500);
    return () => clearInterval(frameIntervalRef.current);
  }, [localStream, faceRecognitionEnabled, user, roomId]);

  // ---- Handlers ----
  const handleToggleFaceRecognition = () => {
    const newState = !faceRecognitionEnabled;
    setFaceRecognitionEnabled(newState);
    if (!newState) {
      clearInterval(frameIntervalRef.current);
      wsRef.current?.close();
      setPersonalFaceData(null);
    }
  };

  const handleRetryConnection = async () => {
    try {
      await retryMediaAccess();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  const handleEndCall = async () => {
    clearInterval(frameIntervalRef.current);
    wsRef.current?.close();
    disconnect();
    navigate('/dashboard');
  };

  // ---- Styles (dark blue classic) ----
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a192f 0%, #0f2944 100%)',
    padding: '20px',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    display: 'flex',
    flexDirection: 'column'
  };

  const headerStyle = {
    textAlign: 'center',
    color: '#e0f7fa',
    marginBottom: '20px'
  };

  const roomInfoStyle = {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(12px)',
    padding: '15px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    marginBottom: '20px',
    textAlign: 'center',
    color: '#bbdefb'
  };

  const mainContentStyle = {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '20px',
    flex: 1,
    minHeight: '500px'
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

  const errorStyle = {
    background: 'rgba(255, 77, 77, 0.12)',
    border: '1px solid rgba(255, 77, 77, 0.3)',
    color: '#ff6b6b',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'center'
  };

  const retryButtonStyle = {
    background: 'linear-gradient(45deg, #00c6ff, #0072ff)',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '10px',
    fontWeight: '600',
    boxShadow: '0 4px 12px rgba(0, 114, 255, 0.3)'
  };

  const loadingStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '60vh',
    fontSize: '1.5rem',
    color: '#e0f7fa'
  };

  // ---- Loading screen ----
  if (!isConnected && !error) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>⏳ Connecting to room...</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>🎥 Video Call Room</h1>
        <p style={{ fontSize: '1rem', opacity: 0.85 }}>
          Room: {roomId.substring(0, 8)} | Face Recognition: {faceRecognitionEnabled ? 'ON' : 'OFF'}
        </p>
      </div>

      {/* Room Info */}
      {roomInfo && (
        <div style={roomInfoStyle}>
          <p style={{ margin: 0, fontSize: '14px' }}>
            <strong>{roomInfo.userCount} participant(s)</strong>
            {roomInfo.users?.length > 0 && (
              <span style={{ marginLeft: '10px' }}>
                • {roomInfo.users.map(u => `${u.firstName} ${u.lastName}`).join(', ')}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={errorStyle}>
          <div>
            <div><strong>Error:</strong> {error}</div>
            <button onClick={handleRetryConnection} style={retryButtonStyle}>
              🔄 Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={mainContentStyle}>
        {/* Video Grid */}
        <div>
          <div style={videoGridStyle}>
            {localStream && (
              <VideoCall
                stream={localStream}
                isLocal
                muted
                userId={`${user?.firstName} ${user?.lastName} (You)`}
                faceData={personalFaceData}
                showFaceOverlay={faceRecognitionEnabled}
              />
            )}
            {Array.from(remoteStreams.entries()).map(([socketId, stream]) => {
              const peer = peers.get(socketId);
              const name = peer?.user ? `${peer.user.firstName} ${peer.user.lastName}` : `User ${socketId.substring(0, 8)}`;
              return (
                <VideoCall
                  key={socketId}
                  stream={stream}
                  isLocal={false}
                  muted={false}
                  userId={name}
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
              onEndCall={handleEndCall}
              isConnected={isConnected}
              faceRecognitionEnabled={faceRecognitionEnabled}
            />
          </div>
        </div>

        {/* Side Panel */}
        <div>
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
