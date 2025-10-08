import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getVideoFeed, recordVideoInteraction, listInterested } from '../controllers/feedController.js';

const router = Router();

router.get('/videos', requireAuth, getVideoFeed);
router.post('/videos/:candidateId/interactions', requireAuth, recordVideoInteraction);
router.get('/videos/interested', requireAuth, listInterested);

export default router;
