import fs from 'fs';
import path from 'path';
import Application from '../models/Application.js';
import Job from '../models/Job.js';
import Notification from '../models/Notification.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { sendEmail } from '../utils/email.js';
import { sendWebPushToUser } from '../utils/webPush.js';
import cloudinary from '../utils/cloudinary.js';

const notify = async ({ user, title, message, link, type, req }) => {
  try {
    const note = await Notification.create({ user, title, message, link, type });
    req?.io?.to?.(`user:${String(user)}`)?.emit?.('notify:new', {
      id: String(note._id),
      title: note.title,
      message: note.message,
      link: note.link,
      createdAt: note.createdAt,
    });
    try {
      const origin = req.headers.origin || '';
      const url = link && origin ? `${origin}${link.startsWith('/') ? '' : '/'}${link}` : undefined;
      await sendWebPushToUser({
        userId: user,
        payload: { title, body: message, data: url ? { url } : {} },
      });
    } catch {}
  } catch {}
};

// --- Phase 2: Tasks ---
export const assignTask = async (req, res) => {
  const { id } = req.params; // application id
  const { title, description, attachments = [], dueAt } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });
  const app = await Application.findById(id).populate('job candidate');
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.job.employer.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Forbidden' });
  const task = {
    title,
    description: description || '',
    attachments: (attachments || []).map((a) => ({ url: a.url || a, name: a.name || '' })),
    dueAt: dueAt ? new Date(dueAt) : undefined,
    status: 'assigned',
    createdBy: req.user._id,
  };
  app.tasks.push(task);
  app.status = 'task_assigned';
  await app.save();
  try {
    await notify({ user: app.candidate._id, title:'Task assigned', message:`${title} for ${app.job.title}.`, link:`/applications/me`, type:'task', req });
  } catch {}
  res.status(201).json(app);
};

export const submitTask = async (req, res) => {
  const { id, taskId } = req.params;
  const { submissionText, submissionLinks = [] } = req.body || {};
  const app = await Application.findById(id).populate('job candidate');
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.candidate.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Forbidden' });
  const t = app.tasks.id(taskId);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  t.status = 'submitted';
  t.submittedAt = new Date();
  t.submissionText = submissionText || '';
  t.submissionLinks = submissionLinks;
  await app.save();
  try {
    await notify({ user: app.job.employer, title:'Task submitted', message:`${app.candidate.name || 'Candidate'} submitted: ${t.title}`, link:`/employer/manage/${app.job._id}?tab=applications`, type:'task', req });
  } catch {}
  res.json(app);
};

export const reviewTask = async (req, res) => {
  const { id, taskId } = req.params;
  const { reviewerNotes, applicationStatus } = req.body || {};
  const app = await Application.findById(id).populate('job candidate');
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.job.employer.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Forbidden' });
  const t = app.tasks.id(taskId);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  t.status = 'reviewed';
  if (typeof reviewerNotes === 'string') t.reviewerNotes = reviewerNotes;
  if (applicationStatus && ['shortlisted','on_hold','accepted','rejected'].includes(applicationStatus)) {
    app.status = applicationStatus;
  }
  await app.save();
  try {
    await notify({ user: app.candidate._id, title:'Task reviewed', message:`${t.title} has been reviewed.`, link:`/applications/me`, type:'task', req });
  } catch {}
  res.json(app);
};

// --- Phase 2: Instant interview invite (no schedule) ---
export const inviteInstantInterview = async (req, res) => {
  const { id } = req.params; // application id
  const app = await Application.findById(id).populate({ path: 'job', select: 'employer' }).lean();
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (String(app.job.employer) !== String(req.user._id)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const note = await Notification.create({ user: app.candidate, title: 'Interview now', message: 'Join the live interview room', link: `/call/${id}`, type: 'application' });
    req.io?.to?.(`user:${String(app.candidate)}`)?.emit?.('notify:new', { id: String(note._id), title: note.title, message: note.message, link: note.link, createdAt: note.createdAt });
  } catch {}
  // send chat message with call link
  try {
    const convo = await (async () => {
      const sorted = [String(req.user._id), String(app.candidate)].sort();
      const key = `${id}:${sorted[0]}:${sorted[1]}`;
      let c = await Conversation.findOne({ key });
      if (!c) c = await Conversation.create({ application: id, participants: sorted, key });
      return c;
    })();
    const link = `${req.headers.origin || ''}/call/${id}`;
    const body = `Join video call: ${link}`;
    const [a, b] = (convo.participants || []).map(String);
    const recipient = a === String(req.user._id) ? b : a;
    const msg = await Message.create({ conversation: convo._id, sender: req.user._id, recipient, body });
    await Conversation.updateOne({ _id: convo._id }, { lastMessageAt: msg.createdAt });
    req.io?.to?.(`conv:${String(convo._id)}`)?.emit?.('chat:new', { conversationId: String(convo._id), message: { _id: String(msg._id), conversation: String(convo._id), sender: String(msg.sender), recipient: String(msg.recipient), body: msg.body, createdAt: msg.createdAt } });
  } catch {}
  res.json({ ok: true });
};
// --- Interview scheduling ---
const ensureConversation = async ({ applicationId, aId, bId }) => {
  const sorted = [String(aId), String(bId)].sort();
  const key = `${applicationId}:${sorted[0]}:${sorted[1]}`;
  let convo = await Conversation.findOne({ key });
  if (!convo) {
    convo = await Conversation.create({ application: applicationId, participants: sorted, key });
  }
  return convo;
};

