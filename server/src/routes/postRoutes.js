import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import multer from 'multer';
import { list, create, toggleLike, remove, listComments, addComment } from '../controllers/postsController.js';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/', list);
router.post('/', requireAuth, upload.single('media'), create);
router.post('/:id/like', requireAuth, toggleLike);
router.delete('/:id', requireAuth, remove);
router.get('/:id/comments', listComments);
router.post('/:id/comments', requireAuth, addComment);

export default router;
