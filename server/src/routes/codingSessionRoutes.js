import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createSession,
  getSession,
  listSessions,
  updateCodeSnapshot,
  updateWhiteboardSnapshot,
  completeSession,
  runCode,
} from '../controllers/codingSessionController.js';

const router = Router();

router.use(requireAuth);

router.post('/', createSession);
router.get('/', listSessions);
router.get('/:id', getSession);
router.patch('/:id/code', updateCodeSnapshot);
router.patch('/:id/whiteboard', updateWhiteboardSnapshot);
router.post('/:id/run', runCode);
router.post('/:id/complete', completeSession);

export default router;

