// // import Job from '../models/Job.js';
// // import { validationResult } from 'express-validator';
// // export const createJob=async(req,res)=>{
// //   const errors=validationResult(req); if(!errors.isEmpty()) return res.status(400).json({errors:errors.array()});
// //   const job=await Job.create({...req.body, employer:req.user._id});
// //   res.status(201).json(job);
// // };
// // export const listJobs=async(req,res)=>{
// //   const {q,location,type,minExperience,shift,workType,page=1,limit=10,featured}=req.query;
// //   const filter={};
// //   if(q) filter.$text={ $search:q };
// //   if(location) filter.location=new RegExp(location,'i');
// //   if(type) filter.type=type;
// //   if(featured) filter.featured=featured==='true';
// //   if(minExperience!==undefined && minExperience!=='') filter.minExperience={ $lte:Number(minExperience) };
// //   if(shift) filter.shift=shift;
// //   if(workType) filter.workType=workType;
// //   const skip=(Number(page)-1)*Number(limit);
// //   const [items,total]=await Promise.all([
// //     Job.find(filter).sort({createdAt:-1}).skip(skip).limit(Number(limit)),
// //     Job.countDocuments(filter)
// //   ]);
// //   res.json({total,page:Number(page),limit:Number(limit),items});
// // };
// // export const getJob=async(req,res)=>{ const job=await Job.findById(req.params.id); if(!job) return res.status(404).json({error:'Job not found'}); res.json(job); };
// // export const updateJob=async(req,res)=>{ const j=await Job.findById(req.params.id); if(!j) return res.status(404).json({error:'Job not found'}); if(j.employer.toString()!==req.user._id.toString()) return res.status(403).json({error:'Forbidden'}); Object.assign(j,req.body); await j.save(); res.json(j); };
// // export const deleteJob=async(req,res)=>{ const j=await Job.findById(req.params.id); if(!j) return res.status(404).json({error:'Job not found'}); if(j.employer.toString()!==req.user._id.toString()) return res.status(403).json({error:'Forbidden'}); await j.deleteOne(); res.json({ok:true}); };


// import Job from '../models/Job.js';
// import { validationResult } from 'express-validator';

// // ... keep your existing createJob, listJobs, getJob, updateJob, deleteJob

// export const myJobs = async (req, res) => {
//   const { page = 1, limit = 20 } = req.query;
//   const skip = (Number(page) - 1) * Number(limit);
//   const [items, total] = await Promise.all([
//     Job.find({ employer: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
//     Job.countDocuments({ employer: req.user._id })
//   ]);
//   res.json({ total, page: Number(page), limit: Number(limit), items });
// };

// export const featureJob = async (req, res) => {
//   const j = await Job.findById(req.params.id);
//   if (!j) return res.status(404).json({ error: 'Job not found' });
//   if (j.employer.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Forbidden' });

//   j.featured = !j.featured;
//   await j.save();
//   res.json(j);
// };

// export const duplicateJob = async (req, res) => {
//   const j = await Job.findById(req.params.id);
//   if (!j) return res.status(404).json({ error: 'Job not found' });
//   if (j.employer.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Forbidden' });

//   const copy = j.toObject();
//   delete copy._id; delete copy.createdAt; delete copy.updatedAt;
//   copy.title = `${copy.title} (Copy)`;
//   copy.featured = false;

//   const created = await Job.create({ ...copy, employer: req.user._id });
//   res.status(201).json(created);
// };
import Job from '../models/Job.js';
import { validationResult } from 'express-validator';

/** CREATE */
export const createJob = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const job = await Job.create({ ...req.body, employer: req.user._id });
  res.status(201).json(job);
};

/** LIST (public with filters) */
export const listJobs = async (req, res) => {
  const { q, location, type, minExperience, shift, workType, page = 1, limit = 10, featured } = req.query;
  const filter = {};
  if (q) filter.$text = { $search: q };
  if (location) filter.location = new RegExp(location, 'i');
  if (type) filter.type = type;
  if (featured !== undefined) filter.featured = featured === 'true';
  if (minExperience !== undefined && minExperience !== '') filter.minExperience = { $lte: Number(minExperience) };
  if (shift) filter.shift = shift;
  if (workType) filter.workType = workType;

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Job.countDocuments(filter),
  ]);
  res.json({ total, page: Number(page), limit: Number(limit), items });
};

/** READ one */
export const getJob = async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
};

/** UPDATE (owner only) */
export const updateJob = async (req, res) => {
  const j = await Job.findById(req.params.id);
  if (!j) return res.status(404).json({ error: 'Job not found' });
  if (j.employer.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Forbidden' });

  Object.assign(j, req.body);
  await j.save();
  res.json(j);
};

/** DELETE (owner only) */
export const deleteJob = async (req, res) => {
  const j = await Job.findById(req.params.id);
  if (!j) return res.status(404).json({ error: 'Job not found' });
  if (j.employer.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Forbidden' });

  await j.deleteOne();
  res.json({ ok: true });
};

/** MY JOBS (employer) */
export const myJobs = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Job.find({ employer: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Job.countDocuments({ employer: req.user._id }),
  ]);
  res.json({ total, page: Number(page), limit: Number(limit), items });
};

/** TOGGLE FEATURED (owner only) */
export const featureJob = async (req, res) => {
  const j = await Job.findById(req.params.id);
  if (!j) return res.status(404).json({ error: 'Job not found' });
  if (j.employer.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Forbidden' });

  j.featured = !j.featured;
  await j.save();
  res.json(j);
};

/** DUPLICATE (owner only) */
export const duplicateJob = async (req, res) => {
  const j = await Job.findById(req.params.id);
  if (!j) return res.status(404).json({ error: 'Job not found' });
  if (j.employer.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Forbidden' });

  const copy = j.toObject();
  delete copy._id; delete copy.createdAt; delete copy.updatedAt;
  const created = await Job.create({ ...copy, title: `${j.title} (Copy)`, featured: false, employer: req.user._id });
  res.status(201).json(created);
};

/** BULK INSERT (array body) */
export const bulkInsert = async (req, res) => {
  if (!Array.isArray(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Body must be a non-empty array of job objects' });
  }
  const invalid = req.body.find(
    j => !j.title || !j.company || !j.location || !j.description || String(j.description).length < 20
  );
  if (invalid) {
    return res.status(400).json({ error: 'Each job needs title, company, location, and description (>= 20 chars)' });
  }
  const docs = req.body.map(j => ({ ...j, employer: req.user._id }));
  const inserted = await Job.insertMany(docs);
  res.status(201).json({ count: inserted.length, items: inserted });
};
