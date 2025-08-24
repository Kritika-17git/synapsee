// import React from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import { AuthProvider } from './context/AuthContext.js';
// import ProtectedRoute from './components/ProtectedRoute.js';
// import Login from './components/Login.js';
// import Signup from './components/Signup.js';
// import Dashboard from './components/Dashboard.js';
// import VideoCallPage from './components/VideoCallPage.js';
// import AttentionReport from './components/AttentionReport.js';

// const App = () => {
//   return (
//     <AuthProvider>
//       <Router>
//         <Routes>
//           {/* Public Routes */}
//           <Route path="/login" element={<Login />} />
//           <Route path="/signup" element={<Signup />} />
          
//           {/* Protected Routes */}
//           <Route path="/dashboard" element={
//             <ProtectedRoute>
//               <Dashboard />
//             </ProtectedRoute>
//           } />
          
//           <Route path="/call/:roomId" element={
//             <ProtectedRoute>
//               <VideoCallPage />
//             </ProtectedRoute>
//           } />
//           <Route path="/report/:sessionId" element={
//             <ProtectedRoute>
//               <AttentionReport />
//             </ProtectedRoute>
//           } />
          
//           {/* Default redirect */}
//           <Route path="/" element={<Navigate to="/dashboard" replace />} />
//         </Routes>
//       </Router>
//     </AuthProvider>
//   );
// };

// export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import ProtectedRoute from './components/ProtectedRoute.js';
import LandingPage from './components/LandingPage.js';
import Login from './components/Login.js';
import Signup from './components/Signup.js';
import Dashboard from './components/Dashboard.js';
import VideoCallPage from './components/VideoCallPage.js';
import AttentionReport from './components/AttentionReport.js';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/call/:roomId" element={
            <ProtectedRoute>
              <VideoCallPage />
            </ProtectedRoute>
          } />

          <Route path="/report/:sessionId" element={
            <ProtectedRoute>
              <AttentionReport />
            </ProtectedRoute>
          } />
          
          {/* Catch-all → redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
