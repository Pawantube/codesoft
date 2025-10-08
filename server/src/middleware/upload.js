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
