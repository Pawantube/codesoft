import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createOrGetReferral, listReferrals, convertReferral, payoutReferral, referralRedirect } from '../controllers/referralController.js';

const router = Router();

// Public click-tracker/redirector (mounted at app level due to absolute path)
export const attachReferralRedirect = (app) => {
  app.get('/r/:code', referralRedirect);
};

// Authenticated API
router.use(requireAuth);
// Employers can create and list their own referrals
router.post('/', requireRole(['employer','admin']), createOrGetReferral);
router.get('/', requireRole(['employer','admin']), listReferrals);
// Internal hooks/ops
router.post('/convert', convertReferral); // mark applied/hired by code
router.post('/:id/payout', requireRole(['employer','admin']), payoutReferral);

export default router;
