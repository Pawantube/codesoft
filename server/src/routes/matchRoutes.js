import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoreApplication } from '../controllers/matchController.js';

const router = Router();
router.use(requireAuth);
router.post('/score', requireRole(['employer','admin']), scoreApplication);

export default router;
