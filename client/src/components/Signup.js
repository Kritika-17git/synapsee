import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

const Signup = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);

  const { signup, loading, error, isAuthenticated, clearError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (formData.confirmPassword) {
      setPasswordMatch(formData.password === formData.confirmPassword);
    } else {
      setPasswordMatch(true);
    }
  }, [formData.password, formData.confirmPassword]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!passwordMatch) return;
    if (Object.values(formData).some((field) => !field.trim())) return;

    const { confirmPassword, ...signupData } = formData;
    const result = await signup(signupData);

    if (result.success) {
      navigate('/dashboard', { replace: true });
    }
  };

  // THEME: Bluish-green gradient + glassmorphism (same as Login)
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a192f, #0f2944, #00796b)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(12px)',
    padding: '40px',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    width: '100%',
    maxWidth: '450px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    maxHeight: '90vh',
    overflowY: 'auto'
  };

  const titleStyle = {
    textAlign: 'center',
    color: '#4dd0e1',
    fontSize: '2.2rem',
    fontWeight: 'bold',
    marginBottom: '10px'
  };

  const subtitleStyle = {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '1rem',
    marginBottom: '30px'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    fontSize: '14px',
    marginBottom: '15px',
    outline: 'none',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box'
  };

  const inputErrorStyle = {
    ...inputStyle,
    border: '1px solid rgba(255, 0, 0, 0.5)',
    background: 'rgba(255, 0, 0, 0.1)'
  };

  const rowStyle = {
    display: 'flex',
    gap: '15px',
    marginBottom: '15px'
  };

  const buttonStyle = {
    width: '100%',
    padding: '15px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(45deg, #00c6ff, #0072ff)',
    color: 'white',
    fontSize: '16px',
    fontWeight: '600',
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s ease',
    opacity: loading ? 0.7 : 1,
    marginBottom: '20px',
    boxShadow: '0 4px 15px rgba(0, 114, 255, 0.3)'
  };

  const errorStyle = {
    background: 'rgba(255, 0, 0, 0.1)',
    border: '1px solid rgba(255, 0, 0, 0.3)',
    color: '#ff6b6b',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'center',
    fontSize: '14px'
  };

  const linkStyle = {
    textAlign: 'center',
    marginTop: '20px'
  };

  const passwordContainerStyle = {
    position: 'relative',
    flex: 1,
    marginBottom: '15px'
  };

  const togglePasswordStyle = {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-65%)',
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
    fontSize: '14px'
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Join Us</h1>
        <p style={subtitleStyle}>Create your account to get started</p>

        {error && <div style={errorStyle}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={rowStyle}>
            <input
              type="text"
              name="firstName"
              placeholder="First Name"
              value={formData.firstName}
              onChange={handleChange}
              style={inputStyle}
              required
            />
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleChange}
              style={inputStyle}
              required
            />
          </div>

          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            style={inputStyle}
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            style={inputStyle}
            required
          />

          <div style={passwordContainerStyle}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Password (min 6 characters)"
              value={formData.password}
              onChange={handleChange}
              style={inputStyle}
              minLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={togglePasswordStyle}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <input
            type={showPassword ? 'text' : 'password'}
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            style={passwordMatch ? inputStyle : inputErrorStyle}
            required
          />

          {!passwordMatch && (
            <p
              style={{
                color: '#ff6b6b',
                fontSize: '12px',
                marginTop: '-10px',
                marginBottom: '15px'
              }}
            >
              Passwords do not match
            </p>
          )}

          <button type="submit" style={buttonStyle} disabled={loading || !passwordMatch}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div style={linkStyle}>
          <p style={{ color: 'rgba(255, 255, 255, 0.85)', margin: 0 }}>
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: '#4dd0e1',
                textDecoration: 'none',
                fontWeight: '600'
              }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
