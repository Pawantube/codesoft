import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createSession,
  getSession,
  listSessions,
  updateCodeSnapshot,
  completeSession,
  runCode,
} from '../controllers/codingSessionController.js';

const router = Router();

router.use(requireAuth);

router.post('/', createSession);
router.get('/', listSessions);
router.get('/:id', getSession);
router.patch('/:id/code', updateCodeSnapshot);
router.post('/:id/run', runCode);
router.post('/:id/complete', completeSession);

export default router;

