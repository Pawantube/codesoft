import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setAuthToken } from '../utils/api';
import { ensurePushSubscription, removePushSubscription } from '../utils/push';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      api
        .get('/users/me')
        .then((res) => setUser(res.data))
        .catch(() => {});
    } else {
      setAuthToken(null);
      setUser(null);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;
    ensurePushSubscription(token).catch(() => {});
  }, [token, user]);

  const persistSession = (data) => {
    localStorage.setItem('token', data.token);
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
    if (token) {
      await removePushSubscription(token);
    }
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
