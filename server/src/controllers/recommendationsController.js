import Job from '../models/Job.js';
import User from '../models/User.js';
import Emb from '../services/embeddingsService.js';

// For candidates: recommend jobs similar to their profile
export const recommendJobs = async (req, res) => {
  try {
    if (req.user.role !== 'candidate') return res.status(403).json({ error: 'Only candidates' });
    let profileVec = await Emb.getEmbedding('profile', req.user._id);
    if (!profileVec) profileVec = await Emb.upsertProfileEmbedding(req.user._id);
    if (!profileVec) return res.json([]);

    const jobs = await Job.find({}).select('title company location description').limit(200).lean();
    const rows = [];
    for (const j of jobs) {
      let jv = await Emb.getEmbedding('job', j._id);
      if (!jv) jv = await Emb.upsertJobEmbedding(j._id);
      if (!jv) continue;
      const sim = Emb.cosine(profileVec, jv);
      rows.push({ id: String(j._id), title: j.title, company: j.company, location: j.location, score: Math.round(sim*100) });
    }
    rows.sort((a,b)=>b.score-a.score);
    res.json(rows.slice(0, 10));
  } catch (e) {
    res.status(500).json({ error: 'Failed to recommend jobs' });
  }
};

// For employers: recommend candidates for a given job
export const recommendCandidates = async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') return res.status(403).json({ error: 'Only employers' });
    const { job: jobId } = req.query || {};
    if (!jobId) return res.status(400).json({ error: 'job required' });
    let jobVec = await Emb.getEmbedding('job', jobId);
    if (!jobVec) jobVec = await Emb.upsertJobEmbedding(jobId);
    if (!jobVec) return res.json([]);

    const users = await User.find({ role: 'candidate' }).select('name headline location skills interests').limit(300).lean();
    const rows = [];
    for (const u of users) {
      let pv = await Emb.getEmbedding('profile', u._id);
      if (!pv) pv = await Emb.upsertProfileEmbedding(u._id);
      if (!pv) continue;
      const sim = Emb.cosine(jobVec, pv);
      rows.push({ id: String(u._id), name: u.name, headline: u.headline, location: u.location, score: Math.round(sim*100) });
    }
    rows.sort((a,b)=>b.score-a.score);
    res.json(rows.slice(0, 10));
  } catch (e) {
    res.status(500).json({ error: 'Failed to recommend candidates' });
  }
};
