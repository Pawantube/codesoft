import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { me, updateMe } from '../controllers/authController.js';
import { uploadVideoProfile, updateVideoProfileMeta } from '../controllers/videoProfileController.js';
import { uploadVideoMiddleware } from '../middleware/videoUpload.js';

const router = Router();

router.get('/me', requireAuth, me);
router.put('/me', requireAuth, updateMe);

router.post(
  '/me/video',
  requireAuth,
  requireRole(['candidate']),
  uploadVideoMiddleware,     // field name: "video"
  uploadVideoProfile
);

router.patch(
  '/me/video',
  requireAuth,
  requireRole(['candidate']),
  updateVideoProfileMeta
);

export default router;
