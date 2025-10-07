import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  applyToJob,
  myApplications,
  employerApplications,
  updateStatus,
  getApplicationDetail,
  downloadResume,
} from '../controllers/applicationController.js';

const router = Router();

const uploadDir = path.resolve('uploads', 'resumes');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const ok = ['.pdf', '.doc', '.docx', '.rtf'].includes(ext);
  if (!ok) return cb(new Error('Only PDF/DOC/DOCX/RTF allowed'));
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const multerErrorHandler = (err, _req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
};

router.post(
  '/',
  requireAuth,
  requireRole(['candidate', 'admin']),
  upload.single('resume'),
  multerErrorHandler,
  applyToJob,
);

router.get('/me', requireAuth, requireRole(['candidate', 'admin']), myApplications);
router.get('/employer', requireAuth, requireRole(['employer', 'admin']), employerApplications);
router.patch('/:id/status', requireAuth, requireRole(['employer', 'admin']), updateStatus);
router.get('/:id', requireAuth, getApplicationDetail);
router.get('/:id/resume', requireAuth, requireRole(['employer', 'admin']), downloadResume);

export default router;
