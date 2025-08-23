import React from 'react';

const FaceRecognitionPanel = ({ personalData, participantData, enabled }) => {
  const panelStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    padding: '20px',
    borderRadius: '15px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: 'white',
    height: 'fit-content'
  };

  const headerStyle = {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    marginBottom: '15px',
    textAlign: 'center',
    color: enabled ? '#4CAF50' : '#FF9800'
  };

  const scoreCircleStyle = (score) => ({
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: `conic-gradient(${getScoreColor(score)} ${score * 3.6}deg, rgba(255,255,255,0.2) 0deg)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 15px auto',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    position: 'relative'
  });

  const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#8BC34A';
    if (score >= 40) return '#FFC107';
    return '#F44336';
  };

  const statRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '10px',
    fontSize: '14px'
  };

  const participantItemStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    padding: '10px',
    borderRadius: '8px',
    marginBottom: '8px',
    fontSize: '12px'
  };

  if (!enabled) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Face Recognition Disabled</div>
        <p style={{ textAlign: 'center', opacity: 0.7 }}>
          Enable face recognition to see attention monitoring and participant analysis.
        </p>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>Attention Monitor</div>
      
      {/* Personal Attention Score */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Your Attention</h4>
        {personalData ? (
          <>
            <div style={scoreCircleStyle(personalData.attention_score || 0)}>
              {Math.round(personalData.attention_score || 0)}
            </div>
            <div style={{ textAlign: 'center', marginBottom: '15px', fontSize: '12px' }}>
              {personalData.attention_grade || 'Computing...'}
            </div>
            
            {personalData.detailed_attention_scores && (
              <div>
                <div style={statRowStyle}>
                  <span>Face Presence:</span>
                  <span>{personalData.detailed_attention_scores.face_presence || 0}/20</span>
                </div>
                <div style={statRowStyle}>
                  <span>Eye Openness:</span>
                  <span>{personalData.detailed_attention_scores.eye_openness || 0}/25</span>
                </div>
                <div style={statRowStyle}>
                  <span>Head Stability:</span>
                  <span>{personalData.detailed_attention_scores.head_stability || 0}/25</span>
                </div>
                <div style={statRowStyle}>
                  <span>Emotional Engagement:</span>
                  <span>{personalData.detailed_attention_scores.emotional_engagement || 0}/20</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', opacity: 0.7 }}>
            Analyzing attention...
          </div>
        )}
      </div>

      {/* Participant Analysis */}
      <div>
        <h4 style={{ marginBottom: '10px' }}>Other Participants</h4>
        {participantData && participantData.size > 0 ? (
          Array.from(participantData.entries()).map(([socketId, data]) => (
            <div key={socketId} style={participantItemStyle}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                {data.username}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Attention:</span>
                <span style={{ color: getScoreColor(data.attention_score || 0) }}>
                  {Math.round(data.attention_score || 0)}/100
                </span>
              </div>
              {data.face_detected !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Face Detected:</span>
                  <span style={{ color: data.face_detected ? '#4CAF50' : '#F44336' }}>
                    {data.face_detected ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', opacity: 0.7, fontSize: '12px' }}>
            No other participants with face recognition
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {personalData && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: 'rgba(255, 255, 255, 0.05)', 
          borderRadius: '8px' 
        }}>
          <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>Quick Stats</h4>
          <div style={{ fontSize: '12px' }}>
            {personalData.emotion && (
              <div style={statRowStyle}>
                <span>Emotion:</span>
                <span>{personalData.emotion}</span>
              </div>
            )}
            {personalData.ear !== undefined && personalData.ear !== null && (
              <div style={statRowStyle}>
                <span>Eye Openness:</span>
                <span>{(personalData.ear * 100).toFixed(1)}%</span>
              </div>
            )}
            {personalData.yaw !== undefined && personalData.yaw !== null && (
              <div style={statRowStyle}>
                <span>Head Yaw:</span>
                <span>{Math.abs(personalData.yaw).toFixed(1)}°</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced VideoCall component with face recognition overlay
export const VideoCallWithFaceRecognition = ({ 
  stream, 
  isLocal = false, 
  muted = false, 
  userId = '', 
  className = '',
  faceData,
  showFaceOverlay = true
}) => {
  const videoRef = React.useRef(null);

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const videoStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '12px',
    backgroundColor: '#1a1a1a',
    transform: isLocal ? 'scaleX(-1)' : 'none'
  };

  const containerStyle = {
    position: 'relative',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    border: faceData?.face_detected && showFaceOverlay ? '3px solid #4CAF50' : '2px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1a1a1a'
  };

  const labelStyle = {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    background: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500'
  };

  const attentionOverlayStyle = {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '11px',
    minWidth: '80px'
  };

  const getAttentionColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#8BC34A';
    if (score >= 40) return '#FFC107';
    return '#F44336';
  };

  return (
    <div className={className} style={containerStyle}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={videoStyle}
      />
      <div style={labelStyle}>
        {isLocal ? 'You' : userId || 'Remote User'}
      </div>
      
      {/* Face Recognition Overlay */}
      {showFaceOverlay && faceData && (
        <div style={attentionOverlayStyle}>
          <div style={{ 
            color: faceData.face_detected ? '#4CAF50' : '#F44336',
            marginBottom: '4px',
            fontSize: '10px'
          }}>
            {faceData.face_detected ? '👤 Face Detected' : '❌ No Face'}
          </div>
          
          {faceData.attention_score !== undefined && (
            <div style={{ 
              color: getAttentionColor(faceData.attention_score),
              fontWeight: 'bold'
            }}>
              Attention: {Math.round(faceData.attention_score)}/100
            </div>
          )}
          
          {faceData.emotion && (
            <div style={{ fontSize: '10px', marginTop: '2px' }}>
              😊 {faceData.emotion}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Enhanced Controls component with face recognition toggle
export const EnhancedControls = ({
  onToggleVideo,
  onToggleAudio,
  onToggleFaceRecognition,
  onViewReport,
  onEndCall,
  isConnected,
  faceRecognitionEnabled
}) => {
  const controlsStyle = {
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap'
  };

  const buttonStyle = {
    padding: '12px 20px',
    borderRadius: '25px',
    border: 'none',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '120px',
    justifyContent: 'center'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    background: 'linear-gradient(45deg, #4CAF50, #45a049)',
    color: 'white'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    background: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    backdropFilter: 'blur(10px)'
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    background: 'linear-gradient(45deg, #f44336, #d32f2f)',
    color: 'white'
  };

  const faceRecognitionButtonStyle = {
    ...buttonStyle,
    background: faceRecognitionEnabled 
      ? 'linear-gradient(45deg, #2196F3, #1976D2)' 
      : 'rgba(255, 255, 255, 0.2)',
    color: 'white'
  };

  return (
    <div style={controlsStyle}>
      <button onClick={onToggleVideo} style={secondaryButtonStyle}>
        📹 Toggle Video
      </button>
      
      <button onClick={onToggleAudio} style={secondaryButtonStyle}>
        🎤 Toggle Audio
      </button>
      
      <button 
        onClick={onToggleFaceRecognition} 
        style={faceRecognitionButtonStyle}
        title="Toggle face recognition and attention monitoring"
      >
        👤 Face Recognition {faceRecognitionEnabled ? 'ON' : 'OFF'}
      </button>
      
      <button onClick={onViewReport} style={primaryButtonStyle}>
        📊 View Report
      </button>
      
      <button onClick={onEndCall} style={dangerButtonStyle}>
        📞 End Call
      </button>
    </div>
  );
};

export default FaceRecognitionPanel;