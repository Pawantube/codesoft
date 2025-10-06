import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listMyNotifications,
  markRead,
  markAllRead,
  savePushSubscription,
  removePushSubscription,
} from '../controllers/notificationController.js';

const router = Router();

router.get('/', requireAuth, listMyNotifications);
router.patch('/read-all', requireAuth, markAllRead);
router.patch('/:id/read', requireAuth, markRead);
router.post('/subscribe', requireAuth, savePushSubscription);
router.post('/unsubscribe', requireAuth, removePushSubscription);

export default router;
