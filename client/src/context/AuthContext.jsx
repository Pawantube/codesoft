import React,{createContext,useContext,useEffect,useState} from 'react';
import { api,setAuthToken } from '../utils/api';
const AuthCtx=createContext(null); export const useAuth=()=>useContext(AuthCtx);
export default function AuthProvider({children}){
  const [user,setUser]=useState(null); const [token,setToken]=useState(localStorage.getItem('token')||'');
  useEffect(()=>{ if(token){ setAuthToken(token); api.get('/users/me').then(r=>setUser(r.data)).catch(()=>{});} else { setAuthToken(null); setUser(null);} },[token]);
  const login=async(email,password)=>{ const r=await api.post('/auth/login',{email,password}); localStorage.setItem('token',r.data.token); setToken(r.data.token); setUser(r.data.user); };
  const register=async(payload)=>{ const r=await api.post('/auth/register',payload); localStorage.setItem('token',r.data.token); setToken(r.data.token); setUser(r.data.user); };
  const logout=()=>{ localStorage.removeItem('token'); setToken(''); setUser(null); };
  return <AuthCtx.Provider value={{user,token,login,register,logout}}>{children}</AuthCtx.Provider>;
}
