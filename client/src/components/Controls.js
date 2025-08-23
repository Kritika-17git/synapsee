import React, { useState } from 'react';

// Control buttons component
const Controls = ({ 
  onToggleVideo, 
  onToggleAudio, 
  onEndCall, 
  isConnected 
}) => {
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const handleToggleVideo = () => {
    setVideoEnabled(prev => !prev);
    onToggleVideo();
  };

  const handleToggleAudio = () => {
    setAudioEnabled(prev => !prev);
    onToggleAudio();
  };

  const controlsStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  };

  const buttonBaseStyle = {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    transition: 'all 0.3s ease',
    fontWeight: 'bold'
  };

  const videoButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: videoEnabled ? '#4CAF50' : '#f44336',
    color: 'white'
  };

  const audioButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: audioEnabled ? '#2196F3' : '#f44336',
    color: 'white'
  };

  const endCallStyle = {
    ...buttonBaseStyle,
    backgroundColor: '#f44336',
    color: 'white',
    width: '64px',
    height: '64px'
  };

  return (
    <div style={controlsStyle}>
      <button
        onClick={handleToggleVideo}
        style={videoButtonStyle}
        title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
        disabled={!isConnected}
      >
        {videoEnabled ? '📹' : '📷'}
      </button>
      
      <button
        onClick={handleToggleAudio}
        style={audioButtonStyle}
        title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        disabled={!isConnected}
      >
        {audioEnabled ? '🎤' : '🔇'}
      </button>
      
      <button
        onClick={onEndCall}
        style={endCallStyle}
        title="End call"
      >
        📞
      </button>
    </div>
  );
};

export default Controls;