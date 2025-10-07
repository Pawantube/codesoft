import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';

const videosDir = path.resolve('uploads', 'videos');
fs.mkdirSync(videosDir, { recursive: true });

const allowedExt = new Set(['.mp4', '.mov', '.webm', '.mkv']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, videosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.mp4';
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExt.has(ext)) return cb(new Error('Unsupported video format'));
    cb(null, true);
  }
}).single('video');

export const uploadVideoMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};
