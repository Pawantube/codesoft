import fs from 'fs';
import path from 'path';
import Application from '../models/Application.js';
import Job from '../models/Job.js';
import Notification from '../models/Notification.js';
import { sendEmail } from '../utils/email.js';

const notify = async ({ user, title, message, link, type }) => {
  try { await Notification.create({ user, title, message, link, type }); } catch {}
};

export const applyToJob = async (req, res) => {
  const { jobId, name, email, coverLetter } = req.body;
  const job = await Job.findById(jobId).populate('employer');
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const dup = await Application.findOne({ job: jobId, candidate: req.user._id });
  if (dup) return res.status(409).json({ error: 'Already applied' });

  const resumeFileName = req.file ? req.file.filename : undefined;
  const resumePublicPath = resumeFileName ? `/uploads/resumes/${resumeFileName}` : undefined;

  const app = await Application.create({ job: jobId, candidate: req.user._id, name, email, coverLetter, resumeFileName, resumePublicPath });

  try {
    await notify({ user: job.employer._id, title:`New application: ${job.title}`, message:`${name} applied to ${job.title}.`, link:`/employer/manage/${job._id}`, type:'application' });
    await sendEmail({ to: job.employer.email, subject:`New application for ${job.title}`, html:`<p>${name} applied to <strong>${job.title}</strong>.</p><p>Email: ${email}</p>` });
    await sendEmail({ to: email, subject:`Application received: ${job.title}`, html:`<p>Your application to <strong>${job.title}</strong> was received.</p>` });
  } catch {}

  res.status(201).json(app);
};

export const myApplications = async (req, res) => {
  const apps = await Application.find({ candidate: req.user._id }).populate('job');
  res.json(apps);
};

export const employerApplications = async (req, res) => {
  const { jobId } = req.query;
  const filter = jobId ? { job: jobId } : {};
  const apps = await Application.find(filter).populate('job candidate');
  const owned = apps.filter(a => a.job.employer.toString() === req.user._id.toString());
  res.json(owned);
};

export const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const app = await Application.findById(id).populate('job candidate');
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.job.employer.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Forbidden' });
  app.status = status;
  await app.save();
  try {
    await notify({ user: app.candidate._id, title: status==='accepted'?'Application accepted': status==='rejected'?'Application rejected':'Application update', message:`${app.job.title} at ${app.job.company} — status: ${status}`, link:`/jobs/${app.job._id}`, type:'status' });
    await sendEmail({ to: app.email, subject:`Your application status: ${app.job.title}`, html:`<p>Your application to <strong>${app.job.title}</strong> is now <strong>${status}</strong>.</p>` });
  } catch {}
  res.json(app);
};

export const downloadResume = async (req, res) => {
  const { id } = req.params;
  const app = await Application.findById(id).populate('job candidate');
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.job.employer.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Forbidden' });

  const markReviewedIfNeeded = async () => {
    if (app.status !== 'submitted') return;
    app.status = 'reviewed';
    await app.save();
    try {
      await notify({ user: app.candidate._id, title:'Application under review', message:`Employer viewed your resume for ${app.job.title}.`, link:`/jobs/${app.job._id}`, type:'status' });
      await sendEmail({ to: app.email, subject:`Your application is under review`, html:`<p>Your application to <strong>${app.job.title}</strong> is under review.</p>` });
    } catch {}
  };

  const safeName = (app.candidate?.name || 'resume').replace(/[^\w.-]+/g, '_');

  const fileCandidates = app.resumeFileName ? [
    path.resolve('uploads', 'resumes', app.resumeFileName),
    path.resolve('server', 'uploads', 'resumes', app.resumeFileName)
  ] : [];

  let filePath = fileCandidates.find(fs.existsSync);

  if (!filePath && app.resumePublicPath) {
    if (/^https?:\/\//i.test(app.resumePublicPath)) {
      await markReviewedIfNeeded();
        return res.json({ url: app.resumePublicPath });
    }
    const normalized = app.resumePublicPath.startsWith('/') ? app.resumePublicPath.slice(1) : app.resumePublicPath;
    const staticCandidates = [
      path.resolve(normalized),
      path.resolve('server', normalized)
    ];
    filePath = staticCandidates.find(fs.existsSync);
  }

  if (!filePath) return res.status(404).json({ error: 'Resume file not found' });

  await markReviewedIfNeeded();

  const ext = path.extname(filePath) || '.pdf';
  return res.download(filePath, `${safeName}${ext}`);
};

