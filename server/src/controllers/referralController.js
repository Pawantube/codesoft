import Referral from '../models/Referral.js';
import Job from '../models/Job.js';

const pickClientBase = () => {
  const list = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list[0] || 'http://localhost:5173';
};

const shortCode = () => Math.random().toString(36).slice(2, 10);

export const createOrGetReferral = async (req, res) => {
  try {
    const { jobId } = req.body || {};
    if (!jobId) return res.status(400).json({ error: 'jobId required' });
    const job = await Job.findById(jobId).select('slug _id').lean();
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // One link per employer user per job
    let ref = await Referral.findOne({ job: jobId, referrerUser: req.user._id });
    if (!ref) {
      let code;
      // ensure unique code
      for (let i = 0; i < 5; i++) {
        code = shortCode();
        const exists = await Referral.findOne({ code }).lean();
        if (!exists) break; code = null;
      }
      if (!code) return res.status(500).json({ error: 'Failed to mint referral code' });
      ref = await Referral.create({ job: jobId, referrerUser: req.user._id, code });
    }

    const client = pickClientBase();
    const jobPath = job.slug ? `/jobs/${job.slug}` : `/jobs/${job._id}`;
    const url = `${client}${jobPath}?ref=${ref.code}`;

    res.json({
      id: String(ref._id),
      code: ref.code,
      url,
      clickedCount: ref.clickedCount,
      status: ref.status,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create referral' });
  }
};

export const listReferrals = async (req, res) => {
  try {
    const { job } = req.query || {};
    const q = { referrerUser: req.user._id };
    if (job) q.job = job;
    const items = await Referral.find(q).sort({ createdAt: -1 }).lean();
    const client = pickClientBase();
    const jobSlugs = new Map();
    for (const r of items) {
      if (!jobSlugs.has(String(r.job))) {
        const j = await Job.findById(r.job).select('slug _id').lean();
        jobSlugs.set(String(r.job), j?.slug ? `/jobs/${j.slug}` : `/jobs/${j?._id}`);
      }
    }
    const rows = items.map((r) => {
      const path = jobSlugs.get(String(r.job)) || `/jobs/${r.job}`;
      return {
        id: String(r._id),
        job: String(r.job),
        code: r.code,
        clickedCount: r.clickedCount,
        status: r.status,
        url: `${client}${path}?ref=${r.code}`,
        createdAt: r.createdAt,
      };
    });
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to list referrals' });
  }
};

export const referralRedirect = async (req, res) => {
  try {
    const { code } = req.params;
    const ref = await Referral.findOneAndUpdate({ code }, { $inc: { clickedCount: 1 } }, { new: true });
    if (!ref) return res.redirect(302, pickClientBase());
    const job = await Job.findById(ref.job).select('slug _id').lean();
    const base = pickClientBase();
    const path = job?.slug ? `/jobs/${job.slug}` : `/jobs/${job?._id}`;
    res.redirect(302, `${base}${path}?ref=${code}`);
  } catch {
    res.redirect(302, pickClientBase());
  }
};

export const convertReferral = async (req, res) => {
  try {
    const { code, status } = req.body || {};
    if (!code || !status) return res.status(400).json({ error: 'code and status required' });
    const allowed = new Set(['applied', 'hired']);
    if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid status' });
    const update = { status };
    if (status === 'applied') update.appliedAt = new Date();
    if (status === 'hired') update.hiredAt = new Date();
    const ref = await Referral.findOneAndUpdate({ code }, update, { new: true });
    if (!ref) return res.status(404).json({ error: 'Referral not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to convert referral' });
  }
};

export const payoutReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const { txnRef } = req.body || {};
    const ref = await Referral.findById(id);
    if (!ref) return res.status(404).json({ error: 'Referral not found' });
    ref.status = 'paid';
    ref.paidAt = new Date();
    await ref.save();
    res.json({ ok: true, paidAt: ref.paidAt, txnRef: txnRef || null });
  } catch {
    res.status(500).json({ error: 'Failed to mark payout' });
  }
};
