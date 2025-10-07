import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listChannels,
  createChannel,
  joinChannel,
  leaveChannel,
  listMessages,
  postMessage,
} from '../controllers/channelController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listChannels);
router.post('/', createChannel);
router.post('/:id/join', joinChannel);
router.post('/:id/leave', leaveChannel);
router.get('/:id/messages', listMessages);
router.post('/:id/messages', postMessage);

export default router;
