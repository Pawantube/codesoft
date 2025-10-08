import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import { VIDEOS_DIR } from '../middleware/videoUpload.js';

const parseTags = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
  return String(value).split(',').map(v => v.trim()).filter(Boolean);
};

// Safe delete inside VIDEOS_DIR only
const removeFileIfExists = async (publicPath) => {
  if (!publicPath) return;
  const basename = path.basename(publicPath);  // avoid traversal
  const full = path.join(VIDEOS_DIR, basename);
  try { await fs.promises.unlink(full); } catch { /* ignore */ }
};

// POST /api/users/me/video  (multipart/form-data, field: "video")
export const uploadVideoProfile = async (req, res) => {
  if (req.user.role !== 'candidate') {
    return res.status(403).json({ error: 'Only candidates can upload intro videos' });
  }
  if (!req.file) return res.status(400).json({ error: 'No video file received' });

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await removeFileIfExists(user.videoUrl);

  const fileName = req.file.filename;                // e.g. uuid.webm or uuid.mp4
  const videoUrl = `/uploads/videos/${fileName}`;    // public URL that exists on disk

  user.videoUrl = videoUrl;
  user.videoStatus = 'approved';                     // TODO: moderation if needed
  user.videoUpdatedAt = new Date();

  const d = Number(req.body.duration);
  if (Number.isFinite(d) && d >= 0) user.videoDuration = d;

  if (req.body.tags) user.videoTags = parseTags(req.body.tags);

  await user.save();
  res.json({
    videoUrl: user.videoUrl,
    videoStatus: user.videoStatus,
    videoTags: user.videoTags,
    videoDuration: user.videoDuration,
  });
};

// PATCH /api/users/me/video
export const updateVideoProfileMeta = async (req, res) => {
  if (req.user.role !== 'candidate') {
    return res.status(403).json({ error: 'Only candidates can update video profile' });
  }

  const updates = {};
  if (req.body.tags) updates.videoTags = parseTags(req.body.tags);
  if ('videoDuration' in req.body) {
    const d = Number(req.body.videoDuration);
    if (Number.isFinite(d) && d >= 0) updates.videoDuration = d;
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
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
