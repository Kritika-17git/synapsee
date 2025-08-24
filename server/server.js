import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';
import { networkInterfaces } from 'os';
import WebSocket from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import axios from 'axios';
import morgan from 'morgan';

const app = express();
const server = createServer(app);

// Import modules - these will be initialized after DB connection
let connectDB, User, AttentionReport, authenticateSocket, authRoutes, userRoutes, reportRoutes;

// CORS configuration - moved to top and fixed
const corsOptions = {
  origin: function (origin, callback) {
    console.log('CORS check for origin:', origin);
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/,
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$/,
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}:3000$/
    ];
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      return allowed.test(origin);
    });
    
    console.log('CORS allowed:', isAllowed);
    callback(null, isAllowed); // Don't throw error, just return false
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control'
  ],
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
};

// Apply CORS very early - before any other middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight for all routes

// Add explicit preflight handling for problematic routes
app.options('/api/*', cors(corsOptions));

// Improved Helper function to update attention reports with debug and roomId
// Replace your updateAttentionReport function with this version:
async function updateAttentionReport(sessionId, user, faceData, roomId = null) {
  try {
    console.log('=== UPDATE ATTENTION REPORT DEBUG ===');
    console.log('SessionId:', sessionId);
    console.log('User:', user ? user.username : 'undefined');
    console.log('RoomId:', roomId);
    
    const now = new Date();
    
    // IMPORTANT: Find session by EXACT sessionId match, not just any active session
    let report = await AttentionReport.findOne({
      sessionId: sessionId  // Remove isActive: true to find the exact session
    });
    
    console.log('Existing report found:', !!report);
    console.log('Report sessionId if found:', report ? report.sessionId : 'none');
    
    if (!report) {
      // Create new report with unique session identifier
      const reportData = {
        sessionId: sessionId, // This should be unique for each meeting
        roomId: roomId || sessionId,
        sessionName: `Meeting ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        createdBy: user._id,
        startTime: now,
        isActive: true,
        participants: [{
          userId: user._id,
          name: `${user.firstName} ${user.lastName}`,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          joinedAt: now
        }]
      };
      
      console.log('Creating NEW report with sessionId:', sessionId);
      report = new AttentionReport(reportData);
    } else {
      console.log('Using EXISTING report from:', report.startTime);
      
      // If this is an old session (more than 1 hour old), create a new one instead
      const sessionAge = (now - new Date(report.startTime)) / (1000 * 60 * 60); // hours
      if (sessionAge > 1) {
        console.log('Session too old (', sessionAge, 'hours), creating new session');
        
        // End the old session
        report.isActive = false;
        report.endTime = new Date(report.updatedAt || report.startTime);
        await report.save();
        
        // Create completely new session
        const newReportData = {
          sessionId: sessionId + '_' + Date.now(), // Make it unique
          roomId: roomId || sessionId,
          sessionName: `Meeting ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
          createdBy: user._id,
          startTime: now,
          isActive: true,
          participants: [{
            userId: user._id,
            name: `${user.firstName} ${user.lastName}`,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            joinedAt: now
          }]
        };
        
        report = new AttentionReport(newReportData);
        console.log('Created fresh session with ID:', report.sessionId);
      }
    }
    
    // Add participant if not exists
    const participantExists = report.participants.some(p => 
      p.userId.toString() === user._id.toString()
    );
    
    if (!participantExists) {
      console.log('Adding new participant:', user.username);
      report.participants.push({
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        joinedAt: now
      });
    }
    
    // Update attention data if provided
    if (faceData) {
      console.log('Updating face data for user:', user.username);
      const participant = report.participants.find(p => 
        p.userId.toString() === user._id.toString()
      );
      
      if (participant) {
        participant.totalFrames = (participant.totalFrames || 0) + 1;
        if (faceData.face_detected) {
          participant.faceDetectedFrames = (participant.faceDetectedFrames || 0) + 1;
        }
        participant.attentionScore = faceData.attention_score || participant.attentionScore || 0;
        
        // Calculate attention grade
        const score = participant.attentionScore;
        if (score >= 90) {
          participant.attentionGrade = { grade: 'A', label: 'Excellent', color: '#4CAF50' };
        } else if (score >= 80) {
          participant.attentionGrade = { grade: 'B', label: 'Good', color: '#8BC34A' };
        } else if (score >= 70) {
          participant.attentionGrade = { grade: 'C', label: 'Average', color: '#FFC107' };
        } else if (score >= 60) {
          participant.attentionGrade = { grade: 'D', label: 'Below Average', color: '#FF9800' };
        } else if (score >= 50) {
          participant.attentionGrade = { grade: 'E', label: 'Poor', color: '#FF5722' };
        } else {
          participant.attentionGrade = { grade: 'F', label: 'Very Poor', color: '#F44336' };
        }
      }
    }
    
    // Calculate overall attention score
    if (report.participants.length > 0) {
      const totalScore = report.participants.reduce((sum, p) => sum + (p.attentionScore || 0), 0);
      report.overallAttentionScore = Math.round(totalScore / report.participants.length);
    }
    
    console.log('Saving report with sessionId:', report.sessionId);
    const savedReport = await report.save();
    console.log('Report saved successfully with ID:', savedReport._id);
    console.log('=== END DEBUG ===');
    
    return savedReport;
  } catch (error) {
    console.error('=== ERROR IN UPDATE ATTENTION REPORT ===');
    console.error('Error details:', error);
    throw error;
  }
}
// Python Face Recognition Service Management
class FaceRecognitionService {
  constructor() {
    this.pythonProcess = null;
    this.isRunning = false;
    this.startupPromise = null;
  }

