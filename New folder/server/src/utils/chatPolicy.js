import Application from '../models/Application.js';
import Job from '../models/Job.js';

export async function canStartOrSend({ applicationId, aId, bId }) {
  const app = await Application.findById(applicationId).lean();
  if (!app) return { ok: false, reason: 'APPLICATION_NOT_FOUND' };

  const job = await Job.findById(app.job).lean();
  if (!job) return { ok: false, reason: 'JOB_NOT_FOUND' };

  const candidateId = String(app.candidate);
  const recruiterId = String(job.employer); // your schema uses "employer"
  const team = (job.team || []).map(String);

  const A = String(aId), B = String(bId);
  const pair = new Set([A, B]);

  if (!pair.has(candidateId)) return { ok: false, reason: 'NOT_CANDIDATE_PAIR' };
  const other = A === candidateId ? B : A;

  if (other !== recruiterId && !team.includes(other)) {
    return { ok: false, reason: 'NOT_AUTHORIZED_PARTNER' };
  }
  return { ok: true, candidateId, recruiterId, team };
}
