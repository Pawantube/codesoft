import Application from '../models/Application.js';
import Job from '../models/Job.js';
import Emb from '../services/embeddingsService.js';

export const scoreApplication = async (req, res) => {
  try {
    const { applicationId } = req.query || {};
    if (!applicationId) return res.status(400).json({ error: 'applicationId required' });
    const app = await Application.findById(applicationId).select('job candidate').lean();
    if (!app) return res.status(404).json({ error: 'Application not found' });

    let jobVec = await Emb.getEmbedding('job', app.job);
    if (!jobVec) jobVec = await Emb.upsertJobEmbedding(app.job);
    let profileVec = await Emb.getEmbedding('profile', app.candidate);
    if (!profileVec) profileVec = await Emb.upsertProfileEmbedding(app.candidate);

    const sim = Emb.cosine(jobVec, profileVec); // 0..1
    const score = Math.round(sim * 100);
    await Application.findByIdAndUpdate(applicationId, { matchScore: score });
    res.json({ applicationId, matchScore: score });
  } catch (e) {
    res.status(500).json({ error: 'Failed to score application' });
  }
};
