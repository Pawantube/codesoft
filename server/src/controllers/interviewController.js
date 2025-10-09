import InterviewRecord from '../models/InterviewRecord.js';
import Application from '../models/Application.js';

// Ensure a record exists for application
const ensureRecord = async (applicationId) => {
  let rec = await InterviewRecord.findOne({ application: applicationId });
  if (!rec) rec = await InterviewRecord.create({ application: applicationId });
  return rec;
};

// Return ICS calendar for a scheduled interview
export const getInterviewICS = async (req, res) => {
  const { applicationId } = req.params;
  try {
    const app = await (await import('../models/Application.js')).default
      .findById(applicationId)
      .populate({ path: 'job', select: 'title company location employer' })
      .lean();
    if (!app) return res.status(404).end('Application not found');
    if (!app.interview || app.interview.status !== 'scheduled' || !app.interview.at) {
      return res.status(400).end('No scheduled interview');
    }
    const dt = new Date(app.interview.at);
    const dtEnd = new Date(dt.getTime() + 45 * 60 * 1000);
    const toICS = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const uid = `interview-${String(app._id)}@sawconnect`;
    const title = `${app.job?.title || 'Interview'} – ${app.job?.company || ''}`.trim();
    const desc = `Interview for ${app.job?.title || ''} at ${app.job?.company || ''}`.trim();
    const location = app.job?.location || '';

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SawConnect//Interview//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${toICS(new Date())}`,
      `DTSTART:${toICS(dt)}`,
      `DTEND:${toICS(dtEnd)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc}`,
      location ? `LOCATION:${location}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="interview-${String(app._id)}.ics"`);
    res.send(ics);
  } catch (e) {
    res.status(500).end('Failed to build ICS');
  }
};

export const transcribeAudio = async (req, res) => {
  const { applicationId } = req.params;
  if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No audio' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(501).json({ error: 'Transcription not configured' });

  try {
    // OpenAI Whisper transcription via multipart/form-data
    const form = new FormData();
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' }), req.file.originalname || 'audio.webm');
    form.append('model', 'whisper-1');

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
    const data = await resp.json();
    const text = data?.text || '';

    const rec = await ensureRecord(applicationId);
    rec.transcriptText = (rec.transcriptText || '') + (text ? (rec.transcriptText ? '\n' : '') + text : '');
    await rec.save();
    res.json({ transcriptText: rec.transcriptText });
  } catch (e) {
    res.status(500).json({ error: 'Transcription failed', details: e?.message });
  }
};

export const getInterview = async (req, res) => {
  const { applicationId } = req.params;
  const rec = await ensureRecord(applicationId);
  res.json({
    application: String(rec.application),
    notes: rec.notes || [],
    transcriptText: rec.transcriptText || '',
    summaryText: rec.summaryText || ''
  });
};

export const addNote = async (req, res) => {
  const { applicationId } = req.params;
  const { text } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Note text required' });
  const rec = await ensureRecord(applicationId);
  rec.notes.push({ author: req.user._id, text: String(text) });
  await rec.save();
  res.status(201).json({ ok: true, notes: rec.notes });
};

export const setTranscript = async (req, res) => {
  const { applicationId } = req.params;
  const { transcriptText } = req.body || {};
  if (!transcriptText) return res.status(400).json({ error: 'transcriptText required' });
  const rec = await ensureRecord(applicationId);
  rec.transcriptText = String(transcriptText);
  await rec.save();
  res.json({ ok: true });
};

export const summarize = async (req, res) => {
  const { applicationId } = req.params;
  const rec = await ensureRecord(applicationId);
  const text = rec.transcriptText || '';
  if (!text.trim()) return res.status(400).json({ error: 'No transcript to summarize' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: naive summary (first 800 chars)
    const naive = text.slice(0, 800);
    rec.summaryText = `Summary (naive preview):\n${naive}`;
    await rec.save();
    return res.json({ summaryText: rec.summaryText, provider: 'naive' });
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an assistant that writes concise interview summaries with bullet points: strengths, concerns, next steps.' },
          { role: 'user', content: `Transcript:\n\n${text}\n\nWrite a concise summary (max 200 words) with bullet points for: strengths, concerns, next steps.` }
        ],
        temperature: 0.3,
      })
    });
    if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    rec.summaryText = content;
    await rec.save();
    res.json({ summaryText: content, provider: 'openai' });
  } catch (e) {
    const naive = text.slice(0, 800);
    rec.summaryText = `Summary (fallback):\n${naive}`;
    await rec.save();
    res.json({ summaryText: rec.summaryText, provider: 'fallback', error: e?.message });
  }
};
