
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';
import { setToken, getToken, removeToken, getUserFromToken } from '../utils/auth.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	useEffect(() => {
		const token = getToken();
		if (token) {
			const userData = getUserFromToken(token);
			setUser(userData);
			setIsAuthenticated(true);
		} else {
			setUser(null);
			setIsAuthenticated(false);
		}
	}, []);

	const login = useCallback(async (loginField, password) => {
		setLoading(true);
		setError(null);
		try {
			const res = await api.post('/auth/login', { loginField, password });
			if (res.data.success && res.data.data.token) {
				setToken(res.data.data.token);
				setUser(getUserFromToken(res.data.data.token));
				setIsAuthenticated(true);
				setError(null);
				setLoading(false);
				return { success: true };
			} else {
				setError(res.data.message || 'Login failed');
				setLoading(false);
				return { success: false };
			}
		} catch (err) {
			setError(err.response?.data?.message || 'Login failed');
			setLoading(false);
			return { success: false };
		}
	}, []);

	const logout = useCallback(() => {
		removeToken();
		setUser(null);
		setIsAuthenticated(false);
	}, []);

	const clearError = useCallback(() => setError(null), []);

	return (
		<AuthContext.Provider value={{
			user,
			loading,
			error,
			isAuthenticated,
			login,
			logout,
			clearError
		}}>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => useContext(AuthContext);
