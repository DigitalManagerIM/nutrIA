import { Router } from 'express';
import { register, login, me, refresh } from '../controllers/auth';
import { authMiddleware } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.get('/me', authMiddleware, me);
router.post('/refresh', authRateLimiter, refresh);

export default router;
