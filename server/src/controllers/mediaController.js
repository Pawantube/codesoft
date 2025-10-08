import cloudinary from '../utils/cloudinary.js';
import User from '../models/User.js';

export const uploadAvatar = async (req, res) => {
  if (!req.user?._id) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No image provided' });

  const uploadFromBuffer = (fileBuffer, filename) =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'sawconnect/avatars',
          filename_override: filename,
          use_filename: true,
          overwrite: true,
          transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto' }],
        },
        (err, result) => {
          if (err) return reject(err);
          return resolve(result);
        }
      );
      stream.end(fileBuffer);
    });

  try {
    const up = await uploadFromBuffer(req.file.buffer, req.file.originalname || 'avatar');
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatarUrl: up.secure_url },
      { new: true }
    ).lean();
    return res.status(201).json({ url: up.secure_url, user });
  } catch (e) {
    return res.status(500).json({ error: 'Avatar upload failed', details: e?.message });
  }
};
