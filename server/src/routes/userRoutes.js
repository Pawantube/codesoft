import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { me, updateMe } from '../controllers/authController.js';
import { getProfile, followUser, unfollowUser, listUserPosts } from '../controllers/socialController.js';
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

// Public/social routes (require auth to compute isFollowing and to act)
router.get('/:id', requireAuth, getProfile);
router.get('/:id/posts', requireAuth, listUserPosts);
router.post('/:id/follow', requireAuth, followUser);
router.delete('/:id/follow', requireAuth, unfollowUser);
