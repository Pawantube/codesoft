// server/src/middleware/upload.js
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';

const resumesDir = path.resolve('uploads', 'resumes');
fs.mkdirSync(resumesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, resumesDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.pdf';
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

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
