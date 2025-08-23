import asyncio
import websockets
import json
import base64
import cv2
import numpy as np
from datetime import datetime
import logging
from aiohttp import web
import aiohttp_cors
import sys
import traceback
import socket
import os
import dotenv

# Load environment variables from .env file
dotenv.load_dotenv()


# Fix Windows encoding issues
if sys.platform.startswith('win'):
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 🔧 FIX 1: IMPROVED PORT CHECKING WITH BETTER SOCKET HANDLING
def is_port_available(port, host='0.0.0.0'):
    """Check if a port is available with improved socket handling"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # Allow port reuse
            s.settimeout(2)
            result = s.connect_ex((host, port))
            return result != 0
    except Exception as e:
        logger.warning(f"Error checking port {port}: {e}")
        return False

# 🔧 FIX 2: ENHANCED PORT FINDING WITH WIDER RANGE
def find_available_port(start_port, max_attempts=50):
    """Find an available port with expanded search range"""
    logger.info(f"Searching for available port starting from {start_port}")
    
    for i in range(max_attempts):
        port = start_port + i
        if is_port_available(port):
            logger.info(f"Found available port: {port}")
            return port
        else:
            logger.debug(f"Port {port} is busy")
    
    raise Exception(f"No available port found in range {start_port}-{start_port + max_attempts}")

class FaceRecognitionService:
    def __init__(self):
        self.connected_clients = set()
        self.attention_data = {}
        self.face_cascade = None
        self.http_port = None
        self.ws_port = None
        self.http_runner = None
        self.ws_server = None
        self.initialize_opencv()
        
    def initialize_opencv(self):
        """Initialize OpenCV face detection"""
        try:
            # Try to load face cascade
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
            
            if self.face_cascade.empty():
                logger.error("Failed to load face cascade classifier")
                return False
            
            logger.info("OpenCV face detection initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Error initializing OpenCV: {e}")
            return False

    # 🔧 FIX 3: IMPROVED CONNECTION HANDLING WITH BETTER ERROR RECOVERY
    async def process_frame(self, websocket, path):
        """Handle WebSocket connections for face recognition"""
        client_ip = websocket.remote_address[0] if websocket.remote_address else "unknown"
        client_id = f"{client_ip}:{websocket.remote_address[1] if websocket.remote_address else 'unknown'}"
        
        self.connected_clients.add(websocket)
        logger.info(f"✅ New client connected: {client_id}. Total clients: {len(self.connected_clients)}")
        
        try:
            async for message in websocket:
                try:
                    # Handle both binary and text messages
                    if isinstance(message, bytes):
                        await self.process_binary_message(websocket, message)
                    else:
                        await self.process_text_message(websocket, message)
                        
                except Exception as e:
                    logger.error(f"❌ Error processing message from {client_id}: {e}")
                    try:
                        await websocket.send(json.dumps({
                            "error": f"Processing error: {str(e)}",
                            "timestamp": datetime.now().isoformat()
                        }))
                    except:
                        break  # Connection is likely closed
                        
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Client {client_id} disconnected normally")
        except websockets.exceptions.ConnectionClosedError:
            logger.info(f"🔌 Client {client_id} disconnected unexpectedly")
        except Exception as e:
            logger.error(f"❌ WebSocket error with {client_id}: {e}")
        finally:
            self.connected_clients.discard(websocket)
            logger.info(f"🧹 Cleaned up connection for {client_id}. Remaining: {len(self.connected_clients)}")
    
    async def process_binary_message(self, websocket, message):
        """Process binary message (header + image data)"""
        try:
            # Find the newline separator
            header_end = message.find(b'\n')
            if header_end == -1:
                await websocket.send(json.dumps({"error": "Invalid message format - no header separator"}))
                return
                
            header = message[:header_end].decode('utf-8')
            image_data = message[header_end + 1:]
            
            if not image_data:
                await websocket.send(json.dumps({"error": "No image data received"}))
                return
            
            # Parse header JSON
            try:
                frame_info = json.loads(header)
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                await websocket.send(json.dumps({"error": f"Invalid JSON in header: {str(e)}"}))
                return
            
            # Process the frame
            result = await self.analyze_frame(frame_info, image_data)
            
            # Send result back
            await websocket.send(json.dumps(result))
            
        except Exception as e:
            logger.error(f"❌ Binary message processing error: {e}")
            await websocket.send(json.dumps({"error": f"Binary processing error: {str(e)}"}))
    
    async def process_text_message(self, websocket, message):
        """Process text message (for commands or JSON data)"""
        try:
            data = json.loads(message)
            
            # Handle different message types
            if data.get('type') == 'ping':
                await websocket.send(json.dumps({
                    'type': 'pong',
                    'timestamp': datetime.now().isoformat()
                }))
            elif data.get('type') == 'status':
                await websocket.send(json.dumps({
                    'type': 'status_response',
                    'connected_clients': len(self.connected_clients),
                    'sessions': len(self.attention_data),
                    'timestamp': datetime.now().isoformat()
                }))
            else:
                await websocket.send(json.dumps({
                    "error": "Unknown message type", 
                    "received_type": data.get('type', 'none')
                }))
                
        except json.JSONDecodeError as e:
            await websocket.send(json.dumps({"error": f"Invalid JSON format: {str(e)}"}))
        except Exception as e:
            logger.error(f"❌ Text message processing error: {e}")
            await websocket.send(json.dumps({"error": f"Text processing error: {str(e)}"}))
    
    async def analyze_frame(self, frame_info, image_data):
        """Analyze face and attention in the frame"""
        try:
            # Decode image
            img_array = np.frombuffer(image_data, dtype=np.uint8)
            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            
            if frame is None:
                return {
                    "error": "Could not decode image - invalid image data", 
                    "timestamp": datetime.now().isoformat()
                }
            
            # Get frame info
            participant_id = frame_info.get('participant_id', 'unknown')
            session_id = frame_info.get('session_id', 'default')
            participant_name = frame_info.get('name', 'Unknown')
            
            # Initialize session data
            if session_id not in self.attention_data:
                self.attention_data[session_id] = {}
                logger.info(f"📊 Created new session: {session_id[:8]}...")
            
            if participant_id not in self.attention_data[session_id]:
                self.attention_data[session_id][participant_id] = {
                    'name': participant_name,
                    'total_frames': 0,
                    'face_detected_frames': 0,
                    'attention_score': 0,
                    'last_seen': None,
                    'session_start': datetime.now().isoformat()
                }
                logger.info(f"👤 Added participant: {participant_name} to session {session_id[:8]}...")
            
            participant_data = self.attention_data[session_id][participant_id]
            participant_data['total_frames'] += 1
            participant_data['last_seen'] = datetime.now().isoformat()
            
            # Detect faces
            faces = []
            face_count = 0
            
            if self.face_cascade is not None:
                try:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    detected_faces = self.face_cascade.detectMultiScale(
                        gray, 
                        scaleFactor=1.1, 
                        minNeighbors=4,
                        minSize=(30, 30)
                    )
                    
                    face_count = len(detected_faces)
                    
                    if face_count > 0:
                        participant_data['face_detected_frames'] += 1
                        
                        for (x, y, w, h) in detected_faces:
                            faces.append({
                                'x': int(x),
                                'y': int(y), 
                                'width': int(w),
                                'height': int(h),
                                'confidence': 0.85  # Haar cascades don't provide confidence
                            })
                except Exception as face_error:
                    logger.error(f"Face detection error: {face_error}")
            
            # Calculate attention score
            if participant_data['total_frames'] > 0:
                attention_score = (participant_data['face_detected_frames'] / participant_data['total_frames']) * 100
                participant_data['attention_score'] = round(attention_score, 2)
            
            # Determine attention level
            attention_level = "low"
            if participant_data['attention_score'] >= 80:
                attention_level = "high"
            elif participant_data['attention_score'] >= 60:
                attention_level = "medium"
            
            # Calculate session duration
            try:
                session_start = datetime.fromisoformat(participant_data['session_start'])
                session_duration = (datetime.now() - session_start).total_seconds()
            except:
                session_duration = 0
            
            result = {
                'timestamp': datetime.now().isoformat(),
                'session_id': session_id,
                'participant_id': participant_id,
                'participant_name': participant_name,
                'faces_detected': face_count,
                'faces': faces,
                'attention_score': participant_data['attention_score'],
                'attention_level': attention_level,
                'total_frames': participant_data['total_frames'],
                'face_detected_frames': participant_data['face_detected_frames'],
                'session_duration_seconds': round(session_duration),
                'frame_processed': True
            }
            
            # Log progress occasionally
            if participant_data['total_frames'] % 50 == 0:
                logger.info(f"📈 {participant_name} ({session_id[:8]}...): "
                          f"{participant_data['total_frames']} frames, "
                          f"{participant_data['attention_score']:.1f}% attention")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error in analyze_frame: {e}")
            traceback.print_exc()
            return {
                "error": f"Frame analysis error: {str(e)}",
                "timestamp": datetime.now().isoformat(),
                "session_id": frame_info.get('session_id', 'unknown'),
                "participant_id": frame_info.get('participant_id', 'unknown')
            }

# HTTP endpoints for reports and control
async def health_check(request):
    """Health check endpoint"""
    return web.Response(
        text="Face Recognition Service Running ✅", 
        status=200,
        headers={'Content-Type': 'text/plain'}
    )

async def attention_report(request):
    """Get attention report"""
    try:
        # Get session_id from query parameters if provided
        session_id = request.query.get('session_id')
        
        report_data = service.attention_data
        
        if session_id and session_id in report_data:
            report_data = {session_id: report_data[session_id]}
        
        # Calculate summary statistics
        total_sessions = len(report_data)
        total_participants = sum(len(session.keys()) for session in report_data.values())
        
        # Calculate average attention across all participants
        all_scores = []
        for session in report_data.values():
            for participant in session.values():
                if participant['attention_score'] > 0:
                    all_scores.append(participant['attention_score'])
        
        average_attention = round(sum(all_scores) / len(all_scores)) if all_scores else 0
        
        return web.json_response({
            "success": True,
            "data": report_data,
            "summary": {
                "total_sessions": total_sessions,
                "total_participants": total_participants,
                "average_attention_score": average_attention,
                "generated_at": datetime.now().isoformat()
            },
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"❌ Error generating report: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)

async def session_report(request):
    """Get detailed report for a specific session"""
    try:
        session_id = request.match_info.get('session_id')
        
        if not session_id or session_id not in service.attention_data:
            return web.json_response({
                "success": False,
                "error": "Session not found"
            }, status=404)
        
        session_data = service.attention_data[session_id]
        
        # Calculate detailed metrics
        participants = []
        total_attention = 0
        
        for participant_id, data in session_data.items():
            participants.append({
                "participant_id": participant_id,
                "name": data['name'],
                "total_frames": data['total_frames'],
                "face_detected_frames": data['face_detected_frames'],
                "attention_score": data['attention_score'],
                "last_seen": data['last_seen'],
                "session_start": data['session_start']
            })
            total_attention += data['attention_score']
        
        overall_attention = round(total_attention / len(participants)) if participants else 0
        
        # Generate grade based on attention score
        if overall_attention >= 90:
            grade = {"grade": "A", "label": "Excellent", "color": "#4CAF50"}
        elif overall_attention >= 80:
            grade = {"grade": "B", "label": "Good", "color": "#8BC34A"}
        elif overall_attention >= 70:
            grade = {"grade": "C", "label": "Average", "color": "#FF9800"}
        elif overall_attention >= 60:
            grade = {"grade": "D", "label": "Below Average", "color": "#FF5722"}
        else:
            grade = {"grade": "F", "label": "Poor", "color": "#F44336"}
        
        return web.json_response({
            "success": True,
            "session_id": session_id,
            "overall_attention_score": overall_attention,
            "grade": grade,
            "participants": participants,
            "participant_count": len(participants),
            "generated_at": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Error generating session report: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)

async def reset_attention(request):
    """Reset attention tracking data"""
    try:
        # Get session_id from request body if provided
        data = await request.json() if request.can_read_body else {}
        session_id = data.get('session_id')
        
        if session_id:
            if session_id in service.attention_data:
                del service.attention_data[session_id]
                message = f"Attention data reset for session {session_id}"
            else:
                message = f"Session {session_id} not found"
        else:
            service.attention_data.clear()
            message = "All attention data reset successfully"
        
        logger.info(message)
        return web.json_response({
            "success": True,
            "message": message
        })
    except Exception as e:
        logger.error(f"❌ Error resetting attention data: {e}")
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)

async def service_stats(request):
    """Get service statistics"""
    try:
        return web.json_response({
            "success": True,
            "stats": {
                "connected_clients": len(service.connected_clients),
                "active_sessions": len(service.attention_data),
                "total_participants": sum(len(session.keys()) for session in service.attention_data.values()),
                "opencv_initialized": service.face_cascade is not None,
                "uptime_seconds": 0,  # You can track this if needed
                "server_time": datetime.now().isoformat(),
                "ports": {
                    "http": service.http_port,
                    "websocket": service.ws_port
                }
            }
        })
    except Exception as e:
        return web.json_response({
            "success": False,
            "error": str(e)
        }, status=500)

# Global service instance
service = FaceRecognitionService()

# 🔧 FIX 4: ENHANCED MAIN FUNCTION WITH BETTER PORT MANAGEMENT
async def main():
    """Main function to start both HTTP and WebSocket servers"""
    try:
        # Get ports from environment variables or find available ones
        try:
            service.http_port = int(os.environ.get('HTTP_PORT', '0'))
            if service.http_port == 0:
                service.http_port = find_available_port(8000)
        except:
            service.http_port = find_available_port(8000)
            
        try:
            service.ws_port = int(os.environ.get('WS_PORT', '0'))
            if service.ws_port == 0:
                service.ws_port = find_available_port(service.http_port + 1)
        except:
            service.ws_port = find_available_port(service.http_port + 1)
        
        print("=" * 60)
        print("🚀 Starting Enhanced Face Recognition Service...")
        print("=" * 60)
        print(f"🎯 Face Detection: {'✅ Enabled' if service.face_cascade is not None else '❌ Disabled'}")
        print(f"📊 Attention Monitoring: {'✅ Enabled' if service.face_cascade is not None else '❌ Disabled'}")
        print(f"🔌 WebSocket Server: ws://localhost:{service.ws_port}")
        print(f"🌐 HTTP Server: http://localhost:{service.http_port}")
        print("=" * 60)
        
        # Check OpenCV initialization
        if service.face_cascade is None:
            print("⚠️  WARNING: OpenCV face detection not initialized properly")
            print("   💡 Make sure opencv-python is installed: pip install opencv-python")
            print("   🔄 Continuing without face detection...")
        
        # Create HTTP application
        app = web.Application()
        
        # Setup CORS with more permissive settings
        cors = aiohttp_cors.setup(app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        # Add routes
        app.router.add_get('/', health_check)
        app.router.add_get('/health', health_check)
        app.router.add_get('/attention-report', attention_report)
        app.router.add_get('/session/{session_id}/report', session_report)
        app.router.add_post('/reset-attention', reset_attention)
        app.router.add_get('/stats', service_stats)
        
        # Add CORS to all routes
        for route in list(app.router.routes()):
            cors.add(route)
        
        # Start HTTP server with better error handling
        try:
            service.http_runner = web.AppRunner(app)
            await service.http_runner.setup()
            site = web.TCPSite(service.http_runner, '0.0.0.0', service.http_port)
            await site.start()
            print(f"✅ HTTP API server started on port {service.http_port}")
        except Exception as http_error:
            logger.error(f"❌ Failed to start HTTP server: {http_error}")
            raise
        
        # Start WebSocket server with better error handling
        try:
            print(f"🔌 Starting WebSocket server on port {service.ws_port}...")
            service.ws_server = await websockets.serve(
                service.process_frame,
                "0.0.0.0",
                service.ws_port,
                ping_interval=20,
                ping_timeout=10,
                max_size=10 * 1024 * 1024,  # 10MB max message size
                compression=None  # Disable compression for better performance
            )
            print(f"✅ WebSocket server started on port {service.ws_port}")
        except Exception as ws_error:
            logger.error(f"❌ Failed to start WebSocket server: {ws_error}")
            raise
        
        print("🎉 Service started successfully!")
        print("📡 Ready to process face recognition requests...")
        print("🔗 Available endpoints:")
        print(f"   GET  http://localhost:{service.http_port}/ - Health check")
        print(f"   GET  http://localhost:{service.http_port}/attention-report - Get all reports")
        print(f"   GET  http://localhost:{service.http_port}/session/{{id}}/report - Get session report")
        print(f"   POST http://localhost:{service.http_port}/reset-attention - Reset data")
        print(f"   GET  http://localhost:{service.http_port}/stats - Service statistics")
        print(f"   WS   ws://localhost:{service.ws_port} - Face recognition WebSocket")
        print("=" * 60)
        print("🎯 Waiting for connections...")
        
        # Keep both servers running
        try:
            await asyncio.Future()  # Run forever
        except KeyboardInterrupt:
            print("\n🛑 Shutting down gracefully...")
            
        # Cleanup
        if service.ws_server:
            service.ws_server.close()
            await service.ws_server.wait_closed()
            
        if service.http_runner:
            await service.http_runner.cleanup()
            
    except Exception as e:
        logger.error(f"❌ Failed to start services: {e}")
        traceback.print_exc()
        raise

if __name__ == "__main__":
    try:
        # Check Python version
        if sys.version_info < (3, 7):
            print("❌ Python 3.7 or higher is required")
            sys.exit(1)
        
        # Check OpenCV installation
        try:
            import cv2
            print(f"✅ OpenCV version: {cv2.__version__}")
        except ImportError:
            print("❌ OpenCV not found. Install with: pip install opencv-python")
            print("   🔄 Continuing without OpenCV (face detection will be disabled)")
        
        # Check other dependencies
        missing_deps = []
        try:
            import websockets
        except ImportError:
            missing_deps.append("websockets")
            
        try:
            import aiohttp
        except ImportError:
            missing_deps.append("aiohttp")
            
        try:
            import aiohttp_cors  
        except ImportError:
            missing_deps.append("aiohttp-cors")
            
        if missing_deps:
            print(f"❌ Missing dependencies: {', '.join(missing_deps)}")
            print(f"   📦 Install with: pip install {' '.join(missing_deps)}")
            sys.exit(1)
        
        print("🐍 Starting Python Face Recognition Service...")
        asyncio.run(main())
        
    except KeyboardInterrupt:
        print("\n👋 Face Recognition Service stopped by user")
    except Exception as e:
        logger.error(f"❌ Failed to start service: {e}")
        traceback.print_exc()
        print("\n🔧 Troubleshooting Guide:")
        print("1. Make sure all dependencies are installed:")
        print("   pip install opencv-python numpy websockets aiohttp aiohttp-cors")
        print("2. Check if ports 8000-8050 are available")
        print("3. Verify Python version is 3.7 or higher")
        print("4. Try running with administrator/sudo privileges")
        print("5. Check if Windows Defender or antivirus is blocking the ports")
        sys.exit(1)