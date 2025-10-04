import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export const requireAuth = async (req,res,next)=>{
  try{
    const token=(req.headers.authorization||'').replace('Bearer ','').trim();
    if(!token) return res.status(401).json({error:'No token'});
    const decoded=jwt.verify(token,process.env.JWT_SECRET);
    const user=await User.findById(decoded.id);
    if(!user) return res.status(401).json({error:'User not found'});
    req.user=user; next();
  }catch{ return res.status(401).json({error:'Unauthorized'}); }
};
export const requireRole = (role)=>(req,res,next)=>{
  if(!req.user || req.user.role!==role) return res.status(403).json({error:'Forbidden'});
  next();
};
