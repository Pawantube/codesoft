import { Router } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadResume } from '../middleware/upload.js';
import {
  applyToJob,
  myApplications,
  employerApplications,
  updateStatus,
  getApplicationDetail,
  downloadResume,
  scheduleInterview,
  updateInterview,
  assignTask,
  submitTask,
  reviewTask,
  inviteInstantInterview,
} from '../controllers/applicationController.js';

const router = Router();

const multerErrorHandler = (err, _req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
};

router.post(
  '/',
  requireAuth,
  requireRole(['candidate', 'admin']),
  uploadResume,
  multerErrorHandler,
  applyToJob,
);
router.get('/me', requireAuth, requireRole(['candidate', 'admin']), myApplications);
router.get('/employer', requireAuth, requireRole(['employer', 'admin']), employerApplications);
router.patch('/:id/status', requireAuth, requireRole(['employer', 'admin']), updateStatus);
router.get('/:id', requireAuth, getApplicationDetail);
router.get('/:id/resume', requireAuth, requireRole(['employer', 'admin']), downloadResume);
router.post('/:id/invite', requireAuth, requireRole(['employer','admin']), scheduleInterview);
router.patch('/:id/invite', requireAuth, requireRole(['employer','admin']), updateInterview);

// Phase 2 routes
router.post('/:id/tasks', requireAuth, requireRole(['employer','admin']), assignTask);
router.post('/:id/tasks/:taskId/submit', requireAuth, requireRole(['candidate','admin']), submitTask);
router.patch('/:id/tasks/:taskId/review', requireAuth, requireRole(['employer','admin']), reviewTask);
router.post('/:id/invite-now', requireAuth, requireRole(['employer','admin']), inviteInstantInterview);

export default router;
