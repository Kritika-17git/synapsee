

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, token, loading } = useAuth();

  // While checking token (from localStorage + /auth/me), show a loader
  if (loading) {
    return <div>Loading...</div>;
  }

  // If not authenticated → go to login
  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  // Otherwise → show protected component
  return children;
};

export default ProtectedRoute;
