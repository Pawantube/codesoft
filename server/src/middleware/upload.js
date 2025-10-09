// server/src/middleware/upload.js
import path from 'path';
import multer from 'multer';

// Memory storage → controller decides Cloudinary upload
const storage = multer.memoryStorage();

export const uploadResume = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // allow pdf + common docs
    const ok = /pdf|doc|docx|rtf/.test(path.extname(file.originalname).toLowerCase());
    if (!ok) return cb(new Error('Only PDF/DOC/DOCX/RTF allowed'));
    cb(null, true);
  }
}).single('resume'); // <— form field name

// Generic attachment upload (any file) up to 25MB
export const uploadAttachment = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
}).single('file');

// Audio upload (webm/mp3/wav/m4a/ogg)
export const uploadAudio = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if ((file.mimetype || '').startsWith('audio/')) return cb(null, true);
    cb(new Error('Only audio files are allowed'));
  },
}).single('audio');
