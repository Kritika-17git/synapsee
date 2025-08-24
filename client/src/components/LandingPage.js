// src/components/LandingPage.js
import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
  };

  const navStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 40px'
  };

  const logoStyle = {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#4df3c9'
  };

  const navButtons = {
    display: 'flex',
    gap: '15px'
  };

  const buttonBase = {
    padding: '10px 20px',
    borderRadius: '25px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.3s ease'
  };

  const signInStyle = {
    ...buttonBase,
    background: 'transparent',
    border: '1px solid white',
    color: 'white'
  };

  const signUpStyle = {
    ...buttonBase,
    background: 'linear-gradient(45deg, #43cea2, #185a9d)',
    color: 'white'
  };

  const heroStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '0 20px'
  };

  const titleStyle = {
    fontSize: '3rem',
    fontWeight: 'bold',
    marginBottom: '20px',
    lineHeight: '1.2'
  };

  const subtitleStyle = {
    fontSize: '1.2rem',
    opacity: 0.8,
    marginBottom: '40px',
    maxWidth: '600px'
  };

  const ctaButtons = {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  };

  const trialButton = {
    ...buttonBase,
    background: 'linear-gradient(45deg, #56ab2f, #a8e063)',
    color: 'white'
  };

  const demoButton = {
    ...buttonBase,
    background: 'transparent',
    border: '1px solid white',
    color: 'white'
  };

  return (
    <div style={containerStyle}>
      {/* Navbar */}
      <div style={navStyle}>
        <div style={logoStyle}>Synapsee</div>
        <div style={navButtons}>
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <button style={signInStyle}>Sign In</button>
          </Link>
          <Link to="/signup" style={{ textDecoration: 'none' }}>
            <button style={signUpStyle}>Sign Up</button>
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div style={heroStyle}>
        <h1 style={titleStyle}>
          Transform Education with <br /> AI-Powered Insights
        </h1>
        <p style={subtitleStyle}>
          Experience the future of teaching with real-time emotion detection,
          advanced analytics, and personalized recommendations for every student.
        </p>
        <div style={ctaButtons}>
          <button style={trialButton}>▶ Start Free Trial</button>
          <button style={demoButton}>◼ View Demo</button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;




