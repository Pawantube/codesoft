import Embeddings from '../models/Embeddings.js';
import Job from '../models/Job.js';
import User from '../models/User.js';

const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-large';

const fetchJson = async (url, opts) => {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  return res.json();
};

const embedText = async (text) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const body = { model: MODEL, input: text.slice(0, 7000) };
  const data = await fetchJson(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error('No embedding');
  return vec;
};

export const cosine = (a, b) => {
  if (!a?.length || !b?.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot/denom : 0;
};

export const upsertJobEmbedding = async (jobId) => {
  const job = await Job.findById(jobId).select('title description location company').lean();
  if (!job) return null;
  const text = `${job.title || ''}\n${job.company || ''}\n${job.location || ''}\n${job.description || ''}`;
  const vector = await embedText(text);
  await Embeddings.findOneAndUpdate({ docId: jobId, type: 'job' }, { vector, meta: { title: job.title } }, { upsert: true });
  return vector;
};

export const upsertProfileEmbedding = async (userId) => {
  const u = await User.findById(userId).select('headline bio location skills interests').lean();
  if (!u) return null;
  const text = `${u.headline || ''}\n${u.bio || ''}\n${u.location || ''}\nSkills: ${(u.skills||[]).join(', ')}\nInterests: ${(u.interests||[]).join(', ')}`;
  const vector = await embedText(text);
  await Embeddings.findOneAndUpdate({ docId: userId, type: 'profile' }, { vector, meta: { name: u.name } }, { upsert: true });
  return vector;
};

export const getEmbedding = async (type, docId) => {
  const row = await Embeddings.findOne({ type, docId }).lean();
  return row?.vector || null;
};

export default {
  upsertJobEmbedding,
  upsertProfileEmbedding,
  getEmbedding,
  cosine,
};
