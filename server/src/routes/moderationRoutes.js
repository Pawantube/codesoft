import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { moderate } from '../controllers/moderationController.js';

const router = Router();
router.use(requireAuth);
// Allow both roles; UI will show warnings before posting
router.post('/', requireRole(['candidate','employer','admin']), moderate);

export default router;
