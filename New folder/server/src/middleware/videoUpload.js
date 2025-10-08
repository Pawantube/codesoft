// import fs from 'fs';
// import path from 'path';
// import multer from 'multer';
// import crypto from 'crypto';

// const videosDir = path.resolve('uploads', 'videos');
// fs.mkdirSync(videosDir, { recursive: true });

// const allowedExt = new Set(['.mp4', '.mov', '.webm', '.mkv']);

// const storage = multer.diskStorage({
//   destination: (_req, _file, cb) => cb(null, videosDir),
//   filename: (_req, file, cb) => {
//     const ext = path.extname(file.originalname || '').toLowerCase() || '.mp4';
//     cb(null, `${crypto.randomUUID()}${ext}`);
//   }
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
//   fileFilter: (_req, file, cb) => {
//     const ext = path.extname(file.originalname || '').toLowerCase();
//     if (!allowedExt.has(ext)) return cb(new Error('Unsupported video format'));
//     cb(null, true);
//   }
// }).single('video');

// export const uploadVideoMiddleware = (req, res, next) => {
//   upload(req, res, (err) => {
//     if (err) return res.status(400).json({ error: err.message });
//     next();
//   });
// };
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import mime from 'mime-types';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute folders that match the /uploads static mount
export const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
export const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VIDEOS_DIR),
  filename: (_req, file, cb) => {
    const id = crypto.randomUUID();
    const ext =
      mime.extension(file.mimetype) ||
      path.extname(file.originalname).slice(1) ||
      'mp4';
    cb(null, `${id}.${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype?.startsWith('video/')) return cb(null, true);
  cb(new Error('Only video files are allowed'), false);
};

export const uploadVideoMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
}).single('video');
