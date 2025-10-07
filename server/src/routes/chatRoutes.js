import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getConversations, getOrCreateConversation, getMessages, sendMessage, markRead, searchChatPartners } from '../controllers/chatController.js';

const router = express.Router();
router.use(requireAuth);

router.get('/search', searchChatPartners);
router.get('/conversations', getConversations);
router.post('/conversations', getOrCreateConversation);
router.get('/messages', getMessages);
router.post('/messages', sendMessage);
router.post('/read', markRead);

export default router;
