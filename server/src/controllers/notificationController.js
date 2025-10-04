import Notification from '../models/Notification.js';
export const listMyNotifications=async(req,res)=>{ const items=await Notification.find({user:req.user._id}).sort({createdAt:-1}).limit(100); res.json(items); };
export const markRead=async(req,res)=>{ const n=await Notification.findOneAndUpdate({_id:req.params.id,user:req.user._id},{read:true},{new:true}); if(!n) return res.status(404).json({error:'Not found'}); res.json(n); };
export const markAllRead=async(req,res)=>{ await Notification.updateMany({user:req.user._id,read:false},{read:true}); res.json({ok:true}); };
