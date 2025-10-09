import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadResume } from '../middleware/upload.js';
import { parseResume, coverLetter } from '../controllers/resumeController.js';

const router = Router();
router.use(requireAuth);

router.post('/parse', uploadResume, parseResume);
router.post('/cover-letter', coverLetter);

export default router;
