import Interest from '../models/Interest.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const isEmployer = (req) => req.user?.role === 'employer';

export const toggle = async (req, res) => {
  const employer = req.user._id;
  const { candidateId } = req.body || {};
  if (!candidateId) return res.status(400).json({ error: 'candidateId required' });
  if (!isEmployer(req)) return res.status(403).json({ error: 'Only employers can mark interest' });
  if (String(candidateId) === String(employer)) return res.status(400).json({ error: 'Invalid target' });

  const existing = await Interest.findOne({ employer, candidate: candidateId });
  if (existing) {
    await Interest.deleteOne({ _id: existing._id });
    const count = await Interest.countDocuments({ candidate: candidateId });
    return res.json({ interested: false, count });
  }

  await Interest.create({ employer, candidate: candidateId });
  const count = await Interest.countDocuments({ candidate: candidateId });

  try {
    const candidate = await User.findById(candidateId).select('_id');
    if (candidate) {
      const note = await Notification.create({
        user: candidate._id,
        title: 'New interest',
        message: `${req.user.name || 'An employer'} is interested in your video profile`,
        link: '/chat',
        type: 'engagement',
      });
      req.io?.to?.(`user:${String(candidate._id)}`)?.emit?.('notify:new', {
        id: String(note._id),
        title: note.title,
        message: note.message,
        link: note.link,
        createdAt: note.createdAt,
      });
    }
  } catch {}

  return res.status(201).json({ interested: true, count });
};

export const list = async (req, res) => {
  if (!isEmployer(req)) return res.status(403).json({ error: 'Only employers' });
  const rows = await Interest.find({ employer: req.user._id }).sort({ updatedAt: -1 }).lean();
  const ids = rows.map((r) => r.candidate);
  if (!ids.length) return res.json([]);
  const users = await User.find({ _id: { $in: ids } })
    .select('name headline location avatarUrl videoUrl videoTags companyName')
    .lean();
  const map = new Map(users.map((u) => [String(u._id), u]));
  const out = rows
    .map((r) => {
      const u = map.get(String(r.candidate));
      if (!u) return null;
      return {
        id: String(u._id),
        name: u.name,
        headline: u.headline,
        location: u.location,
        avatarUrl: u.avatarUrl,
        videoUrl: u.videoUrl,
        videoTags: u.videoTags || [],
        companyName: u.companyName,
        interestedAt: r.updatedAt,
      };
    })
    .filter(Boolean);
  res.json(out);
};

export const removeOne = async (req, res) => {
  if (!isEmployer(req)) return res.status(403).json({ error: 'Only employers' });
  const { candidateId } = req.params;
  await Interest.deleteOne({ employer: req.user._id, candidate: candidateId });
  res.json({ ok: true });
};

export const countForCandidate = async (req, res) => {
  const { candidateId } = req.params;
  const count = await Interest.countDocuments({ candidate: candidateId });
  res.json({ count });
};
