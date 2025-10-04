import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { applyToJob, myApplications, employerApplications, updateStatus, downloadResume } from '../controllers/applicationController.js';

const router = Router();
const uploadDir = path.resolve('uploads','resumes');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req,_file,cb)=>cb(null, uploadDir),
  filename: (_req,file,cb)=>{ const ext=path.extname(file.originalname); cb(null, `${crypto.randomUUID()}${ext}`); }
});
const fileFilter = (_req,file,cb)=>{ const ok=['.pdf','.doc','.docx'].includes(path.extname(file.originalname).toLowerCase()); if(!ok) return cb(new Error('Only PDF/DOC/DOCX allowed')); cb(null,true); };
const upload = multer({ storage, fileFilter, limits:{ fileSize: 5*1024*1024 } });

router.post('/', requireAuth, requireRole('candidate'), upload.single('resume'), applyToJob);
router.get('/me', requireAuth, requireRole('candidate'), myApplications);
router.get('/employer', requireAuth, requireRole('employer'), employerApplications);
router.patch('/:id/status', requireAuth, requireRole('employer'), updateStatus);
router.get('/:id/resume', requireAuth, requireRole('employer'), downloadResume);

export default router;
