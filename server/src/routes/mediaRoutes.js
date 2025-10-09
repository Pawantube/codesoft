import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadImageMemory } from '../middleware/imageUpload.js';
import { uploadAttachment } from '../middleware/upload.js';
import { uploadAvatar, uploadTaskAttachment } from '../controllers/mediaController.js';

const router = Router();

router.post('/avatar', requireAuth, uploadImageMemory, uploadAvatar);
router.post('/task-attachment', requireAuth, uploadAttachment, uploadTaskAttachment);

export default router;
