import { useState, useEffect, useRef, useCallback } from 'react';
import socketManager from '../utils/socket.js';
import { useAuth } from '../context/AuthContext.js';

// WebRTC configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
};

const useWebRTC = (roomId) => {
  const { user, isAuthenticated } = useAuth();
  
  // State management
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [peers, setPeers] = useState(new Map());
  const [roomInfo, setRoomInfo] = useState(null);
  const [socket, setSocket] = useState(null); // Add socket to state

  // Refs for persistent data
  const peerConnections = useRef(new Map());
  const localStreamRef = useRef(null);

  // Enhanced media access with fallbacks and better error handling
  const initializeLocalStream = useCallback(async () => {
    try {
      // First, check if devices are available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      const hasMicrophone = devices.some(device => device.kind === 'audioinput');
      
      console.log('Available devices:', { hasCamera, hasMicrophone });
      
      // Try different constraint levels, starting with ideal and falling back
      const constraintLevels = [
        // Level 1: High quality (your current settings)
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        },
        // Level 2: Medium quality
        {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        },
        // Level 3: Basic quality
        {
          video: {
            width: { max: 640 },
            height: { max: 480 }
          },
          audio: true
        },
        // Level 4: Video only if camera available
        hasCamera ? { video: true, audio: false } : null,
        // Level 5: Audio only if microphone available  
        hasMicrophone ? { video: false, audio: true } : null,
        // Level 6: Basic fallback
        { video: true, audio: true }
      ].filter(Boolean);

      let stream = null;
      let lastError = null;

      for (let i = 0; i < constraintLevels.length; i++) {
        try {
          console.log(`Trying constraint level ${i + 1}:`, constraintLevels[i]);
          stream = await navigator.mediaDevices.getUserMedia(constraintLevels[i]);
          
          if (stream && stream.getTracks().length > 0) {
            console.log('✅ Successfully got media stream with constraint level', i + 1);
            console.log('Stream tracks:', stream.getTracks().map(track => ({
              kind: track.kind,
              enabled: track.enabled,
              readyState: track.readyState,
              label: track.label
            })));
            break;
          }
        } catch (err) {
          console.warn(`❌ Constraint level ${i + 1} failed:`, err.message);
          lastError = err;
          
          // If it's a "device in use" error, try to handle it
          if (err.name === 'NotReadableError' || err.message.includes('device in use')) {
            // Try to release any existing tracks first
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach(track => {
                track.stop();
              });
              localStreamRef.current = null;
              setLocalStream(null);
            }
            
            // Wait a moment before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          continue;
        }
      }

      if (!stream) {
        throw lastError || new Error('Failed to access media devices with all constraint levels');
      }

      // Additional error handling for stream
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          console.warn(`${track.kind} track ended unexpectedly`);
          setError(`${track.kind === 'video' ? 'Camera' : 'Microphone'} access lost`);
        });
      });

      setLocalStream(stream);
      localStreamRef.current = stream;
      setError(null); // Clear any previous errors
      return stream;

    } catch (err) {
      console.error('❌ Error accessing media devices:', err);
      
      let errorMessage = 'Failed to access camera/microphone.';
      
      switch (err.name) {
        case 'NotAllowedError':
          errorMessage = 'Camera/microphone access denied. Please allow permissions and refresh the page.';
          break;
        case 'NotFoundError':
          errorMessage = 'No camera/microphone found. Please connect a media device.';
          break;
        case 'NotReadableError':
          errorMessage = 'Camera/microphone is in use by another application. Please close other video calling apps and try again.';
          break;
        case 'OverconstrainedError':
          errorMessage = 'Camera/microphone settings not supported. Trying with basic settings...';
          break;
        case 'AbortError':
          errorMessage = 'Media access aborted. Please try again.';
          break;
        case 'TypeError':
          errorMessage = 'Media devices not supported in this browser.';
          break;
        default:
          if (err.message.includes('device in use')) {
            errorMessage = 'Camera/microphone is busy. Close other applications using your camera/microphone and try again.';
          } else if (err.message.includes('permission')) {
            errorMessage = 'Please allow camera and microphone permissions.';
          }
      }
      
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Create peer connection for a specific socket
  const createPeerConnection = useCallback((targetSocketId, isInitiator = false) => {
    try {
      const pc = new RTCPeerConnection(rtcConfig);
      
      // Add local stream tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Received remote stream from:', targetSocketId);
        const [remoteStream] = event.streams;
        setRemoteStreams(prev => new Map(prev.set(targetSocketId, remoteStream)));
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketManager.sendIceCandidate(event.candidate, targetSocketId);
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${targetSocketId}:`, pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          setPeers(prev => new Map(prev.set(targetSocketId, { 
            connected: true,
            socketId: targetSocketId 
          })));
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setPeers(prev => {
            const newPeers = new Map(prev);
            newPeers.delete(targetSocketId);
            return newPeers;
          });
          
          setRemoteStreams(prev => {
            const newStreams = new Map(prev);
            newStreams.delete(targetSocketId);
            return newStreams;
          });
        }
      };

      peerConnections.current.set(targetSocketId, pc);
      return pc;
    } catch (err) {
      console.error('Error creating peer connection:', err);
      setError('Failed to create peer connection');
      return null;
    }
  }, []);

  // Handle incoming offer
  const handleOffer = useCallback(async (data) => {
    const { offer, from, fromUser } = data;
    console.log('Received offer from:', fromUser?.username || from);

    try {
      const pc = createPeerConnection(from, false);
      if (!pc) return;

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketManager.sendAnswer(answer, from);
      
      // Store user info for this peer
      setPeers(prev => new Map(prev.set(from, { 
        connected: false, 
        socketId: from,
        user: fromUser
      })));
    } catch (err) {
      console.error('Error handling offer:', err);
      setError('Failed to handle incoming call');
    }
  }, [createPeerConnection]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (data) => {
    const { answer, from, fromUser } = data;
    console.log('Received answer from:', fromUser?.username || from);

    try {
      const pc = peerConnections.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(answer);
        
        // Update peer info
        setPeers(prev => new Map(prev.set(from, {
          ...prev.get(from),
          user: fromUser
        })));
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async (data) => {
    const { candidate, from } = data;

    try {
      const pc = peerConnections.current.get(from);
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(candidate);
      }
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
    }
  }, []);

  // Handle new user joining
  const handleUserJoined = useCallback(async (userData) => {
    console.log('User joined:', userData.username);
    
    try {
      const pc = createPeerConnection(userData.socketId, true);
      if (!pc) return;

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await pc.setLocalDescription(offer);
      socketManager.sendOffer(offer, userData.socketId);
      
      // Store user info
      setPeers(prev => new Map(prev.set(userData.socketId, {
        connected: false,
        socketId: userData.socketId,
        user: userData
      })));
    } catch (err) {
      console.error('Error handling user joined:', err);
    }
  }, [createPeerConnection]);

  // Handle user leaving
  const handleUserLeft = useCallback((userData) => {
    console.log('User left:', userData.username);
    
    // Close peer connection
    const pc = peerConnections.current.get(userData.socketId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(userData.socketId);
    }

    // Remove from state
    setPeers(prev => {
      const newPeers = new Map(prev);
      newPeers.delete(userData.socketId);
      return newPeers;
    });
    
    setRemoteStreams(prev => {
      const newStreams = new Map(prev);
      newStreams.delete(userData.socketId);
      return newStreams;
    });
  }, []);

  // Handle existing users in room
  const handleExistingUsers = useCallback((users) => {
    console.log('Existing users:', users);
    users.forEach(userData => {
      setPeers(prev => new Map(prev.set(userData.socketId, {
        connected: false,
        socketId: userData.socketId,
        user: userData
      })));
    });
  }, []);

  // Handle room info
  const handleRoomInfo = useCallback((info) => {
    console.log('Room info:', info);
    setRoomInfo(info);
  }, []);

  // Handle socket connection status
  const handleConnect = useCallback(() => {
    console.log('Socket connected');
    setIsConnected(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log('Socket disconnected');
    setIsConnected(false);
    setError('Connection lost');
  }, []);

  const handleConnectError = useCallback((error) => {
    console.error('Socket connection error:', error);
    setError('Failed to connect to server');
    setIsConnected(false);
  }, []);

  // Enhanced connect function with better error handling
  const connect = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setError('Not authenticated');
      return;
    }

    try {
      console.log('🔗 Connecting to room:', roomId);
      setError(null);
      
      // Check if we already have a connection
      if (socket && isConnected) {
        console.log('Already connected, skipping connection attempt');
        return;
      }
      
      // Initialize socket connection first
      const socketInstance = socketManager.connect();
      setSocket(socketInstance);
      
      // Set up socket event listeners
      socketManager.onConnect(handleConnect);
      socketManager.onDisconnect(handleDisconnect);  
      socketManager.onConnectError(handleConnectError);
      socketManager.onOffer(handleOffer);
      socketManager.onAnswer(handleAnswer);
      socketManager.onIceCandidate(handleIceCandidate);
      socketManager.onUserJoined(handleUserJoined);
      socketManager.onUserLeft(handleUserLeft);
      socketManager.onExistingUsers(handleExistingUsers);
      socketManager.onRoomInfo(handleRoomInfo);

      // Try to initialize local stream with retries
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await initializeLocalStream();
          break; // Success, exit retry loop
        } catch (streamError) {
          retryCount++;
          console.warn(`Media stream attempt ${retryCount} failed:`, streamError.message);
          
          if (retryCount === maxRetries) {
            // On final failure, continue without media stream
            console.warn('⚠️ Continuing without local media stream');
            setError(`Media access failed: ${streamError.message}. You can join the call but others won't see/hear you.`);
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      // Wait for stream to be ready if we have one
      if (localStreamRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Join room
      socketManager.joinRoom(roomId);
      
    } catch (err) {
      console.error('❌ Error connecting:', err);
      setError(`Failed to connect: ${err.message}`);
    }
  }, [roomId, user, isAuthenticated, socket, isConnected, handleConnect, handleDisconnect, 
      handleConnectError, handleOffer, handleAnswer, handleIceCandidate, handleUserJoined, 
      handleUserLeft, handleExistingUsers, handleRoomInfo, initializeLocalStream]);

  // Disconnect from call
  const disconnect = useCallback(() => {
    console.log('Disconnecting from call');
    
    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Disconnect socket
    socketManager.disconnect();

    // Reset state
    setLocalStream(null);
    setRemoteStreams(new Map());
    setPeers(new Map());
    setRoomInfo(null);
    setIsConnected(false);
    setSocket(null);
    localStreamRef.current = null;
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }, []);

  // Add a function to retry media access
  const retryMediaAccess = useCallback(async () => {
    try {
      setError(null);
      
      // Stop existing stream first
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try again
      await initializeLocalStream();
      
      console.log('✅ Media access retry successful');
    } catch (err) {
      console.error('❌ Media access retry failed:', err);
      setError(`Retry failed: ${err.message}`);
    }
  }, [initializeLocalStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    localStream,
    remoteStreams,
    isConnected,
    error,
    peers,
    roomInfo,
    socket,
    connect,
    disconnect,
    toggleVideo,
    toggleAudio,
    retryMediaAccess // Add this new function
  };
};

export default useWebRTC;