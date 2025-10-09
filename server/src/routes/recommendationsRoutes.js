import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { recommendJobs, recommendCandidates } from '../controllers/recommendationsController.js';

const router = Router();
router.use(requireAuth);
router.get('/jobs', recommendJobs);
router.get('/candidates', recommendCandidates);

export default router;