export const scheduleInterview = async (req, res) => {
  const { id } = req.params; // application id
  const { at, notes } = req.body || {};
  const when = at ? new Date(at) : null;
  if (!when || isNaN(when.getTime())) return res.status(400).json({ error: 'Invalid datetime' });
  const app = await Application.findById(id).populate({ path: 'job', select: 'employer' }).lean();
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (String(app.job.employer) !== String(req.user._id)) return res.status(403).json({ error: 'Forbidden' });
  await Application.updateOne({ _id: id }, { interview: { at: when, status: 'scheduled', notes: notes || '', createdBy: req.user._id } });

  // notify candidate
  try {
    const note = await Notification.create({ user: app.candidate, title: 'Interview scheduled', message: `Interview set for ${when.toLocaleString()}`, link: `/chat`, type: 'application' });
    req.io?.to?.(`user:${String(app.candidate)}`)?.emit?.('notify:new', { id: String(note._id), title: note.title, message: note.message, link: note.link, createdAt: note.createdAt });
  } catch {}

  // send chat message with call link
  try {
    const convo = await ensureConversation({ applicationId: id, aId: req.user._id, bId: app.candidate });
    const body = `Interview scheduled for ${when.toLocaleString()}\nJoin: ${req.headers.origin || ''}/call/${id}`.trim();
    const [a, b] = (convo.participants || []).map(String);
    const recipient = a === String(req.user._id) ? b : a;
    const msg = await Message.create({ conversation: convo._id, sender: req.user._id, recipient, body });
    await Conversation.updateOne({ _id: convo._id }, { lastMessageAt: msg.createdAt });
    req.io?.to?.(`conv:${String(convo._id)}`)?.emit?.('chat:new', { conversationId: String(convo._id), message: { _id: String(msg._id), conversation: String(convo._id), sender: String(msg.sender), recipient: String(msg.recipient), body: msg.body, createdAt: msg.createdAt } });
  } catch {}

  res.status(201).json({ ok: true, at: when, notes: notes || '' });
};

export const updateInterview = async (req, res) => {
  const { id } = req.params;
  const { at, status, notes } = req.body || {};
  const app = await Application.findById(id).populate({ path: 'job', select: 'employer' }).lean();
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (String(app.job.employer) !== String(req.user._id)) return res.status(403).json({ error: 'Forbidden' });
  const patch = {};
  if (typeof notes === 'string') patch['interview.notes'] = notes;
  if (at) {
    const when = new Date(at); if (isNaN(when.getTime())) return res.status(400).json({ error: 'Invalid datetime' });
    patch['interview.at'] = when; patch['interview.status'] = 'scheduled';
  }
  if (status && ['scheduled','canceled','completed'].includes(status)) patch['interview.status'] = status;
  await Application.updateOne({ _id: id }, { $set: patch });
  res.json({ ok: true });
};

export const applyToJob = async (req, res) => {
  const { jobId, name, email, coverLetter } = req.body;
  const job = await Job.findById(jobId).populate('employer');
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const dup = await Application.findOne({ job: jobId, candidate: req.user._id });
  if (dup) return res.status(409).json({ error: 'Already applied' });

  // Upload resume to Cloudinary if provided (resource_type: 'raw')
  let resumePublicPath;
  if (req.file && req.file.buffer) {
    const uploadFromBuffer = (fileBuffer, filename) =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'sawconnect/resumes',
            filename_override: filename,
            use_filename: true,
          },
          (err, result) => {
            if (err) return reject(err);
            return resolve(result);
          }
        );
        stream.end(fileBuffer);
      });
    try {
      const up = await uploadFromBuffer(req.file.buffer, req.file.originalname || 'resume');
      resumePublicPath = up.secure_url;
    } catch (e) {
      return res.status(500).json({ error: 'Resume upload failed', details: e?.message });
    }
  }

  const app = await Application.create({ job: jobId, candidate: req.user._id, name, email, coverLetter, resumePublicPath });

  try {
    await notify({ user: job.employer._id, title:`New application: ${job.title}`, message:`${name} applied to ${job.title}.`, link:`/employer/manage/${job._id}`, type:'application', req });
    await sendEmail({ to: job.employer.email, subject:`New application for ${job.title}`, html:`<p>${name} applied to <strong>${job.title}</strong>.</p><p>Email: ${email}</p>` });
    await sendEmail({ to: email, subject:`Application received: ${job.title}`, html:`<p>Your application to <strong>${job.title}</strong> was received.</p>` });
  } catch {}

  return res.status(201).json(app);
};

