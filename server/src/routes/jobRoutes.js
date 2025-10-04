// // import { Router } from 'express';
// // import { body } from 'express-validator';
// // import { requireAuth, requireRole } from '../middleware/auth.js';
// // import { createJob, listJobs, getJob, updateJob, deleteJob } from '../controllers/jobController.js';
// // const router = Router();
// // router.get('/', listJobs);
// // router.get('/:id', getJob);
// // router.post('/', requireAuth, requireRole('employer'), [body('title').notEmpty(), body('company').notEmpty(), body('location').notEmpty(), body('description').isLength({min:20})], createJob);
// // router.put('/:id', requireAuth, requireRole('employer'), updateJob);
// // router.delete('/:id', requireAuth, requireRole('employer'), deleteJob);
// // export default router;


// import { Router } from 'express';
// import { body } from 'express-validator';
// import { requireAuth, requireRole } from '../middleware/auth.js';
// import {
//   createJob, listJobs, getJob, updateJob, deleteJob,
//   myJobs, featureJob, duplicateJob
// } from '../controllers/jobController.js';

// const router = Router();

// router.get('/', listJobs);
// router.get('/:id', getJob);

// router.post('/', requireAuth, requireRole('employer'), [
//   body('title').notEmpty(),
//   body('company').notEmpty(),
//   body('location').notEmpty(),
//   body('description').isLength({ min: 20 })
// ], createJob);

// router.get('/mine/list', requireAuth, requireRole('employer'), myJobs);     // << NEW
// router.patch('/:id', requireAuth, requireRole('employer'), updateJob);
// router.delete('/:id', requireAuth, requireRole('employer'), deleteJob);
// router.patch('/:id/feature', requireAuth, requireRole('employer'), featureJob); // << NEW
// router.post('/:id/duplicate', requireAuth, requireRole('employer'), duplicateJob); // << NEW

// export default router;
import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createJob, listJobs, getJob, updateJob, deleteJob,
  myJobs, featureJob, duplicateJob, bulkInsert
} from '../controllers/jobController.js';

const router = Router();

// Public
router.get('/', listJobs);

// Employer-only (place before :id when endpoints are single-segment like /bulk)
router.post('/bulk', requireAuth, requireRole('employer'), bulkInsert);   // POST /api/jobs/bulk
router.get('/mine/list', requireAuth, requireRole('employer'), myJobs);   // GET  /api/jobs/mine/list

// Single job
router.get('/:id', getJob);

// Create/Update/Delete (employer)
router.post(
  '/',
  requireAuth,
  requireRole('employer'),
  [
    body('title').notEmpty(),
    body('company').notEmpty(),
    body('location').notEmpty(),
    body('description').isLength({ min: 20 }),
  ],
  createJob
);

router.patch('/:id', requireAuth, requireRole('employer'), updateJob);
router.delete('/:id', requireAuth, requireRole('employer'), deleteJob);

// Actions (employer)
router.patch('/:id/feature', requireAuth, requireRole('employer'), featureJob);
router.post('/:id/duplicate', requireAuth, requireRole('employer'), duplicateJob);

export default router;
