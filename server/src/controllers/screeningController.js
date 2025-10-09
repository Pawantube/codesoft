import Screening from '../models/Screening.js';
import Application from '../models/Application.js';
import Notification from '../models/Notification.js';
import cloudinary from '../utils/cloudinary.js';
import { sendWebPushToUser } from '../utils/webPush.js';

const canEmployerManage = (app, userId) => String(app.job?.employer) === String(userId);

const notify = async ({ user, title, message, link, req }) => {
  try {
    const note = await Notification.create({ user, title, message, link, type: 'application' });
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
      await sendWebPushToUser({ userId: user, payload: { title, body: message, data: url ? { url } : {} } });
    } catch {}
  } catch {}
};

export const requestScreening = async (req, res) => {
  const { applicationId } = req.params;
  const app = await Application.findById(applicationId).populate('job');
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (!canEmployerManage(app, req.user._id)) return res.status(403).json({ error: 'Forbidden' });

  let scr = await Screening.findOne({ application: applicationId });
  if (!scr) {
    scr = await Screening.create({ application: applicationId, job: app.job._id, candidate: app.candidate, status: 'requested' });
  } else {
    scr.status = 'requested';
    await scr.save();
  }
  await notify({ user: app.candidate, title: 'Video screening requested', message: `Please submit a screening for ${app.job.title}.`, link: `/candidate`, req });
  res.status(201).json(scr);
};

export const getScreening = async (req, res) => {
  const { applicationId } = req.params;
  const scr = await Screening.findOne({ application: applicationId })
    .populate({ path: 'job', select: 'title company' })
    .populate({ path: 'candidate', select: 'name email' })
    .lean();
  if (!scr) return res.status(404).json({ error: 'Not found' });
  const app = await Application.findById(applicationId).populate('job');
  const viewer = String(req.user._id);
  const allowed = [String(app.candidate), String(app.job?.employer)];
  if (!allowed.includes(viewer)) return res.status(403).json({ error: 'Forbidden' });
  res.json(scr);
};

export const uploadScreening = async (req, res) => {
  const { applicationId } = req.params;
  if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No video' });
  const app = await Application.findById(applicationId).populate('job');
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (String(app.candidate) !== String(req.user._id)) return res.status(403).json({ error: 'Forbidden' });

  const uploadFromBuffer = (fileBuffer, filename) => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        folder: 'sawconnect/screenings',
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
    const up = await uploadFromBuffer(req.file.buffer, req.file.originalname || 'screening');
    let scr = await Screening.findOne({ application: applicationId });
    if (!scr) {
      scr = await Screening.create({ application: applicationId, job: app.job._id, candidate: app.candidate });
    }
    scr.videoUrl = up.secure_url;
    scr.status = 'submitted';
    await scr.save();
    await notify({ user: app.job.employer, title: 'Screening submitted', message: `${app.name || 'Candidate'} submitted a screening.`, link: `/employer/manage/${app.job._id}`, req });
    res.status(201).json({ url: up.secure_url });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed', details: e?.message });
  }
};

export const reviewScreening = async (req, res) => {
  const { applicationId } = req.params;
  const { reviewerNotes } = req.body || {};
  const app = await Application.findById(applicationId).populate('job');
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (!canEmployerManage(app, req.user._id)) return res.status(403).json({ error: 'Forbidden' });
  const scr = await Screening.findOne({ application: applicationId });
  if (!scr) return res.status(404).json({ error: 'Not found' });
  scr.reviewerNotes = reviewerNotes || '';
  scr.status = 'reviewed';
  scr.reviewedAt = new Date();
  await scr.save();
  res.json({ ok: true });
};
