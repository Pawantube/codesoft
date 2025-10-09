import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadVideoMiddleware } from '../middleware/videoUpload.js';
import { requestScreening, getScreening, uploadScreening, reviewScreening } from '../controllers/screeningController.js';

const router = Router();
router.use(requireAuth);

router.get('/:applicationId', getScreening);
router.post('/:applicationId/request', requireRole(['employer','admin']), requestScreening);
router.post('/:applicationId/upload', requireRole(['candidate','admin']), uploadVideoMiddleware, uploadScreening);
router.patch('/:applicationId/review', requireRole(['employer','admin']), reviewScreening);

export default router;
