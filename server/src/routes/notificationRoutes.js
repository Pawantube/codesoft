import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listMyNotifications, markRead, markAllRead } from '../controllers/notificationController.js';
const router = Router();
router.get('/', requireAuth, listMyNotifications);
router.patch('/:id/read', requireAuth, markRead);
router.patch('/read-all', requireAuth, markAllRead);
export default router;
