import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { toggle, list, removeOne, countForCandidate } from '../controllers/interestController.js';

const router = Router();

router.post('/toggle', requireAuth, toggle);
router.get('/', requireAuth, list);
router.delete('/:candidateId', requireAuth, removeOne);
router.get('/count/:candidateId', countForCandidate);

export default router;
