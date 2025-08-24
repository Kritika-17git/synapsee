import React, { useState, useEffect } from 'react';
import api from '../services/api.js'; // Import the same API service used in Dashboard

// Styles
const cardStyle = {
  background: 'rgba(255, 255, 255, 0.1)',
  borderRadius: '10px',
  padding: '20px',
  margin: '20px 0',
  backdropFilter: 'blur(10px)',
  color: 'white'
};

const cardTitleStyle = {
  margin: '0 0 15px 0',
  color: 'white'
};

const reportListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px'
};

const reportItemStyle = {
  background: 'rgba(255, 255, 255, 0.1)',
  padding: '15px',
  borderRadius: '8px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  transition: 'background 0.3s ease',
  color: 'white'
};

const AttentionReports = () => {
  const [sessionReports, setSessionReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [error, setError] = useState(null);

  // Function to format the score display
  const attentionScoreStyle = (score) => {
    let color;
    if (score >= 80) color = '#4CAF50';
    else if (score >= 60) color = '#FFC107';
    else if (score >= 40) color = '#FF9800';
    else color = '#F44336';

    return {
      background: color,
      color: 'white',
      borderRadius: '20px',
      padding: '2px 10px',
      fontSize: '12px',
      fontWeight: 'bold'
    };
  };

  // Function to fetch reports from API using the same service as Dashboard
  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      setError(null);
      
      // Use the same API service and endpoint as Dashboard
      const response = await api.get('/reports/my-reports');
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response format from server');
      }
      
      // Format the data for display
      const formattedReports = response.data.map(report => ({
        id: report._id,
        sessionName: report.sessionName,
        date: new Date(report.startTime).toLocaleDateString(),
        time: new Date(report.startTime).toLocaleTimeString(),
        duration: Math.round(report.duration / 60), // Convert to minutes
        participants: report.participants.length,
        attentionScore: report.overallAttentionScore,
        status: report.isActive ? 'Active' : 'Completed'
      }));
      
      console.log('Fetched reports:', formattedReports);
      setSessionReports(formattedReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setError(error.message || 'Failed to fetch reports');
    } finally {
      setLoadingReports(false);
    }
  };

  // Fetch data when component loads
  useEffect(() => {
    fetchReports();
  }, []);

  const handleViewReport = (reportId) => {
    // Navigate to report detail view (same as Dashboard)
    window.open(`/report/${reportId}`, '_blank');
  };

  const handleRetry = () => {
    fetchReports();
  };

  return (
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>Attention Reports</h3>
      
      {error ? (
        <div style={{ textAlign: 'center', color: '#ff6b6b' }}>
          <p>Error loading reports: {error}</p>
          <button 
            onClick={handleRetry}
            style={{
              background: '#6c5ce7',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Try Again
          </button>
        </div>
      ) : loadingReports ? (
        <div style={{ textAlign: 'center', opacity: 0.7, fontSize: '14px' }}>
          Loading reports...
        </div>
      ) : sessionReports.length > 0 ? (
        <div style={reportListStyle}>
          {sessionReports.map((report) => (
            <div
              key={report.id}
              style={reportItemStyle}
              onClick={() => handleViewReport(report.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
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
  );
};

export default AttentionReports;