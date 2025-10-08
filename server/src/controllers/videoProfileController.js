import User from '../models/User.js';
import cloudinary from '../utils/cloudinary.js';

const parseTags = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
};

// no-op: previous local cleanup no longer needed with Cloudinary
const removeFileIfExists = async () => {};

// POST /api/users/me/video (multipart/form-data, field: "video")
export const uploadVideoProfile = async (req, res) => {
  if (req.user.role !== 'candidate') {
    return res.status(403).json({ error: 'Only candidates can upload intro videos' });
  }
  if (!req.file) return res.status(400).json({ error: 'No video file received' });

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await removeFileIfExists(user.videoUrl);

  // Upload to Cloudinary (resource_type: 'video')
  const uploadFromBuffer = (fileBuffer) =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'sawconnect/intro_videos',
          overwrite: true,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(fileBuffer);
    });

  let cloud;
  try {
    cloud = await uploadFromBuffer(req.file.buffer);
  } catch (e) {
    return res.status(500).json({ error: 'Upload failed', details: e?.message });
  }

  user.videoUrl = cloud.secure_url;
  user.videoStatus = 'approved';
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
