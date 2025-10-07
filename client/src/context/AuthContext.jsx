// client/src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setAuthToken } from '../utils/api';
import { ensurePushSubscription, removePushSubscription } from '../utils/push';
import { initSocket, closeSocket } from '../utils/socket';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');

  // Load current user when token changes
  useEffect(() => {
    if (token) {
      setAuthToken(token);
      api
        .get('/users/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token');
          setAuthToken(null);
          setToken('');
          setUser(null);
        });
    } else {
      setAuthToken(null);
      setUser(null);
    }
  }, [token]);

  // Socket + Push lifecycle
  useEffect(() => {
    if (token && user) {
      initSocket(token);
      ensurePushSubscription(token).catch(() => {});
    } else {
      closeSocket();
    }
  }, [token, user]);

  // Ensure sockets close on unmount
  useEffect(() => () => closeSocket(), []);

  const persistSession = (data) => {
    localStorage.setItem('token', data.token);
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    persistSession(res.data);
  };

  const register = async (payload) => {
    const res = await api.post('/auth/register', payload);
    persistSession(res.data);
  };

  const logout = async () => {
    try {
      if (token) await removePushSubscription(token);
    } catch {
      // ignore push cleanup errors
    } finally {
      closeSocket();
      localStorage.removeItem('token');
      setAuthToken(null);
      setToken('');
      setUser(null);
    }
  };

  return (
    <AuthCtx.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
