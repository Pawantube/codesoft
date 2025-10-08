import { Router } from 'express';
import { body } from 'express-validator';
import { register, login } from '../controllers/authController.js';
const router = Router();
router.post('/register', [body('name').notEmpty(), body('email').isEmail(), body('password').isLength({min:6}), body('role').isIn(['employer','candidate'])], register);
router.post('/login', [body('email').isEmail(), body('password').notEmpty()], login);
export default router;
