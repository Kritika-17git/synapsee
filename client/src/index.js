import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

// Initialize React app
const container = document.getElementById('root');
const root = createRoot(container);

// Add global styles
const globalStyles = `
  .video-container {
    min-height: 200px;
    transition: all 0.3s ease;
  }
  
  .video-container:hover {
    transform: scale(1.02);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }
  
  input::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }
  
  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  button:active {
    transform: translateY(0);
  }
  
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }
`;

// Inject global styles
const styleSheet = document.createElement('style');
styleSheet.textContent = globalStyles;
document.head.appendChild(styleSheet);

// Render app
root.render(<App />);