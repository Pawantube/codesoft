import User from '../models/User.js';
import VideoInteraction from '../models/VideoInteraction.js';

const actionMetricMap = {
  view: 'videoMetrics.views',
  like: 'videoMetrics.likes',
  skip: 'videoMetrics.skips',
};

const parseList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

const computeScore = ({ candidate, viewer, interaction, interestFilters }) => {
  let score = 1;

  const candidateTags = candidate.videoTags || [];
  const candidateSkills = candidate.skills || [];
  const viewerInterests = viewer.interests || [];

  const tagMatches = candidateTags.filter((tag) => viewerInterests.includes(tag)).length;
  const skillMatches = candidateSkills.filter((skill) => viewerInterests.includes(skill)).length;
  const interestMatches = interestFilters.length
    ? candidateTags.filter((tag) => interestFilters.includes(tag)).length
    : 0;

  score += tagMatches * 2 + skillMatches + interestMatches * 3;

  if (candidate.videoUpdatedAt) {
    const days = (Date.now() - new Date(candidate.videoUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 30 - days) / 10; // up to +3 within 30 days
    score += recencyBoost;
  }

  if (interaction) {
    if (interaction.action === 'like') score += 10;
    if (interaction.action === 'view') score += Math.min(interaction.watchSeconds / 10, 4);
    if (interaction.action === 'skip') score -= 8;
  }

  return score;
};

export const getVideoFeed = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 25);
  const interestFilters = parseList(req.query.interest || req.query.interests);

  const viewer = await User.findById(req.user._id).lean();
  if (!viewer) return res.status(404).json({ error: 'Viewer not found' });

  const baseQuery = {
    role: 'candidate',
    videoUrl: { $exists: true, $ne: '' },
    videoStatus: { $in: ['approved'] },
  };

  if (req.query.includeSelf !== 'true') {
    baseQuery._id = { $ne: req.user._id };
  }

  const candidates = await User.find(baseQuery)
    .select('name headline location skills interests avatarUrl companyName videoUrl videoTags videoDuration videoMetrics videoUpdatedAt')
    .lean();

  if (!candidates.length) return res.json([]);

  const interactions = await VideoInteraction.find({ viewer: req.user._id }).lean();
  const interactionMap = new Map(interactions.map((i) => [String(i.candidate), i]));

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: computeScore({
        candidate,
        viewer,
        interaction: interactionMap.get(String(candidate._id)),
        interestFilters,
      }),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ candidate, score }) => ({
      candidateId: String(candidate._id),
      score,
      videoUrl: candidate.videoUrl,
      videoTags: candidate.videoTags || [],
      videoDuration: candidate.videoDuration || null,
      videoMetrics: candidate.videoMetrics || { views: 0, likes: 0, skips: 0 },
      updatedAt: candidate.videoUpdatedAt,
      candidate: {
        id: String(candidate._id),
        name: candidate.name,
        headline: candidate.headline,
        location: candidate.location,
        skills: candidate.skills || [],
        interests: candidate.interests || [],
        avatarUrl: candidate.avatarUrl,
        companyName: candidate.companyName,
      },
    }));

  res.json(ranked);
};

export const recordVideoInteraction = async (req, res) => {
  const { candidateId } = req.params;
  const { action, watchSeconds } = req.body || {};

  if (!['view', 'like', 'skip'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const candidate = await User.findById(candidateId);
  if (!candidate || candidate.role !== 'candidate') {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  const viewerId = req.user._id;
  if (String(candidate._id) === String(viewerId)) {
    return res.status(400).json({ error: 'Cannot record interaction on your own profile' });
  }

  const watchValue = Math.max(0, Number(watchSeconds) || 0);
  const score = action === 'like' ? 10 : action === 'view' ? Math.min(watchValue / 10, 4) : -5;

  const previous = await VideoInteraction.findOne({ viewer: viewerId, candidate: candidate._id });

  const interaction = await VideoInteraction.findOneAndUpdate(
    { viewer: viewerId, candidate: candidate._id },
    { action, score, watchSeconds: watchValue },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const inc = {};
  if (previous?.action !== action) {
    if (previous?.action) {
      const path = actionMetricMap[previous.action];
      if (path) inc[path] = (inc[path] || 0) - 1;
    }
    const path = actionMetricMap[action];
    if (path) inc[path] = (inc[path] || 0) + 1;
  } else if (!previous) {
    const path = actionMetricMap[action];
    if (path) inc[path] = (inc[path] || 0) + 1;
  }

  if (Object.keys(inc).length) {
    await User.updateOne({ _id: candidate._id }, { $inc: inc });
  }

  res.json({
    candidateId: String(candidate._id),
    action: interaction.action,
    score: interaction.score,
    watchSeconds: interaction.watchSeconds,
  });
};