  async start() {
    if (this.startupPromise) {
      return this.startupPromise;
    }

    // First try to kill any existing processes on ports 8000 and 8001
    await this.killExistingProcesses();

    this.startupPromise = new Promise((resolve, reject) => {
      console.log('Starting Python Face Recognition Service...');
      
      const pythonPath = process.env.PYTHON_PATH || 'python';
      const scriptPath = path.join(process.cwd(), '../python-face-recognition/server.py');
      
      this.pythonProcess = spawn(pythonPath, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.join(process.cwd(), '../python-face-recognition')
      });

      let hasResolved = false;

      this.pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[Python Service]:', output);
        
        if (output.includes('Starting Enhanced Face Recognition') && !hasResolved) {
          this.isRunning = true;
          hasResolved = true;
          resolve();
        }
      });

      this.pythonProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('[Python Service Error]:', error);
        
        // Handle port binding errors
        if (error.includes('Errno 10048') || error.includes('Address already in use')) {
          console.log('🔄 Port conflict detected, attempting to resolve...');
          if (!hasResolved) {
            hasResolved = true;
            reject(new Error('Port already in use'));
          }
        }
      });

      this.pythonProcess.on('close', (code) => {
        console.log(`Python service exited with code ${code}`);
        this.isRunning = false;
        this.pythonProcess = null;
        if (!hasResolved && code !== 0) {
          hasResolved = true;
          reject(new Error(`Python service exited with code ${code}`));
        }
      });

      this.pythonProcess.on('error', (error) => {
        console.error('Failed to start Python service:', error);
        if (!hasResolved) {
          hasResolved = true;
          reject(error);
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.isRunning && !hasResolved) {
          hasResolved = true;
          reject(new Error('Python service startup timeout'));
        }
      }, 30000);
    });

    return this.startupPromise;
  }

  async killExistingProcesses() {
    console.log('🔍 Checking for existing Python processes on ports 8000, 8001...');
    
    try {
      // Kill processes on ports 8000 and 8001
      const { spawn } = await import('child_process');
      const os = await import('os');
      
      if (os.platform() === 'win32') {
        // Windows commands
        const killPort8000 = spawn('cmd', ['/c', 'for /f "tokens=5" %a in (\'netstat -aon ^| find ":8000" ^| find "LISTENING"\') do taskkill /f /pid %a'], {
          stdio: 'ignore'
        });
        
        const killPort8001 = spawn('cmd', ['/c', 'for /f "tokens=5" %a in (\'netstat -aon ^| find ":8001" ^| find "LISTENING"\') do taskkill /f /pid %a'], {
          stdio: 'ignore'
        });
        
        await new Promise(resolve => {
          let finished = 0;
          killPort8000.on('close', () => { finished++; if (finished === 2) resolve(); });
          killPort8001.on('close', () => { finished++; if (finished === 2) resolve(); });
        });
      } else {
        // Unix/Linux commands
        spawn('pkill', ['-f', 'server.py'], { stdio: 'ignore' });
        spawn('lsof', ['-ti:8000'], { stdio: 'pipe' }).stdout.on('data', (data) => {
          spawn('kill', ['-9', data.toString().trim()], { stdio: 'ignore' });
        });
        spawn('lsof', ['-ti:8001'], { stdio: 'pipe' }).stdout.on('data', (data) => {
          spawn('kill', ['-9', data.toString().trim()], { stdio: 'ignore' });
        });
      }
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ Port cleanup completed');
      
    } catch (error) {
      console.log('⚠️ Port cleanup failed, continuing anyway:', error.message);
    }
  }

  async stop() {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
      this.isRunning = false;
    }
  }

  async checkHealth() {
    if (!this.isRunning) return false;
    
    try {
      const response = await axios.get('http://localhost:8000/', { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

const faceRecognitionService = new FaceRecognitionService();

// Store active rooms, users, and face recognition sessions
const rooms = new Map();
const authenticatedUsers = new Map();
const faceRecognitionSessions = new Map(); // socketId -> WebSocket connection to Python

// Face recognition WebSocket proxy
const createFaceRecognitionConnection = (socketId, roomId, user) => {
  if (!faceRecognitionService.isRunning) {
    console.error('Face recognition service not running');
    return null;
  }

  try {
    const ws = new WebSocket('ws://localhost:8001');
    
    ws.on('open', () => {
      console.log(`Face recognition connection established for user ${user.username}`);
      faceRecognitionSessions.set(socketId, ws);
    });

    ws.on('message', (data) => {
      try {
        const faceData = JSON.parse(data.toString());
        
        // Get the io instance (will be available after initialization)
        const io = server.io;
        if (!io) return;
        
        // Broadcast face recognition data to room
        io.to(roomId).emit('face-recognition-data', {
          userId: user._id,
          username: user.username,
          socketId: socketId,
          ...faceData
        });
        
        // Send individual data back to user
        io.to(socketId).emit('personal-face-data', faceData);
      } catch (error) {
        console.error('Error parsing face recognition data:', error);
      }
    });

    ws.on('close', () => {
      console.log(`Face recognition connection closed for ${user.username}`);
      faceRecognitionSessions.delete(socketId);
    });

    ws.on('error', (error) => {
      console.error('Face recognition WebSocket error:', error);
      faceRecognitionSessions.delete(socketId);
    });

    return ws;
  } catch (error) {
    console.error('Error creating face recognition connection:', error);
    return null;
  }
};

// Initialize server function
async function initializeServer() {
  try {
    console.log('🚀 Initializing Enhanced Video Call Server...');
    
    // 1. Load and connect database
    console.log('📦 Loading database...');
    const dbModule = await import('./config/database.js');
    connectDB = dbModule.default;
    await connectDB();
    console.log('✅ Database connected');
    
    // 2. Load models
    console.log('📦 Loading models...');
    const userModule = await import('./models/User.js');
    const reportModule = await import('./models/AttentionReport.js');
    User = userModule.default;
    AttentionReport = reportModule.default;
    console.log('✅ Models loaded');
    
    // 3. Load middleware and routes
    console.log('📦 Loading middleware and routes...');
    
    try {
      const authMiddleware = await import('./middleware/auth.js');
      authenticateSocket = authMiddleware.authenticateSocket;
      console.log('✅ Auth middleware loaded');
    } catch (error) {
      console.error('❌ Auth middleware loading failed:', error);
      throw error;
    }
    
    try {
      const authRoutesModule = await import('./routes/auth.js');
      authRoutes = authRoutesModule.default;
      console.log('✅ Auth routes loaded:', typeof authRoutes);
    } catch (error) {
      console.error('❌ Auth routes loading failed:', error);
      throw error;
    }
    
    try {
      const userRoutesModule = await import('./routes/users.js');
      userRoutes = userRoutesModule.default;
      console.log('✅ User routes loaded:', typeof userRoutes);
    } catch (error) {
      console.error('❌ User routes loading failed:', error);
      throw error;
    }
    
    try {
      const reportRoutesModule = await import('./routes/reports.js');
      reportRoutes = reportRoutesModule.default;
      console.log('✅ Report routes loaded:', typeof reportRoutes);
    } catch (error) {
      console.error('❌ Report routes loading failed:', error);
      throw error;
    }
    
    // 4. Setup basic middleware
    console.log('⚙️ Configuring middleware...');
    
    // Add logging middleware first
    app.use(morgan('combined'));
    
    // Basic express middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    
    // Security middleware (after CORS)
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false
    }));

    // Rate limiting (apply after CORS)
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: process.env.NODE_ENV === 'production' ? 100 : 1000,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    app.use('/api/', limiter);
    
    console.log('✅ Middleware configured');
    
    // 5. Setup Socket.IO
    console.log('🔌 Configuring Socket.IO...');
    const io = new Server(server, {
      cors: corsOptions,
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Store io instance on server for access in other functions
    server.io = io;

    // Socket authentication middleware (fix: only use if function)
    if (typeof authenticateSocket === 'function') {
      io.use(authenticateSocket);
    } else {
      console.error('❌ authenticateSocket is not a function. Skipping io.use(authenticateSocket).');
    }

    // Socket.io connection handling
    io.on('connection', async (socket) => {
      const user = socket.user;
      if (!user) {
        console.error(`❌ Socket connected without authentication: ${socket.id}. Disconnecting.`);
        socket.disconnect(true);
        return;
      }
      console.log(`Authenticated user connected: ${user.username} (${socket.id})`);

      authenticatedUsers.set(socket.id, user);

      socket.broadcast.emit('user-online', {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar
      });

      // Join room with face recognition setup
      socket.on('join-room', async (roomId) => {
        console.log(`User ${user.username} joining room ${roomId}`);
        
        // Leave previous room
        const previousRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        if (previousRoom) {
          socket.leave(previousRoom);
          socket.to(previousRoom).emit('user-left', {
            socketId: socket.id,
            userId: user._id,
            username: user.username
          });
          
          // Close face recognition connection for previous room
          const prevFaceWs = faceRecognitionSessions.get(socket.id);
          if (prevFaceWs) {
            prevFaceWs.close();
          }
          
          if (rooms.has(previousRoom)) {
            const room = rooms.get(previousRoom);
            room.users.delete(socket.id);
            if (room.users.size === 0) {
              rooms.delete(previousRoom);
            }
          }
        }
        
        // Join new room
        socket.join(roomId);
        
        // Update room info
        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            id: roomId,
            users: new Map(),
            createdAt: new Date(),
            faceRecognitionEnabled: true
          });
        }
        
        const room = rooms.get(roomId);
        room.users.set(socket.id, {
          socketId: socket.id,
          userId: user._id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          joinedAt: new Date(),
          faceRecognitionActive: false
        });
        
        // Setup face recognition connection
        const faceWs = createFaceRecognitionConnection(socket.id, roomId, user);
        
        // Notify others
        socket.to(roomId).emit('user-joined', {
          socketId: socket.id,
          userId: user._id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar
        });
        
        // Send existing users
        const existingUsers = Array.from(room.users.values())
          .filter(u => u.socketId !== socket.id);
        
        socket.emit('existing-users', existingUsers);
        socket.emit('room-info', {
          roomId,
          userCount: room.users.size,
          users: Array.from(room.users.values()),
          faceRecognitionEnabled: room.faceRecognitionEnabled
        });
      });

      // Handle face recognition video frame
      socket.on('face-recognition-frame', async (data) => {
        const faceWs = faceRecognitionSessions.get(socket.id);
        if (faceWs && faceWs.readyState === WebSocket.OPEN) {
          try {
            // Prepare frame data for Python service
            const frameData = {
              session_id: data.roomId || 'unknown',
              participant_id: user._id.toString(),
              ts_ms: Date.now(),
              seq: data.seq || 0,
              w: data.width || 640,
              h: data.height || 480,
              fmt: 'jpeg',
              mode: data.mode || 'recognize',
              name: data.name || user.firstName + ' ' + user.lastName
            };

            const header = JSON.stringify(frameData) + '\n';
            const headerBuffer = Buffer.from(header);
            const imageBuffer = Buffer.from(data.imageData, 'base64');
            
            // Combine header and image data
            const packet = Buffer.concat([headerBuffer, imageBuffer]);
            
            faceWs.send(packet);
          } catch (error) {
            console.error('Error sending frame to face recognition service:', error);
          }
        }
      });

      // Toggle face recognition
      socket.on('toggle-face-recognition', (enabled) => {
        const userRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        if (userRoom && rooms.has(userRoom)) {
          const room = rooms.get(userRoom);
          const roomUser = room.users.get(socket.id);
          if (roomUser) {
            roomUser.faceRecognitionActive = enabled;
            
            // Notify room of face recognition status change
            socket.to(userRoom).emit('user-face-recognition-status', {
              socketId: socket.id,
              userId: user._id,
              username: user.username,
              faceRecognitionActive: enabled
            });
          }
        }
      });

      socket.on('face-recognition-data', async (faceData) => {
  try {
    console.log('Received face recognition data from user:', user.username);
    
    const userRoom = Array.from(socket.rooms).find(room => room !== socket.id);
    if (!userRoom) {
      console.error('User not in any room');
      return;
    }

    // Broadcast to room as before
    socket.to(userRoom).emit('face-recognition-data', {
      userId: user._id,
      username: user.username,
      socketId: socket.id,
      ...faceData
    });

    // Store/update in database with proper error handling
    try {
      const savedReport = await updateAttentionReport(userRoom, user, faceData, userRoom);
      console.log('Successfully saved attention data for session:', userRoom);
    } catch (dbError) {
      console.error('Database save failed:', dbError.message);
      // Optionally notify the client about the error
      socket.emit('error', {
        type: 'database_error',
        message: 'Failed to save attention data'
      });
    }
    
  } catch (error) {
    console.error('Error handling face recognition data:', error);
  }
});

      // Handle session end
      socket.on('end-session', async () => {
        try {
          const userRoom = Array.from(socket.rooms).find(room => room !== socket.id);
          if (userRoom && rooms.has(userRoom)) {
            // Mark session as ended
            await AttentionReport.findOneAndUpdate(
              { sessionId: userRoom,
                isActive: true 
               },
              { 
                isActive: false,
                endTime: new Date(),
                status: 'Completed'
              }
            );
            console.log(`Session ${userRoom} ended successfully`);
          }
        } catch (error) {
          console.error('Error ending session:', error);
        }
      });

      // WebRTC signaling
      socket.on('offer', (data) => {
        console.log(`Offer from ${user.username} to ${data.target}`);
        socket.to(data.target).emit('offer', {
          offer: data.offer,
          from: socket.id,
          fromUser: {
            id: user._id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName
          }
        });
      });

      socket.on('answer', (data) => {
        console.log(`Answer from ${user.username} to ${data.target}`);
        socket.to(data.target).emit('answer', {
          answer: data.answer,
          from: socket.id,
          fromUser: {
            id: user._id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName
          }
        });
      });

      socket.on('ice-candidate', (data) => {
        socket.to(data.target).emit('ice-candidate', {
          candidate: data.candidate,
          from: socket.id
        });
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log(`User ${user.username} disconnected: ${socket.id}`);
        
        // Close face recognition connection
        const faceWs = faceRecognitionSessions.get(socket.id);
        if (faceWs) {
          faceWs.close();
        }
        
        try {
          await User.findByIdAndUpdate(user._id, { socketId: null });
        } catch (error) {
          console.error('Error clearing socket ID:', error);
        }
        
        authenticatedUsers.delete(socket.id);
        
        const userRoom = Array.from(socket.rooms).find(room => room !== socket.id);
        if (userRoom && rooms.has(userRoom)) {
          const room = rooms.get(userRoom);
          room.users.delete(socket.id);
          
          socket.to(userRoom).emit('user-left', {
            socketId: socket.id,
            userId: user._id,
            username: user.username
          });
          
          if (room.users.size === 0) {
      try {
        await AttentionReport.findOneAndUpdate(
          { 
            sessionId: userRoom,
            isActive: true 
          },
          { 
            isActive: false,
            endTime: new Date(),
            status: 'Completed'
          }
        );
        console.log(`Auto-ended session ${userRoom} - no users remaining`);
      } catch (error) {
        console.error('Error auto-ending session:', error);
      }
      
      rooms.delete(userRoom);
    }
        }
        
        socket.broadcast.emit('user-offline', {
          id: user._id,
          username: user.username
        });
      });
    });
    
    console.log('✅ Socket.IO configured');
    
    // 6. Setup API routes
    console.log('🛣️ Setting up routes...');
    
    console.log('Loading auth routes...');
    if (!authRoutes) {
      throw new Error('Auth routes is undefined - check ./routes/auth.js export');
    }
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes mounted');
    
    console.log('Loading user routes...');
    if (!userRoutes) {
      throw new Error('User routes is undefined - check ./routes/users.js export');
    }
    app.use('/api/users', userRoutes);
    console.log('✅ User routes mounted');
    
    console.log('Loading report routes...');
    if (!reportRoutes) {
      throw new Error('Report routes is undefined - check ./routes/reports.js export');
    }
    app.use('/api/reports', reportRoutes);
    console.log('✅ Report routes mounted');

    // Face Recognition API Proxy
    app.get('/api/face-recognition/status', async (req, res) => {
      try {
        const isHealthy = await faceRecognitionService.checkHealth();
        res.json({
          success: true,
          data: {
            running: faceRecognitionService.isRunning,
            healthy: isHealthy
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Failed to check face recognition service status'
        });
      }
    });

    app.get('/api/face-recognition/report/:sessionId', async (req, res) => {
      try {
        const response = await axios.get('http://localhost:8000/attention-report', {
          timeout: 5000
        });
        res.json(response.data);
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Failed to fetch attention report',
          error: error.message
        });
      }
    });

    app.post('/api/face-recognition/reset', async (req, res) => {
      try {
        const response = await axios.post('http://localhost:8000/reset-attention', {}, {
          timeout: 5000
        });
        res.json(response.data);
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Failed to reset attention tracker',
          error: error.message
        });
      }
    });

    // Room management
    app.get('/api/rooms', async (req, res) => {
      const roomList = Array.from(rooms.values()).map(room => ({
        id: room.id,
        userCount: room.users.size,
        users: Array.from(room.users.values()).map(user => ({
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          faceRecognitionActive: user.faceRecognitionActive
        })),
        createdAt: room.createdAt,
        faceRecognitionEnabled: room.faceRecognitionEnabled
      }));

      res.json({
        success: true,
        data: {
          rooms: roomList,
          totalRooms: roomList.length,
          totalUsers: roomList.reduce((sum, room) => sum + room.userCount, 0),
          faceRecognitionStatus: {
            running: faceRecognitionService.isRunning,
            activeConnections: faceRecognitionSessions.size
          }
        }
      });
    });

    app.post('/api/rooms', async (req, res) => {
      const roomId = uuidv4();
      res.json({
        success: true,
        data: { roomId }
      });
    });

    // Network info
    app.get('/api/network-info', (req, res) => {
      const nets = networkInterfaces();
      const addresses = [];
      
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            addresses.push({
              name,
              address: net.address,
              url: `http://${net.address}:${process.env.PORT || 5000}`
            });
          }
        }
      }
      
      res.json({
        success: true,
        data: {
          addresses,
          port: process.env.PORT || 5000
        }
      });
    });

    // Health check

    app.get('/api/health', async (req, res) => {
      const faceRecognitionHealth = await faceRecognitionService.checkHealth();
      res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activeRooms: rooms.size,
        activeUsers: authenticatedUsers.size,
        faceRecognition: {
          running: faceRecognitionService.isRunning,
          healthy: faceRecognitionHealth,
          activeConnections: faceRecognitionSessions.size
        }
      });
    });

    // === Session Management Endpoints ===
    // End a session (mark as inactive)
    app.post('/api/sessions/:sessionId/end', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const report = await AttentionReport.findOneAndUpdate(
          { sessionId, isActive: true },
          { isActive: false, endTime: new Date(), status: 'Completed' },
          { new: true }
        );
        if (!report) {
          return res.status(404).json({ success: false, message: 'Session not found or already ended' });
        }
        res.json({ success: true, message: 'Session ended', data: report });
      } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to end session', error: error.message });
      }
    });

    // Get all active sessions
    app.get('/api/sessions/active', async (req, res) => {
      try {
        const activeSessions = await AttentionReport.find({ isActive: true });
        res.json({ success: true, data: activeSessions });
      } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch active sessions', error: error.message });
      }
    });

    // CORS error handler
    app.use((err, req, res, next) => {
      if (err.message && err.message.includes('CORS')) {
        return res.status(403).json({ 
          success: false, 
          message: 'CORS error - request not allowed',
          origin: req.headers.origin 
        });
      }
      console.error('Error:', err.stack);
      res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
      });
    });

    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });
    
    console.log('✅ Routes configured');
    
    return true;
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    throw error;
  }
}

