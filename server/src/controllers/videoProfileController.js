import fs from 'fs';
import path from 'path';
import User from '../models/User.js';

const videosDir = path.resolve('uploads', 'videos');

const removeFileIfExists = (relativePath) => {
  if (!relativePath) return;
  const normalized = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const fullPath = path.resolve(normalized);
  if (!fullPath.startsWith(videosDir)) return;
  fs.promises.stat(fullPath).then(() => fs.promises.unlink(fullPath)).catch(() => {});
};

const parseTags = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

export const uploadVideoProfile = async (req, res) => {
  if (req.user.role !== 'candidate') {
    return res.status(403).json({ error: 'Only candidates can upload intro videos' });
  }

  if (!req.file) return res.status(400).json({ error: 'No video file received' });

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.videoUrl) removeFileIfExists(user.videoUrl);

  const filename = req.file.filename;
  const videoUrl = `/uploads/videos/${filename}`;
  user.videoUrl = videoUrl;
  user.videoStatus = 'approved'; // auto-approve for now; hook moderation later
  user.videoUpdatedAt = new Date();

  if (req.body.duration) {
    const duration = Number(req.body.duration);
    if (Number.isFinite(duration) && duration >= 0) user.videoDuration = duration;
  }

  if (req.body.tags) {
    user.videoTags = parseTags(req.body.tags);
  }

  await user.save();
  res.json({
    videoUrl: user.videoUrl,
    videoStatus: user.videoStatus,
    videoTags: user.videoTags,
    videoDuration: user.videoDuration,
  });
};

export const updateVideoProfileMeta = async (req, res) => {
  if (req.user.role !== 'candidate') {
    return res.status(403).json({ error: 'Only candidates can update video profile' });
  }

  const updates = {};
  if (req.body.tags) updates.videoTags = parseTags(req.body.tags);
  if (req.body.videoTags) updates.videoTags = parseTags(req.body.videoTags);

  if ('videoDuration' in req.body) {
    const duration = Number(req.body.videoDuration);
    if (Number.isFinite(duration) && duration >= 0) updates.videoDuration = duration;
  }

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });
  updates.videoUpdatedAt = new Date();

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    videoUrl: user.videoUrl,
    videoStatus: user.videoStatus,
    videoTags: user.videoTags,
    videoDuration: user.videoDuration,
  });
};
