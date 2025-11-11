import InterviewRecord from '../models/InterviewRecord.js';
import Application from '../models/Application.js';

// Ensure a record exists for application
const ensureRecord = async (applicationId) => {
  let rec = await InterviewRecord.findOne({ application: applicationId });
  if (!rec) rec = await InterviewRecord.create({ application: applicationId });
  return rec;
};

// AI provider config (OpenAI-compatible). If AI_* vars are not set, falls back to OpenAI.
const getAiConfig = () => {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  return { apiKey, baseUrl, model };
};

export const generateScorecard = async (req, res) => {
  const { applicationId } = req.params;
  const { rubric } = req.body || {};
  const rec = await ensureRecord(applicationId);
  const transcript = (rec.transcriptText || '').trim();
  if (!transcript) return res.status(400).json({ error: 'No transcript available' });
  const questions = Array.isArray(rec.questions) ? rec.questions : [];

  const { apiKey, baseUrl, model } = getAiConfig();
  if (!apiKey) {
    // Fallback: naive scorecard with zero scores
    const criteria = questions.map(q => ({ questionId: q.id, criterion: q.text, score: 0, rationale: 'AI not configured' }));
    rec.scorecard = {
      overallScore: 0,
      summary: 'AI not configured. Provide OPENAI_API_KEY to enable automated scoring.',
      criteria,
      provider: 'naive',
      generatedAt: new Date(),
    };
    await rec.save();
    return res.json({ scorecard: rec.scorecard });
  }

  try {
    const sys = 'You are an expert technical interviewer. Produce a JSON scorecard with 0-5 scores.';
    const prompt = {
      transcript,
      questions,
      rubric: rubric || null,
      format: {
        criteria: [
          { questionId: 'string', criterion: 'string', score: '0-5', rationale: 'string 1-2 sentences' }
        ]
      }
    };
    const { apiKey, baseUrl, model } = getAiConfig();
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Return ONLY JSON. Use this:\nQuestions: ${JSON.stringify(questions)}\nTranscript: ${transcript}\nRubric (optional): ${rubric ? JSON.stringify(rubric) : 'null'}\nSchema: ${JSON.stringify(prompt.format)}` }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    });
    if (!resp.ok) throw new Error(`AI provider ${resp.status}`);
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    let parsed = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const overall = Number(parsed.overallScore) || 0;
    const criteria = Array.isArray(parsed.criteria) ? parsed.criteria.map(c => ({
      questionId: String(c.questionId || ''),
      criterion: String(c.criterion || ''),
      score: Number(c.score) || 0,
      rationale: String(c.rationale || ''),
    })) : [];
    rec.scorecard = {
      overallScore: overall,
      summary: String(parsed.summary || ''),
      criteria,
      model,
      provider: process.env.AI_API_KEY ? 'custom' : 'openai',
      generatedAt: new Date(),
    };
    await rec.save();
    res.json({ scorecard: rec.scorecard });
  } catch (e) {
    rec.scorecard = {
      overallScore: 0,
      summary: 'Scorecard generation failed. Showing fallback.',
      criteria: questions.map(q => ({ questionId: q.id, criterion: q.text, score: 0, rationale: 'fallback' })),
      provider: 'fallback',
      generatedAt: new Date(),
    };
    await rec.save();
    res.json({ scorecard: rec.scorecard, error: e?.message });
  }
};

export const getInterviewMeta = async (req, res) => {
  const { applicationId } = req.params;
  try {
    const app = await (await import('../models/Application.js')).default
      .findById(applicationId)
      .populate({ path: 'job', select: 'title company location employer' })
      .lean();
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const at = app?.interview?.at ? new Date(app.interview.at) : null;
    const durationMin = 45;
    const end = at ? new Date(new Date(at).getTime() + durationMin*60000) : null;
    const title = `${app.job?.title || 'Interview'}${app.job?.company ? ' – ' + app.job.company : ''}`;
    const description = `Interview for ${app.job?.title || ''}${app.job?.company ? ' at ' + app.job.company : ''}`.trim();
    const location = app.job?.location || '';
    res.json({
      applicationId: String(app._id),
      at: at ? at.toISOString() : null,
      end: end ? end.toISOString() : null,
      title,
      description,
      location,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load interview meta' });
  }
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
    summaryText: rec.summaryText || '',
    questions: rec.questions || [],
    scorecard: rec.scorecard || null
  });
};

export const addNote = async (req, res) => {
  const { applicationId } = req.params;
  const { text, tag } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Note text required' });
  const rec = await ensureRecord(applicationId);
  const allowed = new Set(['general', 'strength', 'concern', 'next_step']);
  const safeTag = allowed.has(String(tag)) ? String(tag) : 'general';
  rec.notes.push({ author: req.user._id, text: String(text), tag: safeTag });
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

export const setQuestions = async (req, res) => {
  const { applicationId } = req.params;
  const { questions } = req.body || {};
  if (!Array.isArray(questions) || questions.length === 0) return res.status(400).json({ error: 'questions[] required' });
  const safe = questions.map((q, i) => ({
    id: String(q.id || i + 1),
    text: String(q.text || ''),
    weight: Number.isFinite(Number(q.weight)) ? Number(q.weight) : 1,
    category: q.category ? String(q.category) : undefined,
  })).filter(x => x.text);
  const rec = await ensureRecord(applicationId);
  rec.questions = safe;
  await rec.save();
  res.json({ ok: true, questions: rec.questions });
};

export const summarize = async (req, res) => {
  const { applicationId } = req.params;
  const rec = await ensureRecord(applicationId);
  const text = rec.transcriptText || '';
  if (!text.trim()) return res.status(400).json({ error: 'No transcript to summarize' });

  const { apiKey, baseUrl, model } = getAiConfig();
  if (!apiKey) {
    // Fallback: naive summary (first 800 chars)
    const naive = text.slice(0, 800);
    rec.summaryText = `Summary (naive preview):\n${naive}`;
    await rec.save();
    return res.json({ summaryText: rec.summaryText, provider: 'naive' });
  }

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are an assistant that writes concise interview summaries with bullet points: strengths, concerns, next steps.' },
          { role: 'user', content: `Transcript:\n\n${text}\n\nWrite a concise summary (max 200 words) with bullet points for: strengths, concerns, next steps.` }
        ],
        temperature: 0.3,
      })
    });
    if (!resp.ok) throw new Error(`AI provider ${resp.status}`);
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    rec.summaryText = content;
    await rec.save();
    res.json({ summaryText: content, provider: process.env.AI_API_KEY ? 'custom' : 'openai' });
  } catch (e) {
    const naive = text.slice(0, 800);
    rec.summaryText = `Summary (fallback):\n${naive}`;
    await rec.save();
    res.json({ summaryText: rec.summaryText, provider: 'fallback', error: e?.message });
  }
};
