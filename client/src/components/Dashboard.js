import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { v4 as uuidv4 } from 'uuid';
import api from '../services/api.js';

const Dashboard = () => {
  const [roomInput, setRoomInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [roomStats, setRoomStats] = useState({ totalRooms: 0, totalUsers: 0 });
  const [networkInfo, setNetworkInfo] = useState(null);
  const [sessionReports, setSessionReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [liveAttentionGrades, setLiveAttentionGrades] = useState([]);
  const [loadingAttention, setLoadingAttention] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOnlineUsers();
    fetchRoomStats();
    fetchNetworkInfo();
    fetchSessionReports();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchOnlineUsers();
      fetchRoomStats();
      fetchSessionReports();
      if (currentRoomId) {
        fetchLiveAttentionGrades(currentRoomId);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentRoomId]);

  const fetchOnlineUsers = async () => {
    try {
      const response = await api.get('/users/online');
      if (response.data.success) {
        setOnlineUsers(response.data.data.users);
      }
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  };

  const fetchRoomStats = async () => {
    try {
      const response = await api.get('/rooms');
      if (response.data.success) {
        setRoomStats({
          totalRooms: response.data.data.totalRooms,
          totalUsers: response.data.data.totalUsers
        });
      }
    } catch (error) {
      console.error('Error fetching room stats:', error);
    }
  };

  const fetchNetworkInfo = async () => {
    try {
      const response = await api.get('/network-info');
      if (response.data.success) {
        setNetworkInfo(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching network info:', error);
    }
  };

  const fetchSessionReports = async () => {
    try {
      setLoadingReports(true);
      const response = await api.get('/reports/sessions');
      if (response.data.success) {
        setSessionReports(response.data.data.reports);
      }
    } catch (error) {
      console.error('Error fetching session reports:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  // New function to fetch live attention grades for current room
  const fetchLiveAttentionGrades = async (roomId) => {
    try {
      setLoadingAttention(true);
      const response = await api.get(`/rooms/${roomId}/attention-grades`);
      if (response.data.success) {
        setLiveAttentionGrades(response.data.data.participants);
      }
    } catch (error) {
      console.error('Error fetching live attention grades:', error);
      setLiveAttentionGrades([]);
    } finally {
      setLoadingAttention(false);
    }
  };

  const handleJoinRoom = () => {
    if (roomInput.trim()) {
      setCurrentRoomId(roomInput.trim());
      fetchLiveAttentionGrades(roomInput.trim());
      navigate(`/call/${roomInput.trim()}`);
    }
  };

  const handleCreateRoom = async () => {
    try {
      const response = await api.post('/rooms');
      if (response.data.success) {
        const newRoomId = response.data.data.roomId;
        setCurrentRoomId(newRoomId);
        navigate(`/call/${newRoomId}`);
      }
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const handleViewReport = (sessionId) => {
    // Open report in new tab
    window.open(`/report/${sessionId}`, '_blank');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getAttentionScoreColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const getAttentionGradeColor = (grade) => {
    const gradeColors = {
      'A': '#4CAF50',
      'B': '#8BC34A',
      'C': '#CDDC39',
      'D': '#FF9800',
      'E': '#FF5722',
      'F': '#F44336'
    };
    return gradeColors[grade] || '#757575';
  };

  // New function to refresh attention grades manually
  const handleRefreshAttention = () => {
    if (currentRoomId) {
      fetchLiveAttentionGrades(currentRoomId);
    }
  };

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto 40px auto',
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  };

  const userInfoStyle = {
    color: 'white'
  };

  const logoutButtonStyle = {
    background: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.3s ease'
  };

  const mainContentStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '30px'
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    padding: '30px',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: 'white'
  };

  const cardTitleStyle = {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '20px',
    textAlign: 'center'
  };

  const inputStyle = {
    width: '100%',
    padding: '15px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    fontSize: '16px',
    marginBottom: '15px',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const buttonStyle = {
    width: '100%',
    padding: '15px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(45deg, #667eea, #764ba2)',
    color: 'white',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginBottom: '10px'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    background: 'linear-gradient(45deg, #26c6da, #00acc1)'
  };

  const refreshButtonStyle = {
    ...buttonStyle,
    background: 'linear-gradient(45deg, #FF9800, #FF5722)',
    fontSize: '14px',
    padding: '10px'
  };

  const statsStyle = {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '20px'
  };

  const statItemStyle = {
    textAlign: 'center'
  };

  const userListStyle = {
    maxHeight: '200px',
    overflowY: 'auto',
    marginTop: '15px'
  };

  const userItemStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '10px',
    marginBottom: '8px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    fontSize: '14px'
  };

  const attentionItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    marginBottom: '8px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    fontSize: '14px'
  };

  const gradeStyle = (grade) => ({
    background: getAttentionGradeColor(grade),
    color: 'white',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    minWidth: '24px',
    textAlign: 'center'
  });

  const networkInfoStyle = {
    fontSize: '12px',
    marginTop: '15px',
    padding: '15px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '10px'
  };

  const reportItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    marginBottom: '8px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background 0.2s ease'
  };

  const reportListStyle = {
    maxHeight: '300px',
    overflowY: 'auto'
  };

  const attentionScoreStyle = (score) => ({
    background: getAttentionScoreColor(score),
    color: 'white',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold'
  });

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={userInfoStyle}>
          <h2 style={{ margin: 0, marginBottom: '5px' }}>
            Welcome, {user?.firstName} {user?.lastName}
          </h2>
          <p style={{ margin: 0, opacity: 0.8, fontSize: '14px' }}>
            @{user?.username} • {user?.email}
          </p>
          {currentRoomId && (
            <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize: '14px', 
                        background: 'rgba(76, 175, 80, 0.2)', 
                        padding: '5px 10px', borderRadius: '10px', display: 'inline-block' }}>
              Current Room: {currentRoomId}
            </p>
          )}
        </div>
        <button onClick={handleLogout} style={logoutButtonStyle}>
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div style={mainContentStyle}>
        {/* Room Controls */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Start Video Call</h3>
          
          <input
            type="text"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="Enter room ID"
            style={inputStyle}
            onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
          
          <button
            onClick={handleJoinRoom}
            style={buttonStyle}
            disabled={!roomInput.trim()}
          >
            Join Room
          </button>
          
          <button onClick={handleCreateRoom} style={secondaryButtonStyle}>
            Create New Room
          </button>

          <p style={{ 
            textAlign: 'center', 
            fontSize: '12px', 
            opacity: 0.7,
            marginTop: '15px' 
          }}>
            Share the room ID with others to invite them
          </p>
        </div>

        {/* Live Attention Grades */}
        {currentRoomId && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ ...cardTitleStyle, margin: 0, textAlign: 'left' }}>
                Live Attention Grades
              </h3>
              <button onClick={handleRefreshAttention} style={refreshButtonStyle} disabled={loadingAttention}>
                {loadingAttention ? '⟳' : '↻'} Refresh
              </button>
            </div>
            
            {loadingAttention ? (
              <div style={{ textAlign: 'center', opacity: 0.7, fontSize: '14px', padding: '20px' }}>
                Loading attention data...
              </div>
            ) : liveAttentionGrades.length > 0 ? (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {liveAttentionGrades.map((participant) => (
                  <div key={participant.userId} style={attentionItemStyle}>
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {participant.name}
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>
                        @{participant.username}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={gradeStyle(participant.attentionGrade.grade)}>
                        {participant.attentionGrade.grade}
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.8, textAlign: 'right' }}>
                        {participant.attentionScore}%<br />
                        <span style={{ fontSize: '10px' }}>
                          {participant.attentionGrade.label}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.7, fontSize: '14px', padding: '20px' }}>
                No attention data available for this room yet.<br />
                <span style={{ fontSize: '12px' }}>
                  Students need to join the room and start their video for tracking.
                </span>
              </div>
            )}
            
            <div style={{ 
              textAlign: 'center', 
              fontSize: '12px', 
              opacity: 0.7,
              marginTop: '15px',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px'
            }}>
              Room: {currentRoomId} • Updates every 30 seconds • Click refresh for immediate update
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Server Statistics</h3>
          
          <div style={statsStyle}>
            <div style={statItemStyle}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {roomStats.totalRooms}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                Active Rooms
              </div>
            </div>
            <div style={statItemStyle}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {roomStats.totalUsers}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                Users in Calls
              </div>
            </div>
            <div style={statItemStyle}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {onlineUsers.length + 1}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                Online Users
              </div>
            </div>
          </div>

          {/* Network Info */}
          {networkInfo && (
            <div style={networkInfoStyle}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Network Access URLs:
              </div>
              <div>Local: http://localhost:3000</div>
              {networkInfo.addresses.map((addr, index) => (
                <div key={index}>
                  {addr.name}: http://{addr.address}:3000
                </div>
              ))}
              <div style={{ marginTop: '8px', fontStyle: 'italic', opacity: 0.7 }}>
                Share these URLs for local network access
              </div>
            </div>
          )}
        </div>

        {/* Online Users */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Online Users ({onlineUsers.length + 1})</h3>
          
          {/* Current User */}
          <div style={{...userItemStyle, background: 'rgba(76, 175, 80, 0.2)'}}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              background: '#4CAF50', 
              borderRadius: '50%',
              marginRight: '10px' 
            }} />
            <div>
              <div style={{ fontWeight: 'bold' }}>
                {user?.firstName} {user?.lastName} (You)
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                @{user?.username}
              </div>
            </div>
          </div>

          {/* Other Users */}
          <div style={userListStyle}>
            {onlineUsers.length > 0 ? (
              onlineUsers.map((onlineUser) => (
                <div key={onlineUser.id} style={userItemStyle}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    background: '#2196F3', 
                    borderRadius: '50%',
                    marginRight: '10px' 
                  }} />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>
                      {onlineUser.firstName} {onlineUser.lastName}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>
                      @{onlineUser.username}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', opacity: 0.7, fontSize: '14px' }}>
                No other users online
              </p>
            )}
          </div>
        </div>

        {/* Session Reports */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Attention Reports</h3>
          
          {loadingReports ? (
            <div style={{ textAlign: 'center', opacity: 0.7, fontSize: '14px' }}>
              Loading reports...
            </div>
          ) : sessionReports.length > 0 ? (
            <div style={reportListStyle}>
              {sessionReports.map((report) => (
                <div
                  key={report.id}
                  style={{
                    ...reportItemStyle,
                    ':hover': { background: 'rgba(255, 255, 255, 0.2)' }
                  }}
                  onClick={() => handleViewReport(report.id)}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {report.sessionName}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>
                      {report.date} at {report.time} • {report.duration}min • {report.participants} students
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={attentionScoreStyle(report.attentionScore)}>
                      {report.attentionScore}%
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>
                      {report.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', opacity: 0.7, fontSize: '14px' }}>
              No session reports available. Start a meeting to generate reports.
            </p>
          )}
          
          <div style={{ 
            textAlign: 'center', 
            fontSize: '12px', 
            opacity: 0.7,
            marginTop: '15px',
            padding: '10px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px'
          }}>
            Click on any report to view detailed attention analytics for each student
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;