// Server startup function
const startServer = async () => {
  try {
    // Initialize everything first
    await initializeServer();
    console.log('✅ Server initialization complete');
    
    // Start the main server first
    const PORT = process.env.PORT || 5000;
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Enhanced Video Call Server running on port ${PORT}`);
      console.log(`🌍 Local: http://localhost:${PORT}`);
      
      const nets = networkInterfaces();
      Object.keys(nets).forEach(name => {
        nets[name].forEach(net => {
          if (net.family === 'IPv4' && !net.internal) {
            console.log(`🌍 Network: http://${net.address}:${PORT}`);
          }
        });
      });
      
      console.log('📊 Features: Video Call + Attention Monitoring');
    });
    
    // Try to start face recognition service (non-blocking)
    try {
      console.log('🤖 Starting face recognition service...');
      await faceRecognitionService.start();
      console.log('✅ Face Recognition: Enabled');
    } catch (error) {
      console.error('⚠️ Face recognition service failed to start:', error.message);
      console.log('⚠️ Server will continue without face recognition features');
      console.log('💡 To fix: Kill any existing Python processes and restart the server');
      
      // Provide helpful commands
      if (process.platform === 'win32') {
        console.log('💡 Try: tasklist | findstr python');
        console.log('💡 Then: taskkill /f /pid <PID>');
      } else {
        console.log('💡 Try: pkill -f server.py');
        console.log('💡 Or: lsof -ti:8000,8001 | xargs kill -9');
      }
    }
    
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await faceRecognitionService.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await faceRecognitionService.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the server
startServer();