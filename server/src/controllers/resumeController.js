import User from '../models/User.js';

const OPENAI_URL_CHAT = 'https://api.openai.com/v1/chat/completions';

const openaiChat = async (messages, model='gpt-4o-mini', temperature=0.2) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const res = await fetch(OPENAI_URL_CHAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
};

export const parseResume = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No resume' });
    const text = Buffer.from(req.file.buffer).toString('utf8');

    // Quick heuristic: if binary (PDF), we still try raw text; in production integrate a PDF parser.
    const prompt = `Extract a structured JSON from the following resume text.
Return fields: name, headline, location, skills (array), experiences (array of {company, title, from, to, summary}), education (array), summary.
Only output valid JSON.`;
    const content = `${prompt}\n\nResume:\n${text.slice(0, 12000)}`;
    const out = await openaiChat([
      { role: 'system', content: 'You are a parser that returns strict JSON only.' },
      { role: 'user', content }
    ], 'gpt-4o-mini', 0);

    let json;
    try { json = JSON.parse(out); } catch { json = { summary: out } }
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: 'Parse failed' });
  }
};

export const coverLetter = async (req, res) => {
  try {
    const { jobTitle, jobDescription, profile } = req.body || {};
    if (!jobTitle || !jobDescription) return res.status(400).json({ error: 'jobTitle and jobDescription required' });

    const me = req.user ? await User.findById(req.user._id).select('name headline location skills bio').lean() : null;
    const profileText = profile || `${me?.name||''}\n${me?.headline||''}\n${me?.location||''}\nSkills: ${(me?.skills||[]).join(', ')}\n${me?.bio||''}`;

    const prompt = `Write a concise, tailored cover letter (<= 220 words) for the job below.
Use a confident, friendly tone, avoid fluff, and highlight the most relevant skills.
Return plain text only.

Job Title: ${jobTitle}
Job Description:\n${jobDescription.slice(0, 3000)}\n
Candidate Profile:\n${profileText.slice(0, 1500)}`;

    const letter = await openaiChat([
      { role: 'system', content: 'You write concise job application cover letters.' },
      { role: 'user', content: prompt }
    ], 'gpt-4o-mini', 0.3);

    res.json({ letter });
  } catch (e) {
    res.status(500).json({ error: 'Cover letter failed' });
  }
};
