import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getStats } from '../controllers/stats';

const router = Router();
router.use(authMiddleware);
router.get('/', getStats);

export default router;
