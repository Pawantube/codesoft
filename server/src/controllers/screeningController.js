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

const OPENAI_URL_CHAT = 'https://api.openai.com/v1/chat/completions';
const callOpenAI = async ({ messages, model='gpt-4o-mini', temperature=0.2 }) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  const resp = await fetch(OPENAI_URL_CHAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature })
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
};

export const autoEvaluateScreening = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const scr = await Screening.findOne({ application: applicationId }).populate('job');
    if (!scr) return res.status(404).json({ error: 'Not found' });

    // For now, we evaluate based on job title/desc only (no transcript). Extend later with transcript.
    const job = scr.job || {};
    const prompt = `Evaluate a candidate's async video screening against this job. Score 0-5 for clarity, structure, technical depth. Return strict JSON with keys clarity, structure, technical, total (0-15) and feedback (short paragraph). Job: ${job.title || ''} at ${job.company || ''}.`;
    const content = await callOpenAI({ messages: [
      { role: 'system', content: 'You are a technical interviewer. Return strict JSON only.' },
      { role: 'user', content: prompt }
    ]});
    let json;
    try { json = JSON.parse(content); } catch { json = { clarity: 3, structure: 3, technical: 3, total: 9, feedback: content } }
    scr.evaluation = {
      totalScore: Number(json.total ?? (Number(json.clarity||0)+Number(json.structure||0)+Number(json.technical||0))),
      rubric: {
        clarity: Number(json.clarity||0),
        structure: Number(json.structure||0),
        technical: Number(json.technical||0),
      },
      feedback: String(json.feedback || '')
    };
    await scr.save();
    res.json({ ok: true, evaluation: scr.evaluation });
  } catch (e) {
    res.status(500).json({ error: 'Auto-eval failed' });
  }
};

export const exportScreeningCSV = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const scr = await Screening.findOne({ application: applicationId }).populate('job candidate application');
    if (!scr) return res.status(404).end('Not found');
    const rows = [
      ['Job', scr.job?.title || ''],
      ['Candidate', scr.candidate?.name || ''],
      [],
      ['Rubric','Score'],
      ['Clarity', scr.evaluation?.rubric?.clarity ?? 0],
      ['Structure', scr.evaluation?.rubric?.structure ?? 0],
      ['Technical', scr.evaluation?.rubric?.technical ?? 0],
      ['Total', scr.evaluation?.totalScore ?? 0],
      [],
      ['Feedback'],
      [scr.evaluation?.feedback || '']
    ];
    const csv = rows.map(r => r.map(v => typeof v === 'string' && v.includes(',') ? '"'+v.replace(/"/g,'""')+'"' : v).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="screening-eval.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).end('Export failed');
  }
};
