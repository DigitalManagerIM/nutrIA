import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getStatus, getAchievements } from '../controllers/gamification';

const router = Router();

router.use(authMiddleware);

router.get('/status', getStatus);
router.get('/achievements', getAchievements);

export default router;