export const myApplications = async (req, res) => {
  const apps = await Application.find({ candidate: req.user._id })
    .sort({ createdAt: -1 })
    .populate({
      path: 'job',
      select: 'title company location employer team',
      populate: [
        { path: 'employer', select: 'name email role avatarUrl headline' },
        { path: 'team', select: 'name email role avatarUrl headline' }
      ]
    })
    .populate({ path: 'candidate', select: 'name email role avatarUrl headline' })
    .lean();
  res.json(apps);
};

export const employerApplications = async (req, res) => {
  const { jobId, status } = req.query;
  const filter = {};
  if (jobId) filter.job = jobId;
  if (status) filter.status = status;
  const apps = await Application.find(filter)
    .populate({
      path: 'job',
      populate: [
        { path: 'employer', select: 'name email role avatarUrl headline' },
        { path: 'team', select: 'name email role avatarUrl headline' }
      ]
    })
    .populate({ path: 'candidate', select: 'name email role avatarUrl headline' });
  const owned = apps.filter(a => a.job.employer.toString() === req.user._id.toString());
  res.json(owned);
};

export const getApplicationDetail = async (req, res) => {
  const { id } = req.params;
  const application = await Application.findById(id)
    .populate({
      path: 'job',
      select: 'title company location employer team',
      populate: [
        { path: 'employer', select: 'name email role avatarUrl headline' },
        { path: 'team', select: 'name email role avatarUrl headline' }
      ]
    })
    .populate({ path: 'candidate', select: 'name email role avatarUrl headline' })
    .lean();
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const viewerId = String(req.user._id);
  const candidateId = String(application.candidate?._id || application.candidate);
  const employerId = String(application.job?.employer?._id || application.job?.employer || '');
  const teamIds = (application.job?.team || []).map((member) => String(member?._id || member));

  const allowedIds = [candidateId, employerId, ...teamIds];
  if (!allowedIds.includes(viewerId)) return res.status(403).json({ error: 'Forbidden' });

  const job = application.job || {};
  const employerDoc = job.employer || {};
  const teamDocs = Array.isArray(job.team) ? job.team : [];
  const candidate = application.candidate || {};
  res.json({
    id: String(application._id),
    status: application.status,
    createdAt: application.createdAt,
    job: {
      id: job?._id ? String(job._id) : null,
      title: job.title,
      company: job.company,
      location: job.location,
      employer: employerId
        ? {
            id: employerId,
            name: employerDoc.name || '',
            email: employerDoc.email || '',
            avatarUrl: employerDoc.avatarUrl || '',
            headline: employerDoc.headline || '',
            role: employerDoc.role || 'employer',
          }
        : null,
      team: teamDocs.map((member) => ({
        id: String(member._id || member),
        name: member.name || '',
        email: member.email || '',
        avatarUrl: member.avatarUrl || '',
        headline: member.headline || '',
        role: member.role || 'team',
      })),
    },
    candidate: {
      id: candidateId,
      name: candidate.name || application.name,
      email: candidate.email || application.email,
      headline: candidate.headline || '',
      avatarUrl: candidate.avatarUrl || '',
      role: candidate.role || 'candidate',
    },
    viewerRole:
      viewerId === candidateId ? 'candidate' : viewerId === employerId ? 'employer' : 'team',
  });
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
    const titleMap = {
      accepted: 'Application accepted',
      rejected: 'Application rejected',
      reviewed: 'Application under review',
      shortlisted: 'Application shortlisted',
      on_hold: 'Application on hold',
      task_assigned: 'Task assigned',
    };
    await notify({ user: app.candidate._id, title: titleMap[status] || 'Application update', message:`${app.job.title} at ${app.job.company} — status: ${status}`, link:`/jobs/${app.job._id}`, type:'status', req });
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
      await notify({ user: app.candidate._id, title:'Application under review', message:`Employer viewed your resume for ${app.job.title}.`, link:`/jobs/${app.job._id}`, type:'status', req });
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

