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
  const [bootstrapping, setBootstrapping] = useState(Boolean(localStorage.getItem('token')));

  // Load current user when token changes
  useEffect(() => {
    if (token) {
      setBootstrapping(true);
      setAuthToken(token);
      api
        .get('/users/me')
        .then((res) => setUser(res.data))
        .catch((err) => {
          const status = err?.response?.status;
          // Only clear session on authentication errors
          if (status === 401 || status === 403) {
            localStorage.removeItem('token');
            setAuthToken(null);
            setToken('');
            setUser(null);
          } else {
            // Keep the user logged in; schedule a light retry
            console.warn('Transient /users/me error retained session', status);
            setTimeout(() => {
              api
                .get('/users/me')
                .then((res) => setUser(res.data))
                .catch(() => {});
            }, 15000);
          }
        })
        .finally(() => setBootstrapping(false));
    } else {
      setAuthToken(null);
      setUser(null);
      setBootstrapping(false);
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
    const withTimeout = (p, ms = 2000) =>
      Promise.race([
        p.catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, ms)),
      ]);

    try {
      if (token) await withTimeout(removePushSubscription(token));
    } catch {
      // ignore
    } finally {
      try { closeSocket(); } catch {}
      try { localStorage.removeItem('token'); } catch {}
      setAuthToken(null);
      setToken('');
      setUser(null);
    }
  };

  return (
    <AuthCtx.Provider value={{ user, token, login, register, logout, setUser, bootstrapping }}>
      {children}
    </AuthCtx.Provider>
  );
}

