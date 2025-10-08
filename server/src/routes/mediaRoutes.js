import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadImageMemory } from '../middleware/imageUpload.js';
import { uploadAvatar } from '../controllers/mediaController.js';

const router = Router();

router.post('/avatar', requireAuth, uploadImageMemory, uploadAvatar);

export default router;
