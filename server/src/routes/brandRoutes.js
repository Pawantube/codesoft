import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getMyBrand, updateMyBrand, getBrandByCompany } from '../controllers/brandController.js';

const router = Router();

// Public lookup by company name (no auth)
router.get('/by-company', getBrandByCompany);

// Authenticated brand management
router.use(requireAuth);
router.get('/me', requireRole(['employer','admin']), getMyBrand);
router.put('/me', requireRole(['employer','admin']), updateMyBrand);

export default router;
