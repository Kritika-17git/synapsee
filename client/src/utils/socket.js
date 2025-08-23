import { io } from 'socket.io-client';

// Try to import getToken, fallback to localStorage if not available
let getToken;
try {
  ({ getToken } = require('./auth.js'));
} catch (e) {
  getToken = null;
}

// Socket configuration
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:5000';

class SocketManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
  }

  // Initialize socket connection with authentication
  connect() {
    if (!this.socket) {
      // Try to get token from getToken, fallback to localStorage
      let token = getToken ? getToken() : null;
      if (!token) {
        token = localStorage.getItem('token');
      }

      if (!token) {
        console.error('No authentication token available');
        throw new Error('No authentication token available');
      }

      console.log('Connecting to socket server:', SOCKET_URL);

      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        auth: {
          token: token
        }
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to server:', this.socket.id);
        this.connected = true;
        this.authenticated = true;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from server:', reason);
        this.connected = false;
        this.authenticated = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error.message);
        this.connected = false;
        this.authenticated = false;
        
        if (error.message.includes('Authentication') || error.message.includes('Unauthorized')) {
          // Token might be expired, redirect to login
          console.error('Authentication failed, redirecting to login');
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected after', attemptNumber, 'attempts');
        this.connected = true;
        this.authenticated = true;
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('❌ Reconnection error:', error);
      });
    }
    
    return this.socket;
  }

  // Check if connected and authenticated
  isReady() {
    return this.socket && this.connected && this.authenticated;
  }

  // Join a room
  joinRoom(roomId) {
    if (this.isReady()) {
      console.log('🏠 Joining room:', roomId);
      this.socket.emit('join-room', roomId);
    } else {
      console.error('❌ Cannot join room - socket not ready');
    }
  }

  // Send WebRTC offer
  sendOffer(offer, targetSocketId) {
    if (this.isReady()) {
      console.log('📞 Sending offer to:', targetSocketId);
      this.socket.emit('offer', { offer, target: targetSocketId });
    }
  }

  // Send WebRTC answer
  sendAnswer(answer, targetSocketId) {
    if (this.isReady()) {
      console.log('📞 Sending answer to:', targetSocketId);
      this.socket.emit('answer', { answer, target: targetSocketId });
    }
  }

  // Send ICE candidate
  sendIceCandidate(candidate, targetSocketId) {
    if (this.isReady()) {
      this.socket.emit('ice-candidate', { candidate, target: targetSocketId });
    }
  }

  // Connection event listeners (these were missing!)
  onConnect(callback) {
    this.socket?.on('connect', callback);
  }

  onDisconnect(callback) {
    this.socket?.on('disconnect', callback);
  }

  onConnectError(callback) {
    this.socket?.on('connect_error', callback);
  }

  // WebRTC event listeners
  onUserJoined(callback) {
    this.socket?.on('user-joined', callback);
  }

  onUserLeft(callback) {
    this.socket?.on('user-left', callback);
  }

  onExistingUsers(callback) {
    this.socket?.on('existing-users', callback);
  }

  onRoomInfo(callback) {
    this.socket?.on('room-info', callback);
  }

  onOffer(callback) {
    this.socket?.on('offer', callback);
  }

  onAnswer(callback) {
    this.socket?.on('answer', callback);
  }

  onIceCandidate(callback) {
    this.socket?.on('ice-candidate', callback);
  }

  // User status event listeners
  onUserOnline(callback) {
    this.socket?.on('user-online', callback);
  }

  onUserOffline(callback) {
    this.socket?.on('user-offline', callback);
  }

  // Face recognition event listeners
  onFaceRecognitionData(callback) {
    this.socket?.on('face-recognition-data', callback);
  }

  onPersonalFaceData(callback) {
    this.socket?.on('personal-face-data', callback);
  }

  // Send face recognition frame
  sendFaceRecognitionFrame(data) {
    if (this.isReady()) {
      this.socket.emit('face-recognition-frame', data);
    }
  }

  // Toggle face recognition
  toggleFaceRecognition(enabled) {
    if (this.isReady()) {
      this.socket.emit('toggle-face-recognition', enabled);
    }
  }

  // End session
  endSession() {
    if (this.isReady()) {
      this.socket.emit('end-session');
    }
  }

  // Remove all event listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  // Cleanup
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.authenticated = false;
    }
  }
}

export default new SocketManager()