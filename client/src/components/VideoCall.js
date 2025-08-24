// import React, { useRef, useEffect } from 'react';

// // Video component for displaying local or remote stream
// const VideoCall = ({ 
//   stream, 
//   isLocal = false, 
//   muted = false, 
//   userId = '', 
//   className = '' 
// }) => {
//   const videoRef = useRef(null);

//   // Set video stream when component mounts or stream changes
//   useEffect(() => {
//     if (videoRef.current && stream) {
//       videoRef.current.srcObject = stream;
//     }
//   }, [stream]);

//   const videoStyle = {
//     width: '100%',
//     height: '100%',
//     objectFit: 'cover',
//     borderRadius: '12px',
//     backgroundColor: '#1a1a1a',
//     transform: isLocal ? 'scaleX(-1)' : 'none' // Mirror local video
//   };

//   const containerStyle = {
//     position: 'relative',
//     borderRadius: '12px',
//     overflow: 'hidden',
//     boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
//     border: '2px solid rgba(255, 255, 255, 0.1)',
//     backgroundColor: '#1a1a1a'
//   };

//   const labelStyle = {
//     position: 'absolute',
//     bottom: '12px',
//     left: '12px',
//     background: 'rgba(0, 0, 0, 0.7)',
//     color: 'white',
//     padding: '4px 8px',
//     borderRadius: '6px',
//     fontSize: '12px',
//     fontWeight: '500'
//   };

//   return (
//     <div className={className} style={containerStyle}>
//       <video
//         ref={videoRef}
//         autoPlay
//         playsInline
//         muted={muted}
//         style={videoStyle}
//       />
//       <div style={labelStyle}>
//         {isLocal ? 'You' : userId || 'Remote User'}
//       </div>
//     </div>
//   );
// };

// export default VideoCall;


import React, { useRef, useEffect } from 'react';

// Video component for displaying local or remote stream
const VideoCall = ({ 
  stream, 
  isLocal = false, 
  muted = false, 
  userId = '', 
  className = '' 
}) => {
  const videoRef = useRef(null);

  // Attach video stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const videoStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '16px',
    backgroundColor: '#181a1aff', // dark navy fallback
    transform: isLocal ? 'scaleX(-1)' : 'none', // Mirror local video
  };

  const containerStyle = {
    position: 'relative',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
    border: '1.5px solid rgba(255, 255, 255, 0.15)',
    background: 'linear-gradient(135deg, #181a1aff 0%, #001017ff 100%)',
  };

  const labelStyle = {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    background: 'rgba(17, 37, 65, 0.85)',
    color: '#e0e6ed',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    letterSpacing: '0.3px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(6px)',
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
    </div>
  );
};

export default VideoCall;
