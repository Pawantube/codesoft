import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import User from '../models/User.js';
const sign=(u)=>jwt.sign({id:u._id, role:u.role}, process.env.JWT_SECRET, {expiresIn:'7d'});
export const register=async(req,res)=>{
  const errors=validationResult(req); if(!errors.isEmpty()) return res.status(400).json({errors:errors.array()});
  const {name,email,password,role,companyName}=req.body;
  if(await User.findOne({email})) return res.status(409).json({error:'Email already in use'});
  const user=await User.create({name,email,password,role,companyName});
  const token=sign(user);
  res.json({token,user:{id:user._id,name:user.name,email:user.email,role:user.role,companyName:user.companyName}});
};
export const login=async(req,res)=>{
  const errors=validationResult(req); if(!errors.isEmpty()) return res.status(400).json({errors:errors.array()});
  const {email,password}=req.body; const user=await User.findOne({email}).select('+password');
  if(!user) return res.status(401).json({error:'Invalid credentials'});
  if(!(await user.comparePassword(password))) return res.status(401).json({error:'Invalid credentials'});
  const token=sign(user); res.json({token,user:{id:user._id,name:user.name,email:user.email,role:user.role,companyName:user.companyName}});
};
export const me=async(req,res)=>{ const {_id:id,name,email,role,companyName,resumeUrl}=req.user; res.json({id,name,email,role,companyName,resumeUrl}); };
// export const updateMe=async(req,res)=>{ const allow=['name','companyName','resumeUrl']; const up={}; allow.forEach(k=>{ if(req.body[k]!=null) up[k]=req.body[k]; }); const u=await User.findByIdAndUpdate(req.user._id,up,{new:true}); res.json(u); };

export const updateMe = async (req, res) => {
  const allowed = [
    'name', 'companyName', 'headline', 'bio', 'phone', 'location',
    'skills', 'avatarUrl', 'links', 'resumeUrl'
  ];
  const updates = {};
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

  // normalize skills (comma string → array)
  if (typeof updates.skills === 'string') {
    updates.skills = updates.skills.split(',').map(s => s.trim()).filter(Boolean);
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
  res.json(user);
};
